import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { CreditsService } from '../../credits/credits.service';
import { BumpJobResult } from '../interfaces/job-bump.interface';

@Injectable()
export class EmployerJobBumpService {
  private readonly logger = new Logger(EmployerJobBumpService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource,
  ) {}

  async bumpJob(employerUserId: number, jobId: number): Promise<BumpJobResult> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['company', 'employer'],
    });

    if (!job) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng');
    }

    if (job.employer.userId !== employerUserId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên tin này');
    }

    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Chỉ có thể đẩy tin đang được hiển thị (Published)',
      );
    }

    const now = new Date();

    if (job.isBumped && job.bumpedUntil && job.bumpedUntil > now) {
      throw new BadRequestException('Tin tuyển dụng này đang được đẩy rồi.');
    }

    if (job.deadline) {
      const msToDeadline = job.deadline.getTime() - now.getTime();
      if (msToDeadline < 24 * 60 * 60 * 1000) {
        throw new BadRequestException(
          'Tin tuyển dụng sắp hết hạn (dưới 24h), không thể đẩy tin.',
        );
      }
    }

    // CLAMP Logic: MIN(now + 3 days, job.deadline)
    const bumpDurationDays = 3;
    let bumpedUntil = new Date(
      now.getTime() + bumpDurationDays * 24 * 60 * 60 * 1000,
    );
    if (job.deadline && bumpedUntil > job.deadline) {
      bumpedUntil = job.deadline;
    }

    const { subscription, package: pkg } =
      await this.subscriptionsService.getActiveSubscription(job.companyId);

    let source: 'quota' | 'credit' = 'credit';
    let quotaRemaining = 0;
    let creditsSpent = 0;

    // Resolve source
    // On-the-fly reset check for quota reading
    let currentUsed = subscription.usedBumpPostQuota;
    if (subscription.bumpQuotaResetAt && subscription.bumpQuotaResetAt < now) {
      currentUsed = 0;
    }

    if (pkg.bumpPostQuota > 0 && currentUsed < pkg.bumpPostQuota) {
      source = 'quota';
    }

    // Execute
    await this.dataSource.transaction(async (manager) => {
      if (source === 'quota') {
        quotaRemaining =
          await this.subscriptionsService.consumeBumpPostQuotaWithManager(
            manager,
            subscription.id,
            pkg.bumpPostQuota,
          );
      } else {
        const result = await this.creditsService.spendCreditsWithManager(
          manager,
          job.companyId,
          'bump_post',
          employerUserId, // Use user ID as actor for transaction
        );
        creditsSpent = result.creditsSpent;
      }

      await manager.update(JobEntity, job.id, {
        isBumped: true,
        bumpedUntil,
        bumpedAt: new Date(),
      });
    });

    return {
      message: 'Đẩy tin thành công',
      bumpedUntil,
      source,
      creditsSpent,
      quotaRemaining,
    };
  }
}
