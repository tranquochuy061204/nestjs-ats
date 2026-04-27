import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditWalletEntity } from './entities/credit-wallet.entity';
import {
  CreditTransactionEntity,
  CreditTransactionType,
} from './entities/credit-transaction.entity';
import { CreditProductEntity } from './entities/credit-product.entity';
import { CreditPurchaseLogEntity } from './entities/credit-purchase-log.entity';
import { JobEntity } from '../jobs/entities/job.entity';

export interface ChargeCreditOptions {
  type: CreditTransactionType | string;
  description: string;
  referenceType?: string;
  referenceId?: number;
  createdBy?: number;
}

/**
 * Bảng nạp Credit — số Credit và bonus
 */
const CREDIT_TOPUP_PACKS = [
  { id: 'starter', creditBase: 100, bonus: 0, priceVnd: 100_000 },
  { id: 'plus', creditBase: 500, bonus: 50, priceVnd: 450_000 },
  { id: 'pro', creditBase: 1000, bonus: 200, priceVnd: 800_000 },
  { id: 'enterprise', creditBase: 5000, bonus: 1500, priceVnd: 3_500_000 },
] as const;

export type TopupPackId = (typeof CREDIT_TOPUP_PACKS)[number]['id'];

@Injectable()
export class CreditsService {
  private readonly logger = new Logger(CreditsService.name);

  constructor(
    @InjectRepository(CreditWalletEntity)
    private readonly walletRepo: Repository<CreditWalletEntity>,
    @InjectRepository(CreditTransactionEntity)
    private readonly txRepo: Repository<CreditTransactionEntity>,
    @InjectRepository(CreditProductEntity)
    private readonly productRepo: Repository<CreditProductEntity>,
    @InjectRepository(CreditPurchaseLogEntity)
    private readonly purchaseLogRepo: Repository<CreditPurchaseLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────────────
  // WALLET
  // ──────────────────────────────────────────────────────

  async getWallet(companyId: number): Promise<CreditWalletEntity> {
    let wallet = await this.walletRepo.findOne({ where: { companyId } });
    if (!wallet) {
      wallet = await this.walletRepo.save(
        this.walletRepo.create({ companyId, balance: 0 }),
      );
    }
    return wallet;
  }

  async getBalance(companyId: number): Promise<number> {
    const wallet = await this.getWallet(companyId);
    return wallet.balance;
  }

  // ──────────────────────────────────────────────────────
  // CHARGE (trừ Credit)
  // ──────────────────────────────────────────────────────

  /**
   * Trừ Credit từ ví của company. Ném BadRequestException nếu không đủ.
   * Dùng pessimistic lock để tránh race condition.
   */
  async chargeCredit(
    companyId: number,
    amount: number,
    options: ChargeCreditOptions,
  ): Promise<CreditTransactionEntity> {
    if (amount <= 0)
      throw new BadRequestException('Credit amount must be positive');

    return this.dataSource.transaction(async (manager) => {
      // Pessimistic write lock
      const wallet = await manager
        .getRepository(CreditWalletEntity)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.company_id = :companyId', { companyId })
        .getOne();

      if (!wallet) throw new NotFoundException('Credit wallet not found');
      if (wallet.balance < amount) {
        throw new BadRequestException(
          `Không đủ Credit (cần ${amount}, hiện có ${wallet.balance}). Vui lòng nạp thêm Credit.`,
        );
      }

      wallet.balance -= amount;
      wallet.totalSpent += amount;
      await manager.save(CreditWalletEntity, wallet);

      const tx = manager.create(CreditTransactionEntity, {
        walletId: wallet.id,
        type: options.type,
        amount: -amount,
        balanceAfter: wallet.balance,
        description: options.description,
        referenceType: options.referenceType ?? null,
        referenceId: options.referenceId ?? null,
        createdBy: options.createdBy ?? null,
      });

      return manager.save(CreditTransactionEntity, tx);
    });
  }

  // ──────────────────────────────────────────────────────
  // TOPUP (cộng Credit — gọi sau khi payment thành công)
  // ──────────────────────────────────────────────────────

  async topupCredit(
    companyId: number,
    packId: TopupPackId,
    paymentOrderId?: number,
  ): Promise<CreditTransactionEntity> {
    const pack = CREDIT_TOPUP_PACKS.find((p) => p.id === packId);
    if (!pack) throw new BadRequestException('Invalid topup pack');

    const totalCredit = pack.creditBase + pack.bonus;

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager
        .getRepository(CreditWalletEntity)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.company_id = :companyId', { companyId })
        .getOne();

      if (!wallet) {
        throw new NotFoundException('Credit wallet not found');
      }

      wallet.balance += totalCredit;
      wallet.totalEarned += totalCredit;
      await manager.save(CreditWalletEntity, wallet);

      const description =
        pack.bonus > 0
          ? `Nạp ${pack.creditBase} Credit (+ ${pack.bonus} bonus) — gói ${pack.id}`
          : `Nạp ${pack.creditBase} Credit — gói ${pack.id}`;

      const tx = manager.create(CreditTransactionEntity, {
        walletId: wallet.id,
        type: CreditTransactionType.TOPUP,
        amount: totalCredit,
        balanceAfter: wallet.balance,
        description,
        referenceType: paymentOrderId ? 'payment_order' : null,
        referenceId: paymentOrderId ?? null,
      });

      return manager.save(CreditTransactionEntity, tx);
    });
  }

  // ──────────────────────────────────────────────────────
  // PRODUCT PURCHASE
  // ──────────────────────────────────────────────────────

  async purchaseProduct(
    companyId: number,
    slug: string,
    targetJobId?: number,
    userId?: number,
  ): Promise<CreditPurchaseLogEntity> {
    const product = await this.productRepo.findOne({
      where: { slug, isActive: true },
    });
    if (!product) {
      throw new NotFoundException(`Sản phẩm '${slug}' không tồn tại`);
    }

    // [BUG#4 FIX] Sản phẩm scope=job bắt buộc targetJobId
    if (product.scope === 'job') {
      if (!targetJobId) {
        throw new BadRequestException(
          `Sản phẩm '${slug}' yêu cầu cung cấp targetJobId`,
        );
      }

      // [BUG#5 FIX] Kiểm tra job thuộc đúng company đang mua
      const jobOwnerCheck = await this.dataSource.query<{ id: number }[]>(
        `SELECT id FROM job WHERE id = $1 AND company_id = $2 LIMIT 1`,
        [targetJobId, companyId],
      );
      if (!jobOwnerCheck.length) {
        throw new BadRequestException(
          `Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn`,
        );
      }
    }

    // ── [BumpQuota FIX] Kiểm tra quota đẩy tin miễn phí cho VIP ──
    // Dùng raw query tránh circular dependency với SubscriptionsModule
    let usedFreeBumpQuota = false;
    if (slug === 'bump_post') {
      const rows = await this.dataSource.query<
        {
          used_bump_post_quota: number;
          bump_post_quota: number;
          subscription_id: number;
        }[]
      >(
        `SELECT cs.id AS subscription_id,
                cs.used_bump_post_quota,
                sp.bump_post_quota
         FROM company_subscription cs
         JOIN subscription_package sp ON sp.id = cs.package_id
         WHERE cs.company_id = $1 AND cs.status = 'active'
         ORDER BY cs.created_at DESC
         LIMIT 1`,
        [companyId],
      );

      if (rows.length) {
        const { used_bump_post_quota, bump_post_quota, subscription_id } =
          rows[0];
        if (bump_post_quota > 0 && used_bump_post_quota < bump_post_quota) {
          // Còn lượt miễn phí — tăng counter, không trừ Credit
          await this.dataSource.query(
            `UPDATE company_subscription
             SET used_bump_post_quota = used_bump_post_quota + 1
             WHERE id = $1`,
            [subscription_id],
          );
          usedFreeBumpQuota = true;
          this.logger.log(
            `bump_post: used free quota for company=${companyId} ` +
              `(${used_bump_post_quota + 1}/${bump_post_quota})`,
          );
        }
      }
    }
    // ─────────────────────────────────────────────────────────────

    return this.dataSource.transaction(async (manager) => {
      let creditSpent = product.creditCost;

      if (!usedFreeBumpQuota) {
        // Trừ Credit bình thường
        const wallet = await manager
          .getRepository(CreditWalletEntity)
          .createQueryBuilder('w')
          .setLock('pessimistic_write')
          .where('w.company_id = :companyId', { companyId })
          .getOne();

        if (!wallet) throw new NotFoundException('Credit wallet not found');
        if (wallet.balance < product.creditCost) {
          throw new BadRequestException(
            `Không đủ Credit (cần ${product.creditCost}, hiện có ${wallet.balance}). ` +
              `Lưu ý: Gói VIP được tặng ${product.creditCost > 0 ? 'quota bump miễn phí hàng tháng' : ''}.`,
          );
        }

        wallet.balance -= product.creditCost;
        wallet.totalSpent += product.creditCost;
        await manager.save(CreditWalletEntity, wallet);

        const tx = manager.create(CreditTransactionEntity, {
          walletId: wallet.id,
          type: CreditTransactionType.PURCHASE,
          amount: -product.creditCost,
          balanceAfter: wallet.balance,
          description: `Mua: ${product.displayName}`,
          referenceType: 'credit_product',
          referenceId: product.id,
          createdBy: userId ?? null,
        });
        await manager.save(CreditTransactionEntity, tx);
      } else {
        // Dùng free bump quota — ghi transaction 0 Credit để audit trail
        creditSpent = 0;
        const wallet = await manager
          .getRepository(CreditWalletEntity)
          .findOne({ where: { companyId } });

        if (wallet) {
          const tx = manager.create(CreditTransactionEntity, {
            walletId: wallet.id,
            type: CreditTransactionType.PURCHASE,
            amount: 0,
            balanceAfter: wallet.balance,
            description: `Mua: ${product.displayName} (Miễn phí — VIP Quota)`,
            referenceType: 'credit_product',
            referenceId: product.id,
            createdBy: userId ?? null,
          });
          await manager.save(CreditTransactionEntity, tx);
        }
      }

      // Ghi purchase log
      const expiresAt = product.durationDays
        ? new Date(Date.now() + product.durationDays * 24 * 60 * 60 * 1000)
        : null;

      const log = manager.create(CreditPurchaseLogEntity, {
        companyId,
        productId: product.id,
        creditSpent,
        targetJobId: targetJobId ?? null,
        activatedAt: new Date(),
        expiresAt,
      });

      const savedLog = await manager.save(CreditPurchaseLogEntity, log);

      // ── [Fix D+E] Apply side-effects within transaction ──────
      await this.applyProductSideEffect(
        manager,
        product.slug,
        targetJobId ?? null,
        expiresAt,
      );

      return savedLog;
    });
  }

  /**
   * [Fix D+E] Apply actual side-effects after credit purchase.
   * Runs inside the purchase transaction for atomicity.
   */
  private async applyProductSideEffect(
    manager: import('typeorm').EntityManager,
    slug: string,
    targetJobId: number | null,
    expiresAt: Date | null,
  ): Promise<void> {
    switch (slug) {
      case 'bump_post': {
        if (!targetJobId) break;
        await manager.update(JobEntity, targetJobId, {
          isBumped: true,
          bumpedUntil: expiresAt,
        });
        this.logger.log(
          `bump_post applied: job=${targetJobId} until=${expiresAt?.toISOString()}`,
        );
        break;
      }

      case 'extend_job': {
        if (!targetJobId) break;
        const job = await manager.findOne(JobEntity, {
          where: { id: targetJobId },
          select: ['id', 'deadline'],
        });
        if (job) {
          // Nếu job chưa có deadline hoặc đã hết hạn → lấy từ now()
          const baseDate =
            job.deadline && new Date(job.deadline) > new Date()
              ? new Date(job.deadline)
              : new Date();
          // durationDays đã được lưu ở expiresAt — tính ngược lại
          const durationMs = expiresAt
            ? expiresAt.getTime() - Date.now()
            : 15 * 24 * 60 * 60 * 1000; // default 15 ngày
          const newDeadline = new Date(baseDate.getTime() + durationMs);
          await manager.update(JobEntity, targetJobId, {
            deadline: newDeadline,
          });
          this.logger.log(
            `extend_job applied: job=${targetJobId} newDeadline=${newDeadline.toISOString()}`,
          );
        }
        break;
      }

      case 'extra_job_slot': {
        // extra_job_slot không cần mutate entity.
        // Slot thêm được tính bằng đếm active purchase_log tại checkJobSlotLock().
        this.logger.log(
          `extra_job_slot purchased for company (tracked via purchase_log)`,
        );
        break;
      }

      default:
        // Các sản phẩm khác (ai_scoring, export_report...) chưa cần side-effect
        break;
    }
  }

  /**
   * Đếm số extra_job_slot đang active (chưa hết hạn) của company.
   * Được gọi bởi SubscriptionsService.checkJobSlotLock() để cộng vào maxActiveJobs.
   */
  async getExtraJobSlots(companyId: number): Promise<number> {
    return this.purchaseLogRepo
      .createQueryBuilder('pl')
      .innerJoin('pl.product', 'p')
      .where('pl.company_id = :companyId', { companyId })
      .andWhere("p.slug = 'extra_job_slot'")
      .andWhere('(pl.expires_at IS NULL OR pl.expires_at > NOW())')
      .getCount();
  }

  // ──────────────────────────────────────────────────────
  // ADMIN: cộng / trừ thủ công
  // ──────────────────────────────────────────────────────

  async adminAdjust(
    companyId: number,
    amount: number,
    description: string,
    adminUserId: number,
  ): Promise<CreditTransactionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager
        .getRepository(CreditWalletEntity)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.company_id = :companyId', { companyId })
        .getOne();

      if (!wallet) throw new NotFoundException('Wallet not found');
      wallet.balance += amount;
      if (amount > 0) wallet.totalEarned += amount;
      else wallet.totalSpent += Math.abs(amount);
      await manager.save(CreditWalletEntity, wallet);

      const tx = manager.create(CreditTransactionEntity, {
        walletId: wallet.id,
        type: CreditTransactionType.ADMIN_ADJUST,
        amount,
        balanceAfter: wallet.balance,
        description,
        createdBy: adminUserId,
      });
      return manager.save(CreditTransactionEntity, tx);
    });
  }

  // ──────────────────────────────────────────────────────
  // TOPUP PACKS (expose to controller)
  // ──────────────────────────────────────────────────────

  getTopupPacks() {
    return CREDIT_TOPUP_PACKS;
  }

  /** Trả về danh sách credit product đang active (cho FE hiển thị cửa hàng) */
  async getAvailableProducts() {
    return this.productRepo.find({
      where: { isActive: true },
      order: { creditCost: 'ASC' },
    });
  }

  async getTransactionHistory(companyId: number, page = 1, limit = 20) {
    const wallet = await this.getWallet(companyId);
    const [data, total] = await this.txRepo.findAndCount({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }
}
