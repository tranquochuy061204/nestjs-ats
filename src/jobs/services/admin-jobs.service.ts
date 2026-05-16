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
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';

@Injectable()
export class AdminJobsService {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    @InjectRepository(JobStatusHistoryEntity)
    private readonly historyRepo: Repository<JobStatusHistoryEntity>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async approveJob(jobId: number) {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['employer'],
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    if (job.status === JobStatus.PUBLISHED) {
      throw new BadRequestException('Tin đã được duyệt trước đó');
    }

    const oldStatus = job.status;
    const companyId = job.companyId;

    await this.dataSource.transaction(async (manager) => {
      // 1. Cập nhật trạng thái tin và ngày công khai ngay trong transaction
      await manager.update(JobEntity, jobId, {
        status: JobStatus.PUBLISHED,
        publishedAt: new Date(),
        rejectionReason: null,
      });

      // 2. Lưu lịch sử thay đổi
      await manager.save(
        JobStatusHistoryEntity,
        manager.create(JobStatusHistoryEntity, {
          jobId,
          oldStatus,
          newStatus: JobStatus.PUBLISHED,
        }),
      );

      // 3. Cập nhật thời điểm publish cuối của công ty (dùng cho logic lock slot)
      await this.subscriptionsService.recordJobPublished(
        jobId,
        companyId,
        manager,
      );
    });

    // --- REAL-TIME NOTIFICATION ---
    await this.notificationsService.createNotification({
      userId: job.employer.userId,
      type: NotificationType.JOB_APPROVAL,
      title: 'Tin tuyển dụng đã được duyệt',
      content: `Tin tuyển dụng "${job.title}" của bạn đã được quản trị viên phê duyệt và hiển thị công khai.`,
      metadata: {
        jobId: job.id,
        status: JobStatus.PUBLISHED,
      },
    });

    return { message: 'Đã duyệt tin tuyển dụng' };
  }

  async rejectJob(jobId: number, reason: string) {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['employer'],
    });
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

    // --- REAL-TIME NOTIFICATION ---
    await this.notificationsService.createNotification({
      userId: job.employer.userId,
      type: NotificationType.JOB_REJECTION,
      title: 'Tin tuyển dụng đã bị từ chối',
      content: `Tin tuyển dụng "${job.title}" của bạn không được phê duyệt. Lý do: ${reason}`,
      metadata: {
        jobId: job.id,
        status: JobStatus.REJECTED,
        reason,
      },
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
      qb.andWhere('(job.title ILIKE :keyword OR company.name ILIKE :keyword)', {
        keyword: `%${keyword}%`,
      });
    }

    if (status) {
      qb.andWhere('job.status = :status', { status });
    }

    if (filterDto.provinceId) {
      qb.andWhere('job.province_id = :provinceId', {
        provinceId: filterDto.provinceId,
      });
    }

    if (filterDto.categoryId) {
      qb.andWhere('job.category_id = :categoryId', {
        categoryId: filterDto.categoryId,
      });
    }

    if (filterDto.jobTypeId) {
      qb.andWhere('job.job_type_id = :jobTypeId', {
        jobTypeId: filterDto.jobTypeId,
      });
    }

    if (filterDto.levelId) {
      qb.andWhere('job.level_id = :levelId', { levelId: filterDto.levelId });
    }

    if (filterDto.requiredDegree) {
      qb.andWhere('job.required_degree = :degree', {
        degree: filterDto.requiredDegree,
      });
    }

    if (filterDto.salaryMin) {
      qb.andWhere('(job.salary_max >= :salaryMin OR job.hide_salary = true)', {
        salaryMin: filterDto.salaryMin,
      });
    }

    if (filterDto.salaryMax) {
      qb.andWhere('(job.salary_min <= :salaryMax OR job.hide_salary = true)', {
        salaryMax: filterDto.salaryMax,
      });
    }

    if (filterDto.maxYearsRequired) {
      qb.andWhere('job.years_of_experience <= :maxYears', {
        maxYears: filterDto.maxYearsRequired,
      });
    }

    const dateRange = filterDto.getDateRange?.();
    if (dateRange) {
      qb.andWhere('job.createdAt >= :startDate', {
        startDate: dateRange.startDate,
      });
      qb.andWhere('job.createdAt <= :endDate', { endDate: dateRange.endDate });
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

  async closeJob(jobId: number, reason: string) {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['employer'],
    });
    if (!job) throw new NotFoundException('Không tìm thấy tin');

    if (job.status === JobStatus.CLOSED) {
      throw new BadRequestException('Tin đã bị đóng trước đó');
    }

    const oldStatus = job.status;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(JobEntity, jobId, {
        status: JobStatus.CLOSED,
        rejectionReason: reason,
      });

      await manager.save(
        JobStatusHistoryEntity,
        manager.create(JobStatusHistoryEntity, {
          jobId,
          oldStatus,
          newStatus: JobStatus.CLOSED,
          reason,
        }),
      );
    });

    // Notify employer
    await this.notificationsService.createNotification({
      userId: job.employer.userId,
      type: NotificationType.JOB_REJECTION,
      title: 'Tin tuyển dụng đã bị đóng',
      content: `Tin tuyển dụng "${job.title}" đã bị quản trị viên đóng. Lý do: ${reason}`,
      metadata: { jobId: job.id, status: JobStatus.CLOSED, reason },
    });

    return { message: 'Đã đóng tin tuyển dụng' };
  }

  async getAdminJobStats() {
    const qb = this.jobRepository.createQueryBuilder('job');

    const [byStatus, total] = await Promise.all([
      qb
        .clone()
        .select('job.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('job.status')
        .getRawMany<{ status: string; count: string }>(),
      qb.clone().getCount(),
    ]);

    const stats = byStatus.reduce((acc: Record<string, number>, curr) => {
      acc[curr.status] = parseInt(curr.count, 10);
      return acc;
    }, {});

    return {
      total,
      published: stats[JobStatus.PUBLISHED] || 0,
      pending: stats[JobStatus.PENDING] || 0,
      draft: stats[JobStatus.DRAFT] || 0,
      rejected: stats[JobStatus.REJECTED] || 0,
      closed: stats[JobStatus.CLOSED] || 0,
    };
  }
}
