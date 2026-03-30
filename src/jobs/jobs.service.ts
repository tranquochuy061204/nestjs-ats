import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JobEntity, JobStatus } from './entities/job.entity';
import { JobSkillTagEntity } from './entities/job-skill-tag.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobFilterDto } from './dto/job-filter.dto';
import { EmployerEntity } from '../employers/entities/employer.entity';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepository: Repository<EmployerEntity>,
    private readonly dataSource: DataSource,
  ) {}

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

      // 2. Insert Skills if provided
      if (skills && skills.length > 0) {
        const skillTags = skills.map((s) => ({
          jobId: savedJob.id,
          skillId: s.skillId,
          tagText: s.tagText,
        }));
        await queryRunner.manager.insert(JobSkillTagEntity, skillTags);
      }

      await queryRunner.commitTransaction();
      return { id: savedJob.id, message: 'Đã tạo bản nháp tin tuyển dụng' };
    } catch (err) {
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { skills, ...jobData } = updateJobDto;

      // 1. Update Job info
      await queryRunner.manager.update(JobEntity, { id: jobId }, jobData);

      // 2. Overwrite skills if new list provided
      if (skills) {
        // Remove old tags
        await queryRunner.manager.delete(JobSkillTagEntity, { jobId });
        // Add new ones
        if (skills.length > 0) {
          const skillTags = skills.map((s) => ({
            jobId: jobId,
            skillId: s.skillId,
            tagText: s.tagText,
          }));
          await queryRunner.manager.insert(JobSkillTagEntity, skillTags);
        }
      }

      await queryRunner.commitTransaction();
      return { message: 'Cập nhật tin tuyển dụng thành công' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Lỗi cập nhật. Vui lòng thử lại.');
    } finally {
      await queryRunner.release();
    }
  }

  async getEmployerJobs(employerUserId: number, filterDto: JobFilterDto) {
    const employer = await this.getCurrentEmployer(employerUserId);

    if (!employer.companyId) return { data: [], total: 0 };

    const { page = 1, limit = 10, keyword, status } = filterDto;
    const skip = (page - 1) * limit;

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

    qb.orderBy('job.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
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
    const skip = (page - 1) * limit;

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

    qb.orderBy('job.createdAt', 'DESC') // Using offset pagination limits for now
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
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
