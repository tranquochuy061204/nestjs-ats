import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { JobStatusHistoryEntity } from '../entities/job-status-history.entity';
import { JobFilterDto } from '../dto/job-filter.dto';
import { getPaginatedResult } from '../../common/utils/pagination.util';

@Injectable()
export class AdminJobsService {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(JobStatusHistoryEntity)
    private readonly historyRepo: Repository<JobStatusHistoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async approveJob(jobId: number) {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    if (job.status === (JobStatus.PUBLISHED as string)) {
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

    if (job.status === (JobStatus.REJECTED as string)) {
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

    return getPaginatedResult(qb, page, limit);
  }

  async getAdminJobHistory(jobId: number) {
    return this.historyRepo.find({
      where: { jobId },
      order: { createdAt: 'DESC' },
    });
  }
}
