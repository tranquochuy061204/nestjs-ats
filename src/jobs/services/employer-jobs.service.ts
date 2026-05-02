import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { JobStatusHistoryEntity } from '../entities/job-status-history.entity';
import { CreateJobDto } from '../dto/create-job.dto';
import { UpdateJobDto } from '../dto/update-job.dto';
import { JobFilterDto } from '../dto/job-filter.dto';
import { JobSkillsService } from '../job-skills.service';
import { EmployersService } from '../../employers/employers.service';
import { EmployerEntity } from '../../employers/entities/employer.entity';
import { CompanyStatus } from '../../companies/entities/company.entity';
import { getPaginatedResult } from '../../common/utils/pagination.util';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

@Injectable()
export class EmployerJobsService {
  private readonly logger = new Logger(EmployerJobsService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(JobStatusHistoryEntity)
    private readonly historyRepo: Repository<JobStatusHistoryEntity>,
    private readonly jobSkillsService: JobSkillsService,
    private readonly employersService: EmployersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly dataSource: DataSource,
  ) {}

  async createJob(employerUserId: number, createJobDto: CreateJobDto) {
    const employer = await this.employersService.getProfile(employerUserId);

    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException(
        'Bạn phải tham gia vào một công ty trước khi đăng tin tuyển dụng',
      );
    }
    const emp = employer as EmployerEntity & { companyId: number };

    if (!emp.isAdminCompany) {
      throw new ForbiddenException(
        'Bạn không có quyền đăng tin (Yêu cầu tài khoản HR Admin)',
      );
    }

    // ── VIP Quota & Feature Check ──────────────────────────────────────
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(emp.companyId);

    // [Feature #2] can_hide_salary
    if (createJobDto.hideSalary && !pkg.canHideSalary) {
      throw new ForbiddenException(
        'Tính năng ẩn lương yêu cầu gói VIP. Vui lòng nâng cấp để sử dụng.',
      );
    }

    // [Feature #3] can_require_cv
    if (createJobDto.requireCv && !pkg.canRequireCv) {
      throw new ForbiddenException(
        'Tính năng bắt buộc CV yêu cầu gói VIP. Vui lòng nâng cấp để sử dụng.',
      );
    }

    // [Feature #1] max_active_jobs — chỉ enforce khi PUBLISH, không chặn tạo DRAFT
    // (checkJobSlotLock được gọi khi updateJob chuyển sang PUBLISHED)
    // ──────────────────────────────────────────────────────────────────

    try {
      return await this.dataSource.transaction(async (manager) => {
        const { skills, ...jobData } = createJobDto;

        const newJob = manager.create(JobEntity, {
          ...jobData,
          employerId: emp.id,
          companyId: emp.companyId,
          status: JobStatus.DRAFT,
        });
        const savedJob = await manager.save(newJob);

        await this.jobSkillsService.syncJobSkills(manager, savedJob.id, skills);

        return { id: savedJob.id, message: 'Đã tạo bản nháp tin tuyển dụng' };
      });
    } catch (e) {
      this.logger.error(e);
      throw new BadRequestException(
        'Không thể tạo tin tuyển dụng. Vui lòng kiểm tra lại thông tin.',
      );
    }
  }

  async updateJob(
    employerUserId: number,
    jobId: number,
    updateJobDto: UpdateJobDto,
  ) {
    const employer = await this.employersService.getProfile(employerUserId);

    if (!employer.isAdminCompany) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa tin (Yêu cầu tài khoản HR Admin)',
      );
    }

    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException('Bạn phải tham gia vào một công ty');
    }

    const job = await this.jobRepository.findOne({
      where: { id: jobId, companyId: employer.companyId },
      relations: ['company'],
    });

    if (!job) {
      throw new NotFoundException(
        'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền chỉnh sửa',
      );
    }

    // ── VIP Quota & Feature Check ──────────────────────────────────────
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(employer.companyId);

    // [Feature #2] cannot set hideSalary if not VIP (check both: new value OR existing still true)
    const willHideSalary = updateJobDto.hideSalary ?? job.hideSalary;
    if (willHideSalary && !pkg.canHideSalary) {
      throw new ForbiddenException(
        'Tính năng ẩn lương yêu cầu gói VIP. Vui lòng nâng cấp để sử dụng.',
      );
    }

    // [Feature #3] cannot set requireCv if not VIP
    const willRequireCv = updateJobDto.requireCv ?? job.requireCv;
    if (willRequireCv && !pkg.canRequireCv) {
      throw new ForbiddenException(
        'Tính năng bắt buộc CV yêu cầu gói VIP. Vui lòng nâng cấp để sử dụng.',
      );
    }

    const { status } = updateJobDto;

    // VALIDATE ALLOWED STATUS
    // Lưu ý: PENDING không nằm trong danh sách cho phép — đây là trạng thái hệ thống tự gán
    // khi company chưa verified gửi bài đăng. Employer không được phép set thủ công.
    const employerAllowedStatuses = [
      JobStatus.DRAFT,
      JobStatus.PUBLISHED,
      JobStatus.CLOSED,
    ];

    if (status && !employerAllowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Nhà tuyển dụng không thể cập nhật tin sang trạng thái "${status}"`,
      );
    }

    const isCompanyVerified = job.company?.status === CompanyStatus.APPROVED;
    let finalStatus: JobStatus = status ?? (job.status as JobStatus);

    // [Feature #1] max_active_jobs — enforce khi recruiter submit (PUBLISHED intent),
    // kể cả khi company chưa verified và bài sẽ chuyển sang PENDING.
    // Chính sách Free: tại 1 thời điểm chỉ được có 1 tin (published HOẶC pending).
    //
    // NOTE: Employer không được phép set PENDING trực tiếp (bị chặn ở allowed statuses).
    // PENDING chỉ được hệ thống tự gán khi công ty chưa verified gửi "PUBLISHED".
    if (status === JobStatus.PUBLISHED) {
      const {
        canPost,
        currentActiveJobs,
        maxActiveJobs,
        unlocksAt,
        blockReason,
      } = await this.subscriptionsService.checkJobSlotLock(employer.companyId);

      if (!canPost) {
        let reason: string;
        if (blockReason === 'has_published') {
          reason =
            'Bạn đang có 1 tin tuyển dụng đang hiển thị. Vui lòng đóng tin hiện tại trước khi đăng tin mới.';
        } else if (blockReason === 'has_pending') {
          reason =
            'Bạn đang có 1 tin đang chờ Admin duyệt. Vui lòng chờ kết quả duyệt trước khi gửi tin mới.';
        } else if (blockReason === 'time_lock') {
          reason = `Gói Free chỉ cho phép đăng 1 tin mỗi ${pkg.jobDurationDays} ngày. Mở khoá lúc ${unlocksAt!.toLocaleString('vi-VN')}.`;
        } else {
          reason = `Bạn đã đạt tối đa ${maxActiveJobs} tin đang tuyển hoặc chờ duyệt (hiện có: ${currentActiveJobs}).`;
        }
        throw new ForbiddenException(reason);
      }

      // Sau khi pass quota check: quyết định PUBLISHED hay PENDING
      if (!isCompanyVerified) {
        finalStatus = JobStatus.PENDING;
      }
      // (else: giữ finalStatus = PUBLISHED — đã set ở trên)
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const { skills, ...jobDataUpdates } = updateJobDto;
        delete jobDataUpdates.status; // handled above

        const updates: Partial<JobEntity> = {
          ...jobDataUpdates,
          status: finalStatus,
        };
        if (finalStatus === JobStatus.CLOSED) {
          updates.isBumped = false;
          updates.bumpedUntil = null;
          updates.bumpedAt = null;
        }

        await manager.update(JobEntity, { id: jobId }, updates);

        if (finalStatus !== (job.status as JobStatus)) {
          await manager.save(
            JobStatusHistoryEntity,
            manager.create(JobStatusHistoryEntity, {
              jobId,
              oldStatus: job.status,
              newStatus: finalStatus,
              reason: 'Nhà tuyển dụng thay đổi',
              changedById: employerUserId,
            }),
          );

          // [Feature #1] record publish/pending timestamp để lock slot cho Free
          if (
            finalStatus === JobStatus.PUBLISHED ||
            finalStatus === JobStatus.PENDING
          ) {
            await this.subscriptionsService.recordJobPublished(
              jobId,
              employer.companyId!,
              manager,
            );
          }
        }

        if (skills) {
          await this.jobSkillsService.syncJobSkills(manager, jobId, skills);
        }
      });

      return {
        message:
          finalStatus === JobStatus.PENDING
            ? 'Tin đã được gửi duyệt. Vui lòng chờ Admin xác nhận.'
            : 'Cập nhật tin tuyển dụng thành công',
      };
    } catch (e) {
      if (e instanceof ForbiddenException || e instanceof BadRequestException)
        throw e;
      this.logger.error(e);
      throw new BadRequestException('Lỗi cập nhật. Vui lòng thử lại.');
    }
  }

  async getEmployerJobs(employerUserId: number, filterDto: JobFilterDto) {
    const employer = await this.employersService.getProfile(employerUserId);

    if (employer.companyId === null || employer.companyId === undefined)
      return { data: [], total: 0 };

    const { page = 1, limit = 10, keyword, status } = filterDto;

    const qb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.category', 'category')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.companyId = :companyId', {
        companyId: employer.companyId,
      });

    if (keyword) {
      qb.andWhere('job.title ILIKE :keyword', { keyword: `%${keyword}%` });
    }

    if (status) {
      qb.andWhere('job.status = :status', { status });
    }

    qb.orderBy('job.createdAt', 'DESC');

    return getPaginatedResult(qb, page, limit);
  }

  async getEmployerJobHistory(employerUserId: number, jobId: number) {
    const employer = await this.employersService.getProfile(employerUserId);
    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException('Bạn phải tham gia vào một công ty');
    }

    const job = await this.jobRepository.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });

    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc bạn không có quyền',
      );
    }

    return this.historyRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
  }
}
