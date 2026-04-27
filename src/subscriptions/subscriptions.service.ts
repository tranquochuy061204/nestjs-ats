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
import { CreditPurchaseLogEntity } from '../credits/entities/credit-purchase-log.entity';

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
    @InjectRepository(CreditPurchaseLogEntity)
    private readonly purchaseLogRepo: Repository<CreditPurchaseLogEntity>,
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

    // Đếm số extra_job_slot đang active (mua bằng Credit)
    const extraSlots = await this.purchaseLogRepo
      .createQueryBuilder('pl')
      .innerJoin('pl.product', 'p')
      .where('pl.company_id = :companyId', { companyId })
      .andWhere("p.slug = 'extra_job_slot'")
      .andWhere('(pl.expires_at IS NULL OR pl.expires_at > NOW())')
      .getCount();

    const effectiveMaxJobs = pkg.maxActiveJobs === -1
      ? -1
      : pkg.maxActiveJobs + extraSlots;

    // [BUG#7 FIX] -1 = unlimited (VIP) — bỏ qua check quota
    if (effectiveMaxJobs !== -1 && currentActiveJobs >= effectiveMaxJobs) {
      return {
        canPost: false,
        unlocksAt: null,
        currentActiveJobs,
        maxActiveJobs: effectiveMaxJobs,
      };
    }

    return {
      canPost: true,
      unlocksAt: null,
      currentActiveJobs,
      maxActiveJobs: effectiveMaxJobs,
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
   * Dùng atomic SQL UPDATE ... RETURNING để tránh race condition.
   * Ném BadRequestException nếu vượt giới hạn.
   */
  async incrementDailyProcessedCount(companyId: number): Promise<void> {
    const { subscription, package: pkg } = await this.getActiveSubscription(companyId);

    // -1 = unlimited (VIP)
    if (pkg.dailyApplicationProcessLimit === -1) return;

    const today = new Date().toISOString().slice(0, 10);

    // [BUG#6 FIX] Atomic: reset nếu sang ngày mới + tăng counter trong 1 câu SQL duy nhất
    // RETURNING cho phép đọc giá trị hậu-update mà không cần query lại
    const result = await this.dataSource.query<{ daily_processed_count: number }[]>(
      `UPDATE company_subscription
       SET
         daily_processed_count = CASE
           WHEN daily_processed_date IS DISTINCT FROM $1::date THEN 1
           ELSE daily_processed_count + 1
         END,
         daily_processed_date = $1::date
       WHERE id = $2
       RETURNING daily_processed_count`,
      [today, subscription.id],
    );

    const newCount = result[0]?.daily_processed_count ?? 1;

    if (newCount > pkg.dailyApplicationProcessLimit) {
      // Đã vượt giới hạn sau khi tăng — rollback bằng cách trừ lại (để giữ atomic)
      await this.dataSource.query(
        `UPDATE company_subscription SET daily_processed_count = daily_processed_count - 1 WHERE id = $1`,
        [subscription.id],
      );
      throw new BadRequestException(
        `Bạn đã đạt giới hạn xử lý ${pkg.dailyApplicationProcessLimit} đơn/ngày. Nâng cấp VIP để không giới hạn.`,
      );
    }
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
