import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JobApplicationEntity,
  ApplicationStatus,
} from './entities/job-application.entity';
import { ApplicationStatusHistoryEntity } from './entities/application-status-history.entity';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { JobEntity, JobStatus } from '../jobs/entities/job.entity';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { ApplyJobDto } from './dto/apply-job.dto';
import { ApplicationFilterDto } from './dto/application-filter.dto';
import { UpdateApplicationStatusDto } from './dto/update-application-status.dto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(ApplicationStatusHistoryEntity)
    private readonly historyRepo: Repository<ApplicationStatusHistoryEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  // ─────────────────────────────────────────────
  // CANDIDATE METHODS
  // ─────────────────────────────────────────────

  /**
   * Ứng viên nộp đơn ứng tuyển.
   * - Kiểm tra CV đã có chưa
   * - Kiểm tra job published & chưa quá deadline
   * - Nếu đã ứng tuyển trước đó (withdrawn): cho phép nộp lại + cảnh báo
   * - Nếu đã ứng tuyển (active): chặn duplicate
   */
  async apply(userId: number, jobId: number, dto: ApplyJobDto) {
    const candidate = await this.findCandidateByUserId(userId);

    // 1. Kiểm tra CV
    if (!candidate.cvUrl) {
      throw new BadRequestException(
        'Vui lòng tải lên CV trước khi ứng tuyển. Truy cập API POST /api/candidates/cv để upload.',
      );
    }

    // 2. Kiểm tra job
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }

    if (job.status !== JobStatus.PUBLISHED) {
      throw new BadRequestException(
        'Tin tuyển dụng chưa được phát hành hoặc đã đóng',
      );
    }

    if (job.deadline && new Date(job.deadline) < new Date()) {
      throw new BadRequestException('Tin tuyển dụng đã hết hạn nộp hồ sơ');
    }

    // 3. Kiểm tra duplicate
    const existing = await this.applicationRepo.findOne({
      where: { jobId, candidateId: candidate.id },
    });

    if (existing) {
      if (existing.status === (ApplicationStatus.WITHDRAWN as string)) {
        // Cho phép nộp lại — cập nhật đơn cũ
        existing.status = ApplicationStatus.RECEIVED;
        existing.cvUrlSnapshot = candidate.cvUrl;
        existing.coverLetter = dto.coverLetter ?? null;
        existing.rejectionReason = null;
        existing.employerNote = null;
        await this.applicationRepo.save(existing);

        // Log history
        await this.logHistory(
          existing.id,
          ApplicationStatus.WITHDRAWN,
          ApplicationStatus.RECEIVED,
          null,
          userId,
        );

        return {
          message:
            'Bạn đã từng ứng tuyển công việc này trước đó. Đơn ứng tuyển đã được gửi lại thành công.',
          applicationId: existing.id,
          reapplied: true,
        };
      }

      // Đã ứng tuyển & đang active → chặn
      throw new ConflictException(
        'Bạn đã ứng tuyển công việc này rồi. Không thể nộp đơn trùng lặp.',
      );
    }

    // 4. Tạo đơn ứng tuyển mới
    const application = this.applicationRepo.create({
      jobId,
      candidateId: candidate.id,
      cvUrlSnapshot: candidate.cvUrl,
      coverLetter: dto.coverLetter,
      status: ApplicationStatus.RECEIVED,
    });
    const saved = await this.applicationRepo.save(application);

    // 5. Log history
    await this.logHistory(
      saved.id,
      null,
      ApplicationStatus.RECEIVED,
      null,
      userId,
    );

    return {
      message: 'Ứng tuyển thành công',
      applicationId: saved.id,
      reapplied: false,
    };
  }

  /**
   * Xem danh sách đơn ứng tuyển của mình (phân trang).
   */
  async getMyApplications(userId: number, filterDto: ApplicationFilterDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const { page = 1, limit = 10, status } = filterDto;

    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.job', 'job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.province', 'province')
      .leftJoinAndSelect('job.category', 'category')
      .where('app.candidateId = :candidateId', {
        candidateId: candidate.id,
      });

    if (status) {
      qb.andWhere('app.status = :status', { status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  /**
   * Xem chi tiết 1 đơn ứng tuyển của mình.
   */
  async getMyApplicationDetail(userId: number, applicationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidateId: candidate.id },
      relations: [
        'job',
        'job.company',
        'job.province',
        'job.category',
        'job.jobType',
        'statusHistory',
      ],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    return application;
  }

  /**
   * Ứng viên rút đơn ứng tuyển.
   */
  async withdrawApplication(userId: number, applicationId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId, candidateId: candidate.id },
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.status === (ApplicationStatus.WITHDRAWN as string)) {
      throw new BadRequestException('Đơn ứng tuyển đã được rút trước đó');
    }

    if (application.status === (ApplicationStatus.OFFER as string)) {
      throw new BadRequestException(
        'Không thể rút đơn khi đã nhận đề nghị việc làm. Vui lòng liên hệ nhà tuyển dụng.',
      );
    }

    const oldStatus = application.status;
    application.status = ApplicationStatus.WITHDRAWN;
    await this.applicationRepo.save(application);

    await this.logHistory(
      applicationId,
      oldStatus,
      ApplicationStatus.WITHDRAWN,
      'Ứng viên tự rút đơn',
      userId,
    );

    return { message: 'Đã rút đơn ứng tuyển thành công' };
  }

  // ─────────────────────────────────────────────
  // EMPLOYER METHODS
  // ─────────────────────────────────────────────

  /**
   * Xem danh sách ứng viên đã nộp đơn cho 1 tin tuyển dụng.
   */
  async getJobApplications(
    employerUserId: number,
    jobId: number,
    filterDto: ApplicationFilterDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    // Kiểm tra job thuộc company của employer
    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    const { page = 1, limit = 10, status } = filterDto;

    const qb = this.applicationRepo
      .createQueryBuilder('app')
      .leftJoinAndSelect('app.candidate', 'candidate')
      .where('app.jobId = :jobId', { jobId });

    if (status) {
      qb.andWhere('app.status = :status', { status });
    }

    qb.orderBy('app.appliedAt', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  /**
   * Xem chi tiết hồ sơ ứng viên ứng tuyển.
   */
  async getApplicationDetail(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: [
        'job',
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.workExperiences',
        'candidate.educations',
        'candidate.certificates',
        'statusHistory',
      ],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    // Kiểm tra job thuộc company của employer
    if (application.job.companyId !== employer.companyId) {
      throw new ForbiddenException('Bạn không có quyền xem đơn ứng tuyển này');
    }

    return application;
  }

  /**
   * Nhà tuyển dụng cập nhật trạng thái đơn ứng tuyển.
   */
  async updateApplicationStatus(
    employerUserId: number,
    applicationId: number,
    dto: UpdateApplicationStatusDto,
  ) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.job.companyId !== employer.companyId) {
      throw new ForbiddenException(
        'Bạn không có quyền thay đổi đơn ứng tuyển này',
      );
    }

    // Validate: không đổi status nếu ứng viên đã rút
    if (application.status === (ApplicationStatus.WITHDRAWN as string)) {
      throw new BadRequestException(
        'Không thể thay đổi trạng thái đơn đã được ứng viên rút',
      );
    }

    // Validate: reject phải có lý do
    if (dto.status === ApplicationStatus.REJECTED && !dto.reason) {
      throw new BadRequestException(
        'Vui lòng cung cấp lý do khi từ chối ứng viên',
      );
    }

    const oldStatus = application.status;
    application.status = dto.status;

    if (dto.status === ApplicationStatus.REJECTED) {
      application.rejectionReason = dto.reason ?? null;
    }

    if (dto.note !== undefined) {
      application.employerNote = dto.note ?? null;
    }

    await this.applicationRepo.save(application);

    // Log history
    await this.logHistory(
      applicationId,
      oldStatus,
      dto.status,
      dto.reason ?? null,
      employerUserId,
    );

    return {
      message: `Đã cập nhật trạng thái thành "${dto.status}"`,
    };
  }

  /**
   * Xem lịch sử thay đổi trạng thái đơn ứng tuyển.
   */
  async getApplicationHistory(employerUserId: number, applicationId: number) {
    const employer = await this.findEmployerByUserId(employerUserId);

    const application = await this.applicationRepo.findOne({
      where: { id: applicationId },
      relations: ['job'],
    });

    if (!application) {
      throw new NotFoundException('Đơn ứng tuyển không tồn tại');
    }

    if (application.job.companyId !== employer.companyId) {
      throw new ForbiddenException(
        'Bạn không có quyền xem lịch sử đơn ứng tuyển này',
      );
    }

    return this.historyRepo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepo.findOne({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException('Hồ sơ ứng viên không tồn tại');
    }
    return candidate;
  }

  private async findEmployerByUserId(userId: number) {
    const employer = await this.employerRepo.findOne({
      where: { userId },
    });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    if (!employer.companyId) {
      throw new ForbiddenException(
        'Bạn phải tham gia vào một công ty trước khi quản lý ứng tuyển',
      );
    }
    return employer;
  }

  private async logHistory(
    applicationId: number,
    oldStatus: string | null,
    newStatus: string,
    reason: string | null,
    changedById: number | null,
  ) {
    await this.historyRepo.save(
      this.historyRepo.create({
        applicationId,
        oldStatus,
        newStatus,
        reason,
        changedById,
      }),
    );
  }
}
