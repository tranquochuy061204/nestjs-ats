import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { JobStatusHistoryEntity } from '../entities/job-status-history.entity';

@Injectable()
export class JobTasksService {
  private readonly logger = new Logger(JobTasksService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
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

      const CHUNK_SIZE = 100;
      for (let i = 0; i < overdueJobs.length; i += CHUNK_SIZE) {
        const chunk = overdueJobs.slice(i, i + CHUNK_SIZE);
        const jobIds = chunk.map((j) => j.id);

        await this.dataSource.transaction(async (manager) => {
          await manager.update(
            JobEntity,
            { id: In(jobIds) },
            { status: JobStatus.CLOSED },
          );

          const histories = chunk.map((j) =>
            manager.create(JobStatusHistoryEntity, {
              jobId: j.id,
              oldStatus: j.status,
              newStatus: JobStatus.CLOSED,
              reason: 'Tự động đóng do quá hạn nộp hồ sơ',
            }),
          );

          await manager.insert(JobStatusHistoryEntity, histories);
        });
      }

      this.logger.log(`Closed ${overdueJobs.length} overdue jobs.`);
    } catch (error) {
      this.logger.error(
        'Failed to handle overdue jobs',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
