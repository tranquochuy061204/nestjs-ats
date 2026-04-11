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
import { CompanyStatus } from '../../companies/entities/company.entity';
import { getPaginatedResult } from '../../common/utils/pagination.util';

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
    private readonly dataSource: DataSource,
  ) {}

  async createJob(employerUserId: number, createJobDto: CreateJobDto) {
    const employer = await this.employersService.getProfile(employerUserId);

    if (!employer.companyId) {
      throw new ForbiddenException(
        'Bạn phải tham gia vào một công ty trước khi đăng tin tuyển dụng',
      );
    }
    if (!employer.isAdminCompany) {
      throw new ForbiddenException(
        'Bạn không có quyền đăng tin (Yêu cầu tài khoản HR Admin)',
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const { skills, ...jobData } = createJobDto;

        const newJob = manager.create(JobEntity, {
          ...jobData,
          employerId: employer.id,
          companyId: employer.companyId,
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

    const job = await this.jobRepository.findOne({
      where: { id: jobId, companyId: employer.companyId },
      relations: ['company'],
    });

    if (!job) {
      throw new NotFoundException(
        'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền chỉnh sửa',
      );
    }

    const { status, ...otherJobData } = updateJobDto;

    // VALIDATE ALLOWED STATUS
    const employerAllowedStatuses = [
      JobStatus.DRAFT,
      JobStatus.PUBLISHED,
      JobStatus.CLOSED,
      JobStatus.PENDING,
    ];

    if (status && !employerAllowedStatuses.includes(status)) {
      throw new BadRequestException(
        `Nhà tuyển dụng không thể cập nhật tin sang trạng thái "${status}"`,
      );
    }

    const isCompanyVerified = job.company?.status === CompanyStatus.APPROVED;
    let finalStatus = (status as string) ?? job.status;

    if (status === (JobStatus.PUBLISHED as string) && !isCompanyVerified) {
      finalStatus = JobStatus.PENDING;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const { skills, ...jobDataUpdates } = updateJobDto;
        delete jobDataUpdates.status; // handled above

        await manager.update(
          JobEntity,
          { id: jobId },
          { ...jobDataUpdates, status: finalStatus },
        );

        if (finalStatus !== job.status) {
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
        }

        if (skills) {
          await this.jobSkillsService.syncJobSkills(manager, jobId, skills);
        }
      });

      return {
        message:
          finalStatus === (JobStatus.PENDING as string)
            ? 'Tin đã được gửi duyệt. Vui lòng chờ Admin xác nhận.'
            : 'Cập nhật tin tuyển dụng thành công',
      };
    } catch (e) {
      this.logger.error(e);
      throw new BadRequestException('Lỗi cập nhật. Vui lòng thử lại.');
    }
  }

  async getEmployerJobs(employerUserId: number, filterDto: JobFilterDto) {
    const employer = await this.employersService.getProfile(employerUserId);

    if (!employer.companyId) return { data: [], total: 0 };

    const { page = 1, limit = 10, keyword, status } = filterDto;

    const qb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.category', 'category')
      .where('job.companyId = :companyId', { companyId: employer.companyId });

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
