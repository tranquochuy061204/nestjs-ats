import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { JobEntity, JobStatus } from './entities/job.entity';
import { JobStatusHistoryEntity } from './entities/job-status-history.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobFilterDto } from './dto/job-filter.dto';
import { EmployerEntity } from '../employers/entities/employer.entity';
import { CompanyStatus } from '../companies/entities/company.entity';
import { JobSkillsService } from './job-skills.service';
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepository: Repository<EmployerEntity>,
    @InjectRepository(JobStatusHistoryEntity)
    private readonly historyRepo: Repository<JobStatusHistoryEntity>,
    private readonly jobSkillsService: JobSkillsService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleJobDeadlines() {
    this.logger.log('Checking for overdue jobs...');
    try {
      const now = new Date();
      const overdueJobs = await this.jobRepository
        .createQueryBuilder('job')
        .select(['job.id', 'job.status'])
        .where('job.status = :status', { status: JobStatus.PUBLISHED })
        .andWhere('job.deadline IS NOT NULL')
        .andWhere('job.deadline < :now', { now })
        .getMany();

      if (overdueJobs.length === 0) return;

      await this.dataSource.transaction(async (manager) => {
        const jobIds = overdueJobs.map((j) => j.id);
        
        await manager.update(JobEntity, { id: In(jobIds) }, { status: JobStatus.CLOSED });
        
        const histories = overdueJobs.map((j) => 
          manager.create(JobStatusHistoryEntity, {
            jobId: j.id,
            oldStatus: j.status,
            newStatus: JobStatus.CLOSED,
            reason: 'Tự động đóng do quá hạn nộp hồ sơ',
          })
        );
        
        await manager.insert(JobStatusHistoryEntity, histories);
      });

      this.logger.log(`Closed ${overdueJobs.length} overdue jobs.`);
    } catch (error) {
      this.logger.error('Failed to handle overdue jobs', error instanceof Error ? error.stack : String(error));
    }
  }

  async createJob(employerUserId: number, createJobDto: CreateJobDto) {
    const employer = await this.getCurrentEmployer(employerUserId);

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
      throw new BadRequestException('Không thể tạo tin tuyển dụng. Vui lòng kiểm tra lại thông tin.');
    }
  }

  async updateJob(
    employerUserId: number,
    jobId: number,
    updateJobDto: UpdateJobDto,
  ) {
    const employer = await this.getCurrentEmployer(employerUserId);

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
    let finalStatus = status ?? job.status;

    if (status === JobStatus.PUBLISHED && !isCompanyVerified) {
      finalStatus = JobStatus.PENDING;
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        const { skills, ...jobDataUpdates } = updateJobDto;
        delete jobDataUpdates.status; // handled above

        await manager.update(
          JobEntity,
          { id: jobId },
          { ...otherJobData, status: finalStatus },
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
          finalStatus === JobStatus.PENDING
            ? 'Tin đã được gửi duyệt. Vui lòng chờ Admin xác nhận.'
            : 'Cập nhật tin tuyển dụng thành công',
      };
    } catch (e) {
      this.logger.error(e);
      throw new BadRequestException('Lỗi cập nhật. Vui lòng thử lại.');
    }
  }

  // -----------------------
  // ADMIN SERVICE METHODS
  // -----------------------

  async approveJob(jobId: number) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    if (job.status === JobStatus.PUBLISHED) {
      throw new BadRequestException('Tin đã được duyệt trước đó');
    }

    const oldStatus = job.status;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(JobEntity, jobId, {
        status: JobStatus.PUBLISHED,
        rejectionReason: null,
      });

      await manager.save(
        JobStatusHistoryEntity,
        manager.create(JobStatusHistoryEntity, {
          jobId,
          oldStatus,
          newStatus: JobStatus.PUBLISHED,
        }),
      );
    });

    return { message: 'Đã duyệt tin tuyển dụng' };
  }

  async rejectJob(jobId: number, reason: string) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    if (job.status === JobStatus.REJECTED) {
      throw new BadRequestException('Tin đã bị từ chối trước đó');
    }

    const oldStatus = job.status;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(JobEntity, jobId, {
        status: JobStatus.REJECTED,
        rejectionReason: reason,
      });

      await manager.save(
        JobStatusHistoryEntity,
        manager.create(JobStatusHistoryEntity, {
          jobId,
          oldStatus,
          newStatus: JobStatus.REJECTED,
          reason,
        }),
      );
    });

    return { message: 'Đã từ chối tin tuyển dụng' };
  }

  async getAdminJobHistory(jobId: number) {
    return this.historyRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
  }

  async getEmployerJobHistory(employerUserId: number, jobId: number) {
    const employer = await this.getCurrentEmployer(employerUserId);
    const job = await this.jobRepository.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });
    
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại hoặc bạn không có quyền');
    }

    return this.historyRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAdminJobs(filterDto: JobFilterDto) {
    const { page = 1, limit = 10, keyword, status } = filterDto;

    const qb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.category', 'category');

    if (keyword) {
      // Temporary fallback. Proper fix requires pg_trgm index
      qb.andWhere('job.title ILIKE :keyword', { keyword: `%${keyword}%` });
    }

    if (status) {
      qb.andWhere('job.status = :status', { status });
    }

    qb.orderBy('job.createdAt', 'DESC');

    return this.getPaginatedResult(qb, page, limit);
  }

  async getEmployerJobs(employerUserId: number, filterDto: JobFilterDto) {
    const employer = await this.getCurrentEmployer(employerUserId);

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

    return this.getPaginatedResult(qb, page, limit);
  }

  async getPublicJobs(filterDto: JobFilterDto) {
    const {
      page = 1,
      limit = 10,
      keyword,
      provinceId,
      categoryId,
      jobTypeId,
    } = filterDto;

    const qb = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .leftJoinAndSelect('job.province', 'province')
      .leftJoinAndSelect('job.category', 'category')
      .leftJoinAndSelect('job.jobType', 'jobType')
      .leftJoinAndSelect('job.skills', 'skillTag')
      .leftJoinAndSelect('skillTag.skillMetadata', 'skillMeta')
      .where('job.status = :status', { status: JobStatus.PUBLISHED });

    if (keyword) {
      qb.andWhere('job.title ILIKE :keyword', { keyword: `%${keyword}%` });
    }
    if (provinceId) {
      qb.andWhere('job.provinceId = :provinceId', { provinceId });
    }
    if (categoryId) {
      qb.andWhere('job.categoryId = :categoryId', { categoryId });
    }
    if (jobTypeId) {
      qb.andWhere('job.jobTypeId = :jobTypeId', { jobTypeId });
    }

    qb.orderBy('job.createdAt', 'DESC');

    return this.getPaginatedResult(qb, page, limit);
  }

  async getJobDetail(jobId: number) {
    const job = await this.jobRepository.findOne({
      where: { id: jobId, status: JobStatus.PUBLISHED },
      relations: [
        'company',
        'employer',
        'province',
        'category',
        'jobType',
        'skills',
        'skills.skillMetadata',
      ],
    });

    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại hoặc đã đóng');
    }

    return job;
  }

  private async getPaginatedResult<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  private async getCurrentEmployer(userId: number) {
    const employer = await this.employerRepository.findOne({
      where: { userId },
    });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    return employer;
  }
}
