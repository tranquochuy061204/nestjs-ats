import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CompanySubscriptionEntity, SubscriptionStatus } from './entities/company-subscription.entity';
import { SubscriptionPackageEntity } from './entities/subscription-package.entity';

export interface ActiveSubscription {
  subscription: CompanySubscriptionEntity;
  package: SubscriptionPackageEntity;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(CompanySubscriptionEntity)
    private readonly subscriptionRepo: Repository<CompanySubscriptionEntity>,
    @InjectRepository(SubscriptionPackageEntity)
    private readonly packageRepo: Repository<SubscriptionPackageEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────────────
  // QUERY HELPERS (dùng bởi các module khác)
  // ──────────────────────────────────────────────────────

  /**
   * Lấy subscription active của company. Tự động tạo Free nếu chưa có.
   */
  async getActiveSubscription(companyId: number): Promise<ActiveSubscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { companyId, status: SubscriptionStatus.ACTIVE },
      relations: ['package'],
      order: { createdAt: 'DESC' },
    });

    if (!subscription) {
      return this.assignFreePackage(companyId);
    }

    // Check xem VIP có hết hạn không
    if (
      subscription.package.name !== 'free' &&
      subscription.endDate &&
      new Date() > subscription.endDate
    ) {
      await this.expireAndFallbackToFree(subscription);
      return this.getActiveSubscription(companyId);
    }

    return { subscription, package: subscription.package };
  }

  /**
   * Kiểm tra feature bật/tắt. Dùng trong guard.
   */
  async canUseFeature(
    companyId: number,
    featureKey: keyof SubscriptionPackageEntity,
  ): Promise<boolean> {
    const { package: pkg } = await this.getActiveSubscription(companyId);
    return !!pkg[featureKey];
  }

  /**
   * Tính phí Pipeline Fee (thu 1 lần duy nhất khi qua khỏi vòng Applied).
   */
  async calculateProceedFee(
    companyId: number,
    oldStatus: string,
    newStatus: string,
  ): Promise<{ creditCost: number; isFree: boolean; useFreeProceed: boolean }> {
    // Chỉ thu tiền khi ứng viên rời khỏi cột APPLIED sang các cột tiến trình (trừ REJECTED / WITHDRAWN)
    const isFirstTimeProceed = oldStatus === 'applied';
    const isRejectedOrWithdrawn = newStatus === 'rejected' || newStatus === 'withdrawn';

    // Nếu không phải lần đầu pass, hoặc pass vào cột từ chối => Miễn phí (không thu charge, không cần check VIP quota)
    if (!isFirstTimeProceed || isRejectedOrWithdrawn) {
      return { creditCost: 0, isFree: true, useFreeProceed: false };
    }

    const { subscription, package: pkg } = await this.getActiveSubscription(companyId);

    // VIP với free proceeds còn
    if (
      pkg.monthlyFreeProceeds > 0 &&
      subscription.usedFreeProceeds < pkg.monthlyFreeProceeds
    ) {
      return { creditCost: 0, isFree: false, useFreeProceed: true };
    }

    // Nếu đã hết Quota Free Proceed hoặc gói Free => Thu cứng 10 Credit
    return { creditCost: 10, isFree: false, useFreeProceed: false };
  }

  /**
   * Ghi nhận đã dùng 1 free proceed (VIP).
   */
  async consumeFreeProceed(companyId: number): Promise<void> {
    await this.subscriptionRepo
      .createQueryBuilder()
      .update(CompanySubscriptionEntity)
      .set({ usedFreeProceeds: () => '"used_free_proceeds" + 1' })
      .where('company_id = :companyId', { companyId })
      .andWhere('status = :status', { status: SubscriptionStatus.ACTIVE })
      .execute();
  }

  /**
   * Kiểm tra Free job slot lock 7 ngày.
   * Trả về { canPost, unlocksAt } — unlocksAt là khi nào được đăng tiếp.
   */
  async checkJobSlotLock(companyId: number): Promise<{
    canPost: boolean;
    unlocksAt: Date | null;
    currentActiveJobs: number;
    maxActiveJobs: number;
  }> {
    const { subscription, package: pkg } = await this.getActiveSubscription(companyId);

    // Đếm số tin đang active
    const activeJobsCount = await this.dataSource.query<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM "job" WHERE "company_id" = $1 AND "status" = 'published'`,
      [companyId],
    );
    const currentActiveJobs = parseInt(activeJobsCount[0]?.count ?? '0', 10);

    // Free: hard lock 7 ngày
    if (pkg.name === 'free' && subscription.lastJobPublishedAt) {
      const lockMs = pkg.jobDurationDays * 24 * 60 * 60 * 1000;
      const unlocksAt = new Date(subscription.lastJobPublishedAt.getTime() + lockMs);
      if (new Date() < unlocksAt) {
        return {
          canPost: false,
          unlocksAt,
          currentActiveJobs,
          maxActiveJobs: pkg.maxActiveJobs,
        };
      }
    }

    // Check số lượng tin active so với quota
    if (currentActiveJobs >= pkg.maxActiveJobs) {
      return {
        canPost: false,
        unlocksAt: null,
        currentActiveJobs,
        maxActiveJobs: pkg.maxActiveJobs,
      };
    }

    return {
      canPost: true,
      unlocksAt: null,
      currentActiveJobs,
      maxActiveJobs: pkg.maxActiveJobs,
    };
  }

  /**
   * Ghi nhận đã đăng tin (cập nhật last_job_published_at).
   */
  async recordJobPublished(companyId: number): Promise<void> {
    await this.subscriptionRepo.update(
      { companyId, status: SubscriptionStatus.ACTIVE },
      { lastJobPublishedAt: new Date() },
    );
  }

  /**
   * Reset daily processed count nếu sang ngày mới.
   */
  async checkAndResetDailyCount(companyId: number): Promise<void> {
    const { subscription } = await this.getActiveSubscription(companyId);
    const today = new Date().toISOString().slice(0, 10);

    if (subscription.dailyProcessedDate !== today) {
      await this.subscriptionRepo.update(subscription.id, {
        dailyProcessedCount: 0,
        dailyProcessedDate: today,
      });
    }
  }

  /**
   * Tăng daily processed counter và check limit.
   * Ném BadRequestException nếu vượt giới hạn.
   */
  async incrementDailyProcessedCount(companyId: number): Promise<void> {
    await this.checkAndResetDailyCount(companyId);

    const { subscription, package: pkg } = await this.getActiveSubscription(companyId);

    // -1 = unlimited (VIP)
    if (pkg.dailyApplicationProcessLimit === -1) return;

    if (subscription.dailyProcessedCount >= pkg.dailyApplicationProcessLimit) {
      throw new BadRequestException(
        `Bạn đã đạt giới hạn xử lý ${pkg.dailyApplicationProcessLimit} đơn/ngày. Nâng cấp VIP để không giới hạn.`,
      );
    }

    await this.subscriptionRepo.update(subscription.id, {
      dailyProcessedCount: () => '"daily_processed_count" + 1',
    });
  }

  // ──────────────────────────────────────────────────────
  // ADMIN APIs
  // ──────────────────────────────────────────────────────

  async getAllPackages(): Promise<SubscriptionPackageEntity[]> {
    return this.packageRepo.find({ order: { price: 'ASC' } });
  }

  async getCompanySubscription(companyId: number): Promise<ActiveSubscription> {
    return this.getActiveSubscription(companyId);
  }

  /**
   * Kích hoạt VIP cho company (gọi sau khi thanh toán thành công).
   */
  async activateVip(companyId: number): Promise<CompanySubscriptionEntity> {
    const vipPkg = await this.packageRepo.findOne({ where: { name: 'vip' } });
    if (!vipPkg) throw new NotFoundException('VIP package not found');

    return this.dataSource.transaction(async (manager) => {
      // Cancel tất cả subscription cũ
      await manager.update(
        CompanySubscriptionEntity,
        { companyId, status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.CANCELLED },
      );

      const now = new Date();
      const endDate = new Date(now.getTime() + vipPkg.durationDays * 24 * 60 * 60 * 1000);

      const newSub = manager.create(CompanySubscriptionEntity, {
        companyId,
        packageId: vipPkg.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        usedFreeProceeds: 0,
        proceedsResetAt: endDate,
      });

      return manager.save(CompanySubscriptionEntity, newSub);
    });
  }

  // ──────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────

  private async assignFreePackage(companyId: number): Promise<ActiveSubscription> {
    const freePkg = await this.packageRepo.findOne({ where: { name: 'free' } });
    if (!freePkg) throw new NotFoundException('Free package not found in DB. Run migrations.');

    const newSub = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        companyId,
        packageId: freePkg.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate: null,
      }),
    );
    newSub.package = freePkg;
    return { subscription: newSub, package: freePkg };
  }

  private async expireAndFallbackToFree(
    expired: CompanySubscriptionEntity,
  ): Promise<void> {
    await this.subscriptionRepo.update(expired.id, {
      status: SubscriptionStatus.EXPIRED,
    });
    await this.assignFreePackage(expired.companyId);
    this.logger.log(
      `VIP expired for company ${expired.companyId}, fell back to Free`,
    );
  }
}
