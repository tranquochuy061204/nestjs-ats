import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

  /**
   * Cron job runs every hour to close overdue jobs
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleJobDeadlines() {
    this.logger.log('Checking for overdue jobs...');
    const now = new Date();

    const result = await this.jobRepository
      .createQueryBuilder()
      .update(JobEntity)
      .set({ status: JobStatus.CLOSED })
      .where('status = :status', { status: JobStatus.PUBLISHED })
      .andWhere('deadline IS NOT NULL')
      .andWhere('deadline < :now', { now })
      .execute();

    if (result && result.affected && result.affected > 0) {
      this.logger.log(`Closed ${result.affected} overdue jobs.`);
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

    // Execute within a transaction (Best Practice: db-use-transactions)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { skills, ...jobData } = createJobDto;

      // 1. Create Job record
      const newJob = queryRunner.manager.create(JobEntity, {
        ...jobData,
        employerId: employer.id,
        companyId: employer.companyId,
        status: JobStatus.DRAFT, // Default always draft until published
      });
      const savedJob = await queryRunner.manager.save(newJob);

      // 2. Sync Skills using dedicated service (includes AI normalization)
      await this.jobSkillsService.syncJobSkills(
        queryRunner,
        savedJob.id,
        skills,
      );

      await queryRunner.commitTransaction();
      return { id: savedJob.id, message: 'Đã tạo bản nháp tin tuyển dụng' };
    } catch {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        'Không thể tạo tin tuyển dụng. Vui lòng kiểm tra lại thông tin.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateJob(
    employerUserId: number,
    jobId: number,
    updateJobDto: UpdateJobDto,
  ) {
    const employer = await this.getCurrentEmployer(employerUserId);

    const job = await this.jobRepository.findOne({
      where: { id: jobId, companyId: employer.companyId },
    });

    if (!job) {
      throw new NotFoundException(
        'Không tìm thấy tin tuyển dụng hoặc bạn không có quyền chỉnh sửa',
      );
    }

    if (!employer.isAdminCompany) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa tin (Yêu cầu tài khoản HR Admin)',
      );
    }

    // Check if the company is verified for auto-approval
    const company = await this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company')
      .where('job.id = :jobId', { jobId })
      .getOne()
      .then((j) => j?.company);

    const isCompanyVerified =
      company?.status === CompanyStatus.APPROVED || false;

    const { status, ...jobData } = updateJobDto;

    // BUSINESS LOGIC: Employers cannot set status to PUBLISHED directly UNLESS company is verified
    let finalStatus = status;
    if (status === JobStatus.PUBLISHED && !isCompanyVerified) {
      finalStatus = JobStatus.PENDING;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { skills, ...otherJobData } = jobData;

      // 1. Update Job info
      await queryRunner.manager.update(
        JobEntity,
        { id: jobId },
        { ...otherJobData, status: finalStatus },
      );

      // 2. Overwrite skills using service if provided
      if (skills) {
        await this.jobSkillsService.syncJobSkills(queryRunner, jobId, skills);
      }

      await queryRunner.commitTransaction();
      return {
        message:
          finalStatus === JobStatus.PENDING
            ? 'Tin đã được gửi duyệt. Vui lòng chờ Admin xác nhận.'
            : 'Cập nhật tin tuyển dụng thành công',
      };
    } catch {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Lỗi cập nhật. Vui lòng thử lại.');
    } finally {
      await queryRunner.release();
    }
  }

  // -----------------------
  // ADMIN SERVICE METHODS
  // -----------------------

  async approveJob(jobId: number) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    const oldStatus = job.status;
    await this.jobRepository.update(jobId, {
      status: JobStatus.PUBLISHED,
      rejectionReason: null, // Clear reason if previously rejected
    });

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        jobId,
        oldStatus,
        newStatus: JobStatus.PUBLISHED,
      }),
    );

    return { message: 'Đã duyệt tin tuyển dụng' };
  }

  async rejectJob(jobId: number, reason: string) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    const oldStatus = job.status;
    await this.jobRepository.update(jobId, {
      status: JobStatus.REJECTED,
      rejectionReason: reason,
    });

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        jobId,
        oldStatus,
        newStatus: JobStatus.REJECTED,
        reason,
      }),
    );

    return { message: 'Đã từ chối tin tuyển dụng' };
  }

  async getJobHistory(jobId: number) {
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
