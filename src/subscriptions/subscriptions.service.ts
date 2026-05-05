import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  CompanySubscriptionEntity,
  SubscriptionStatus,
} from './entities/company-subscription.entity';
import { SubscriptionPackageEntity } from './entities/subscription-package.entity';
import { CreditPurchaseLogEntity } from '../credits/entities/credit-purchase-log.entity';
import { ActiveSubscription } from './interfaces/subscriptions.interface';
import { JobEntity, JobStatus } from '../jobs/entities/job.entity';

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
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
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

    const updatedSub = await this.checkAndResetMonthlyProceeds(subscription);

    const extraSlots = await this.purchaseLogRepo
      .createQueryBuilder('pl')
      .innerJoin('pl.product', 'p')
      .where('pl.company_id = :companyId', { companyId })
      .andWhere("p.slug = 'extra_job_slot'")
      .andWhere('(pl.expires_at IS NULL OR pl.expires_at > NOW())')
      .getCount();

    const effectiveMaxJobs =
      subscription.package.maxActiveJobs === -1
        ? -1
        : subscription.package.maxActiveJobs + extraSlots;

    return {
      subscription: updatedSub,
      package: subscription.package,
      extraSlots,
      effectiveMaxJobs,
    };
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
    const isRejectedOrWithdrawn =
      newStatus === 'rejected' || newStatus === 'withdrawn';

    // Nếu không phải lần đầu pass, hoặc pass vào cột từ chối => Miễn phí (không thu charge, không cần check VIP quota)
    if (!isFirstTimeProceed || isRejectedOrWithdrawn) {
      return { creditCost: 0, isFree: true, useFreeProceed: false };
    }

    const { subscription, package: pkg } =
      await this.getActiveSubscription(companyId);

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
   * Trừ 1 quota bump tin miễn phí (trong transaction).
   */
  async consumeBumpPostQuotaWithManager(
    manager: EntityManager,
    subscriptionId: number,
    maxQuota: number,
  ): Promise<number> {
    const result = await manager.query<{ used_bump_post_quota: number }[]>(
      `UPDATE company_subscription
       SET
         used_bump_post_quota = CASE
           WHEN bump_quota_reset_at IS NULL OR bump_quota_reset_at < NOW() THEN 1
           ELSE used_bump_post_quota + 1
         END,
         bump_quota_reset_at = CASE
           WHEN bump_quota_reset_at IS NULL OR bump_quota_reset_at < NOW() THEN NOW() + INTERVAL '30 days'
           ELSE bump_quota_reset_at
         END
       WHERE id = $1
       RETURNING used_bump_post_quota`,
      [subscriptionId],
    );

    const newUsed = result[0]?.used_bump_post_quota ?? 1;
    return Math.max(0, maxQuota - newUsed);
  }

  /**
   * Kiểm tra quota đăng tin trước khi publish/pending.
   *
   * Chính sách Free (chưa VIP):
   *  - Tại một thời điểm chỉ được có đúng 1 tin (pending HOẶC published).
   *  - Nếu đang có 1 published → không được gửi pending.
   *  - Nếu đang có 1 pending chờ duyệt → không được gửi thêm.
   *  - Sau khi tin bị rejected/closed, slot được giải phóng ngay.
   *
   * Trả về { canPost, unlocksAt, blockReason, currentActiveJobs, maxActiveJobs }
   */
  async checkJobSlotLock(companyId: number): Promise<{
    canPost: boolean;
    unlocksAt: Date | null;
    blockReason:
      | 'has_published'
      | 'has_pending'
      | 'quota_full'
      | 'time_lock'
      | null;
    currentActiveJobs: number;
    maxActiveJobs: number;
    slotDetails: Array<{
      type: 'occupied' | 'locked' | 'available';
      jobId?: number;
      jobTitle?: string;
      unlocksAt?: Date;
    }>;
  }> {
    const { package: pkg } = await this.getActiveSubscription(companyId);

    // ── Unified Slot Logic (Detailed Slot Mapping) ──
    const extraSlots = await this.purchaseLogRepo
      .createQueryBuilder('pl')
      .innerJoin('pl.product', 'p')
      .where('pl.company_id = :companyId', { companyId })
      .andWhere("p.slug = 'extra_job_slot'")
      .andWhere('(pl.expires_at IS NULL OR pl.expires_at > NOW())')
      .getCount();

    const effectiveMaxJobs =
      pkg.maxActiveJobs === -1 ? -1 : pkg.maxActiveJobs + extraSlots;

    // 1. Lấy danh sách các tin đang chiếm dụng slot (pending/published)
    const activeJobs = await this.jobRepo.find({
      where: {
        companyId,
        status: In([JobStatus.PENDING, JobStatus.PUBLISHED]),
      },
      select: ['id', 'title', 'status', 'publishedAt'],
      order: { publishedAt: 'ASC' },
    });

    // 2. Lấy danh sách các tin đã đóng nhưng vẫn còn trong thời gian lock
    const lockedJobs = await this.jobRepo
      .createQueryBuilder('j')
      .where('j.company_id = :companyId', { companyId })
      .andWhere("j.status NOT IN ('pending', 'published')")
      .andWhere(`j.published_at + (INTERVAL '1 day' * :days) > NOW()`, {
        days: pkg.jobDurationDays,
      })
      .orderBy('j.published_at', 'ASC')
      .getMany();

    const slotDetails: Array<{
      type: 'occupied' | 'locked' | 'available';
      jobId?: number;
      jobTitle?: string;
      unlocksAt?: Date;
    }> = [];

    // Điền các slot đang bận
    activeJobs.forEach((j) => {
      slotDetails.push({
        type: 'occupied',
        jobId: j.id,
        jobTitle: j.title,
      });
    });

    // Điền các slot đang bị lock
    lockedJobs.forEach((j) => {
      if (effectiveMaxJobs === -1 || slotDetails.length < effectiveMaxJobs) {
        slotDetails.push({
          type: 'locked',
          jobId: j.id,
          jobTitle: j.title,
          unlocksAt: j.publishedAt
            ? new Date(j.publishedAt.getTime() + pkg.jobDurationDays * 86400000)
            : undefined,
        });
      }
    });

    // Điền các slot còn trống
    if (effectiveMaxJobs !== -1) {
      while (slotDetails.length < effectiveMaxJobs) {
        slotDetails.push({ type: 'available' });
      }
    }

    const canPost =
      effectiveMaxJobs === -1 ||
      slotDetails.some((s) => s.type === 'available');

    // Tìm thời điểm mở khóa gần nhất nếu hết slot
    const firstLock = slotDetails
      .filter((s) => s.type === 'locked')
      .sort(
        (a, b) => (a.unlocksAt?.getTime() || 0) - (b.unlocksAt?.getTime() || 0),
      )[0];

    return {
      canPost,
      unlocksAt: firstLock?.unlocksAt || null,
      blockReason: canPost
        ? null
        : pkg.name === 'free'
          ? activeJobs.some((j) => j.status === JobStatus.PUBLISHED)
            ? 'has_published'
            : 'time_lock'
          : 'quota_full',
      currentActiveJobs: activeJobs.length,
      maxActiveJobs: effectiveMaxJobs,
      slotDetails, // Thông tin chi tiết cho UI
    };
  }

  /**
   * Ghi nhận đã submit tin (cập nhật last_job_published_at).
   * Gọi khi tin chuyển sang PUBLISHED hoặc PENDING để lock thời gian cho Free.
   */
  async recordJobPublished(
    jobId: number,
    companyId: number,
    manager?: EntityManager,
  ): Promise<void> {
    const jobRepo = manager ? manager.getRepository(JobEntity) : this.jobRepo;
    const subRepo = manager
      ? manager.getRepository(CompanySubscriptionEntity)
      : this.subscriptionRepo;

    await jobRepo.update(jobId, { publishedAt: new Date() });
    await subRepo.update(
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
    const { subscription, package: pkg } =
      await this.getActiveSubscription(companyId);

    // -1 = unlimited (VIP)
    if (pkg.dailyApplicationProcessLimit === -1) return;

    const today = new Date().toISOString().slice(0, 10);

    // [BUG#6 FIX] Atomic: reset nếu sang ngày mới + tăng counter trong 1 câu SQL duy nhất
    // RETURNING cho phép đọc giá trị hậu-update mà không cần query lại
    const result = await this.dataSource.query<
      { daily_processed_count: number }[]
    >(
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

  async getPackageByName(
    name: string,
  ): Promise<SubscriptionPackageEntity | null> {
    return this.packageRepo.findOne({ where: { name } });
  }

  async getCompanySubscription(
    companyId: number,
  ): Promise<ActiveSubscription & { slotLock: any }> {
    const active = await this.getActiveSubscription(companyId);
    const slotLock = await this.checkJobSlotLock(companyId);
    return {
      ...active,
      slotLock,
    };
  }

  /**
   * Kích hoạt VIP cho company (gọi sau khi thanh toán thành công).
   */
  async activateVip(companyId: number): Promise<CompanySubscriptionEntity> {
    const vipPkg = await this.packageRepo.findOne({ where: { name: 'vip' } });
    if (!vipPkg) throw new NotFoundException('VIP package not found');

    return this.dataSource.transaction(async (manager) => {
      const activeSub = await manager.findOne(CompanySubscriptionEntity, {
        where: { companyId, status: SubscriptionStatus.ACTIVE },
        relations: ['package'],
      });

      let baseDate = new Date();

      // Nếu có gói VIP đang active và chưa hết hạn, cộng dồn từ endDate hiện tại
      if (
        activeSub &&
        activeSub.package.name === 'vip' &&
        activeSub.endDate &&
        activeSub.endDate > baseDate
      ) {
        baseDate = activeSub.endDate;
      }

      const endDate = new Date(
        baseDate.getTime() + vipPkg.durationDays * 24 * 60 * 60 * 1000,
      );

      // Cancel tất cả subscription cũ
      await manager.update(
        CompanySubscriptionEntity,
        { companyId, status: SubscriptionStatus.ACTIVE },
        { status: SubscriptionStatus.CANCELLED },
      );

      const now = new Date();

      const newSub = manager.create(CompanySubscriptionEntity, {
        companyId,
        packageId: vipPkg.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        usedFreeProceeds: 0,
        proceedsResetAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      return manager.save(CompanySubscriptionEntity, newSub);
    });
  }

  // ──────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────

  private async assignFreePackage(
    companyId: number,
  ): Promise<ActiveSubscription> {
    const freePkg = await this.packageRepo.findOne({ where: { name: 'free' } });
    if (!freePkg)
      throw new NotFoundException(
        'Free package not found in DB. Run migrations.',
      );

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
    return {
      subscription: newSub,
      package: freePkg,
      extraSlots: 0,
      effectiveMaxJobs: freePkg.maxActiveJobs,
    };
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

  private async checkAndResetMonthlyProceeds(
    subscription: CompanySubscriptionEntity,
  ): Promise<CompanySubscriptionEntity> {
    if (
      subscription.proceedsResetAt &&
      new Date() > subscription.proceedsResetAt
    ) {
      let nextReset = new Date(subscription.proceedsResetAt.getTime());
      const now = new Date();
      while (nextReset <= now) {
        nextReset = new Date(nextReset.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      await this.subscriptionRepo.update(subscription.id, {
        usedFreeProceeds: 0,
        proceedsResetAt: nextReset,
      });

      subscription.usedFreeProceeds = 0;
      subscription.proceedsResetAt = nextReset;
    }
    return subscription;
  }
}
