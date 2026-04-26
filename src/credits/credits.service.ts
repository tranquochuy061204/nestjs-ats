import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditWalletEntity } from './entities/credit-wallet.entity';
import { CreditTransactionEntity, CreditTransactionType } from './entities/credit-transaction.entity';
import { CreditProductEntity } from './entities/credit-product.entity';
import { CreditPurchaseLogEntity } from './entities/credit-purchase-log.entity';

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
  { id: 'starter',    creditBase: 100,  bonus: 0,    priceVnd: 100_000 },
  { id: 'plus',       creditBase: 500,  bonus: 50,   priceVnd: 450_000 },
  { id: 'pro',        creditBase: 1000, bonus: 200,  priceVnd: 800_000 },
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
    if (amount <= 0) throw new BadRequestException('Credit amount must be positive');

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

    return this.dataSource.transaction(async (manager) => {
      // Trừ Credit
      const wallet = await manager
        .getRepository(CreditWalletEntity)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.company_id = :companyId', { companyId })
        .getOne();

      if (!wallet) throw new NotFoundException('Credit wallet not found');
      if (wallet.balance < product.creditCost) {
        throw new BadRequestException(
          `Không đủ Credit (cần ${product.creditCost}, hiện có ${wallet.balance})`,
        );
      }

      wallet.balance -= product.creditCost;
      wallet.totalSpent += product.creditCost;
      await manager.save(CreditWalletEntity, wallet);

      // Ghi transaction
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
        creditSpent: product.creditCost,
        targetJobId: targetJobId ?? null,
        activatedAt: new Date(),
        expiresAt,
      });

      return manager.save(CreditPurchaseLogEntity, log);
    });
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
