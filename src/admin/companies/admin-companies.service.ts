// Core & Config
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

// Entities
import { CompanyEntity } from '../../companies/entities/company.entity';
import {
  CompanySubscriptionEntity,
  SubscriptionStatus,
} from '../../subscriptions/entities/company-subscription.entity';
import {
  PaymentOrderEntity,
  PaymentOrderStatus,
} from '../../payments/entities/payment-order.entity';
import { CreditWalletEntity } from '../../credits/entities/credit-wallet.entity';
import {
  CreditTransactionEntity,
  CreditTransactionType,
} from '../../credits/entities/credit-transaction.entity';
import { JobEntity } from '../../jobs/entities/job.entity';

// DTOs
import { AdminCompanyFilterDto } from './dto/admin-company-filter.dto';
import { AdminAdjustCreditDto } from './dto/admin-adjust-credit.dto';
import { buildPaginationMeta } from '../dto/admin-pagination.dto';

// Services
import { AdminAuditLogsService } from '../audit-logs/admin-audit-logs.service';
import { AuditLogAction } from '../audit-logs/entities/audit-log.entity';

@Injectable()
export class AdminCompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CompanySubscriptionEntity)
    private readonly subscriptionRepo: Repository<CompanySubscriptionEntity>,
    @InjectRepository(PaymentOrderEntity)
    private readonly paymentRepo: Repository<PaymentOrderEntity>,
    @InjectRepository(CreditWalletEntity)
    private readonly walletRepo: Repository<CreditWalletEntity>,
    @InjectRepository(CreditTransactionEntity)
    private readonly txRepo: Repository<CreditTransactionEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly dataSource: DataSource,
    private readonly auditLogsService: AdminAuditLogsService,
  ) {}

  async getCompanies(filter: AdminCompanyFilterDto) {
    const {
      status,
      hasVip,
      search,
      sortBy = 'createdAt',
      order = 'DESC',
    } = filter;
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;

    const sortColMap: Record<string, string> = {
      createdAt: 'c.createdAt',
      name: 'c.name',
      verifiedAt: 'c.verifiedAt',
    };
    const sortCol = sortColMap[sortBy] ?? 'c.createdAt';

    const qb = this.companyRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employers', 'e')
      .leftJoinAndSelect('e.user', 'u')
      .orderBy(sortCol, order);

    if (status) {
      qb.andWhere('c.status = :status', { status });
    }

    if (search) {
      qb.andWhere('(c.name ILIKE :search OR c.email_contact ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (hasVip === true || hasVip === false) {
      const existsQuery = `
        EXISTS (
          SELECT 1 FROM company_subscription cs2
          INNER JOIN subscription_package p2 ON p2.id = cs2.package_id
          WHERE cs2.company_id = c.id
          AND cs2.status = :csStatus
          AND p2.name != 'free'
          AND (cs2.end_date IS NULL OR cs2.end_date > NOW())
        )
      `;
      if (hasVip) {
        qb.andWhere(existsQuery, {
          csStatus: SubscriptionStatus.ACTIVE,
        });
      } else {
        qb.andWhere(`NOT ${existsQuery}`, {
          csStatus: SubscriptionStatus.ACTIVE,
        });
      }
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  async getCompanyById(id: number) {
    const company = await this.companyRepo.findOne({
      where: { id },
      relations: ['employers', 'images'],
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async getCompanySubscription(companyId: number) {
    const sub = await this.subscriptionRepo.findOne({
      where: { companyId, status: SubscriptionStatus.ACTIVE },
      relations: ['package'],
    });

    if (!sub) {
      return null;
    }

    return sub;
  }

  async getPaymentHistory(companyId: number, page = 1, limit = 20) {
    const [data, total] = await this.paymentRepo.findAndCount({
      where: { companyId, paymentStatus: PaymentOrderStatus.COMPLETED },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['package'],
    });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }

  async getCreditWallet(companyId: number) {
    const wallet = await this.walletRepo.findOne({ where: { companyId } });
    if (!wallet)
      return { companyId, balance: 0, totalEarned: 0, totalSpent: 0 };

    const recentTx = await this.txRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { ...wallet, recentTransactions: recentTx };
  }

  async getCompanyJobs(companyId: number, page = 1, limit = 20) {
    const [data, total] = await this.jobRepo.findAndCount({
      where: { companyId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, pagination: buildPaginationMeta(total, page, limit) };
  }

  async adjustCredit(
    companyId: number,
    dto: AdminAdjustCreditDto,
    adminUserId: number,
  ) {
    await this.getCompanyById(companyId); // 404 guard

    return this.dataSource.transaction(async (manager) => {
      // Pessimistic lock trên wallet
      let wallet = await manager
        .getRepository(CreditWalletEntity)
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.company_id = :companyId', { companyId })
        .getOne();

      const oldBalance = wallet ? wallet.balance : 0;

      if (!wallet) {
        // Tạo ví nếu chưa có
        wallet = manager.create(CreditWalletEntity, {
          companyId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
        });
        wallet = await manager.save(CreditWalletEntity, wallet);
      }

      wallet.balance += dto.amount;
      if (dto.amount > 0) wallet.totalEarned += dto.amount;
      else wallet.totalSpent += Math.abs(dto.amount);
      await manager.save(CreditWalletEntity, wallet);

      const tx = manager.create(CreditTransactionEntity, {
        walletId: wallet.id,
        type: CreditTransactionType.ADMIN_ADJUST,
        amount: dto.amount,
        balanceAfter: wallet.balance,
        description: dto.reason,
        createdBy: adminUserId,
      });
      await manager.save(CreditTransactionEntity, tx);

      await this.auditLogsService.log(
        {
          adminId: adminUserId,
          action: AuditLogAction.UPDATE_CREDIT,
          resource: 'credit_wallet',
          resourceId: wallet.id,
          oldValues: { balance: oldBalance },
          newValues: {
            balance: wallet.balance,
            amount: dto.amount,
            reason: dto.reason,
          },
        },
        manager,
      );

      return tx;
    });
  }
}
