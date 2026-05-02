import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreditWalletEntity } from './entities/credit-wallet.entity';
import {
  CreditTransactionEntity,
  CreditTransactionType,
} from './entities/credit-transaction.entity';
import { CreditProductEntity } from './entities/credit-product.entity';
import { CreditPurchaseLogEntity } from './entities/credit-purchase-log.entity';
import { CreditPackageEntity } from './entities/credit-package.entity';
import { JobEntity } from '../jobs/entities/job.entity';
import { ChargeCreditOptions } from './interfaces/credits.interface';

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
    @InjectRepository(CreditPackageEntity)
    private readonly packageRepo: Repository<CreditPackageEntity>,
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
    return this.dataSource.transaction(async (manager) => {
      return this.chargeCreditWithManager(manager, companyId, amount, options);
    });
  }

  async chargeCreditWithManager(
    manager: EntityManager,
    companyId: number,
    amount: number,
    options: ChargeCreditOptions,
  ): Promise<CreditTransactionEntity> {
    if (amount <= 0)
      throw new BadRequestException('Credit amount must be positive');

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
  }

  // ──────────────────────────────────────────────────────
  // TOPUP (cộng Credit — gọi sau khi payment thành công)
  // ──────────────────────────────────────────────────────

  async topupCredit(
    companyId: number,
    packSlug: string,
    paymentOrderId?: number,
  ): Promise<CreditTransactionEntity> {
    const pack = await this.packageRepo.findOne({ where: { slug: packSlug } });
    if (!pack) throw new BadRequestException('Gói nạp không tồn tại');

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
          ? `Nạp ${pack.creditBase} Credit (+ ${pack.bonus} bonus) — gói ${pack.slug}`
          : `Nạp ${pack.creditBase} Credit — gói ${pack.slug}`;

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
    if (slug === 'bump_post') {
      throw new BadRequestException(
        'Vui lòng sử dụng tính năng Đẩy Tin trong trang quản lý tin tuyển dụng thay vì mua trực tiếp.',
      );
    }

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

    return this.dataSource.transaction(async (manager) => {
      const creditSpent = product.creditCost;

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

  async getTopupPacks() {
    return this.packageRepo.find({
      where: { isActive: true },
      order: { priceVnd: 'ASC' },
    });
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

  // ──────────────────────────────────────────────────────
  // SPECIALIZED PURCHASES
  // ──────────────────────────────────────────────────────

  async spendCreditsWithManager(
    manager: import('typeorm').EntityManager,
    companyId: number,
    slug: string,
    userId: number,
    targetJobId?: number,
  ): Promise<{ creditsSpent: number; purchaseLogId: number }> {
    const product = await manager.findOne(CreditProductEntity, {
      where: { slug, isActive: true },
    });
    if (!product)
      throw new NotFoundException(`Sản phẩm '${slug}' không tồn tại`);

    const wallet = await manager
      .getRepository(CreditWalletEntity)
      .createQueryBuilder('w')
      .setLock('pessimistic_write')
      .where('w.company_id = :companyId', { companyId })
      .getOne();

    if (!wallet) throw new NotFoundException('Credit wallet not found');
    if (wallet.balance < product.creditCost) {
      throw new BadRequestException(
        `Không đủ Credit (cần ${product.creditCost}, hiện có ${wallet.balance}).`,
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
      createdBy: userId,
    });
    await manager.save(CreditTransactionEntity, tx);

    const expiresAt = product.durationDays
      ? new Date(Date.now() + product.durationDays * 24 * 60 * 60 * 1000)
      : null;

    const log = manager.create(CreditPurchaseLogEntity, {
      companyId,
      productId: product.id,
      creditSpent: product.creditCost,
      targetJobId: targetJobId ?? null,
      activatedAt: new Date(),
      expiresAt,
    });
    const savedLog = await manager.save(CreditPurchaseLogEntity, log);

    return { creditsSpent: product.creditCost, purchaseLogId: savedLog.id };
  }
}
