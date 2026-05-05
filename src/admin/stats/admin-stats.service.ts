import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import {
  CompanyEntity,
  CompanyStatus,
} from '../../companies/entities/company.entity';
import { JobEntity, JobStatus } from '../../jobs/entities/job.entity';
import { JobApplicationEntity } from '../../applications/entities/job-application.entity';
import {
  PaymentOrderEntity,
  PaymentOrderStatus,
  PaymentOrderType,
} from '../../payments/entities/payment-order.entity';
import {
  CreditTransactionEntity,
  CreditTransactionType,
} from '../../credits/entities/credit-transaction.entity';
import { CreditWalletEntity } from '../../credits/entities/credit-wallet.entity';
import {
  CompanySubscriptionEntity,
  SubscriptionStatus,
} from '../../subscriptions/entities/company-subscription.entity';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly applicationRepo: Repository<JobApplicationEntity>,
    @InjectRepository(PaymentOrderEntity)
    private readonly paymentRepo: Repository<PaymentOrderEntity>,
    @InjectRepository(CreditTransactionEntity)
    private readonly txRepo: Repository<CreditTransactionEntity>,
    @InjectRepository(CreditWalletEntity)
    private readonly walletRepo: Repository<CreditWalletEntity>,
    @InjectRepository(CompanySubscriptionEntity)
    private readonly subscriptionRepo: Repository<CompanySubscriptionEntity>,
  ) {}

  async getOverview() {
    const [
      users,
      companies,
      jobs,
      revenue,
      applications,
      credits,
      headhunting,
    ] = await Promise.all([
      this.getUserStats(),
      this.getCompanyStats(),
      this.getJobStats(),
      this.getRevenueStats(),
      this.getApplicationStats(),
      this.getCreditStats(),
      this.getHeadhuntingStats(),
    ]);

    return {
      users,
      companies,
      jobs,
      revenue,
      applications,
      credits,
      headhunting,
    };
  }

  // ─── User Stats ───────────────────────────────────────────────────────────

  private async getUserStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [byRole, byStatus, newUsers] = await Promise.all([
      // GROUP BY role
      this.userRepo
        .createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('u.role')
        .getRawMany<{ role: string; count: string }>(),

      // GROUP BY status
      this.userRepo
        .createQueryBuilder('u')
        .select('u.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('u.status')
        .getRawMany<{ status: string; count: string }>(),

      // New in last 30 days
      this.userRepo
        .createQueryBuilder('u')
        .where('u.created_at >= :date', { date: thirtyDaysAgo })
        .getCount(),
    ]);

    const roleCounts = Object.fromEntries(
      byRole.map((r) => [r.role, Number(r.count)]),
    );
    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.status, Number(s.count)]),
    );
    const total = Object.values(roleCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      candidates: roleCounts['candidate'] ?? 0,
      employers: roleCounts['employer'] ?? 0,
      admins: roleCounts['admin'] ?? 0,
      active: statusCounts['active'] ?? 0,
      locked: statusCounts['locked'] ?? 0,
      newLast30Days: newUsers,
    };
  }

  // ─── Company Stats ────────────────────────────────────────────────────────

  private async getCompanyStats() {
    const [byStatus, withVip] = await Promise.all([
      this.companyRepo
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('c.status')
        .getRawMany<{ status: string; count: string }>(),

      // Công ty có VIP active
      this.subscriptionRepo
        .createQueryBuilder('cs')
        .innerJoin('cs.package', 'p')
        .where('cs.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere("p.name != 'free'")
        .andWhere('(cs.end_date IS NULL OR cs.end_date > NOW())')
        .getCount(),
    ]);

    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.status, Number(s.count)]),
    );
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      idle: statusCounts[CompanyStatus.IDLE] ?? 0,
      pending: statusCounts[CompanyStatus.PENDING] ?? 0,
      approved: statusCounts[CompanyStatus.APPROVED] ?? 0,
      rejected: statusCounts[CompanyStatus.REJECTED] ?? 0,
      withActiveVip: withVip,
    };
  }

  // ─── Job Stats ────────────────────────────────────────────────────────────

  private async getJobStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [byStatus, newPublished] = await Promise.all([
      this.jobRepo
        .createQueryBuilder('j')
        .select('j.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('j.status')
        .getRawMany<{ status: string; count: string }>(),

      this.jobRepo
        .createQueryBuilder('j')
        .where('j.published_at >= :date', { date: sevenDaysAgo })
        .andWhere('j.status = :status', { status: JobStatus.PUBLISHED })
        .getCount(),
    ]);

    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.status, Number(s.count)]),
    );
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      draft: statusCounts[JobStatus.DRAFT] ?? 0,
      pending: statusCounts[JobStatus.PENDING] ?? 0,
      published: statusCounts[JobStatus.PUBLISHED] ?? 0,
      rejected: statusCounts[JobStatus.REJECTED] ?? 0,
      closed: statusCounts[JobStatus.CLOSED] ?? 0,
      newPublishedLast7Days: newPublished,
    };
  }

  // ─── Revenue Stats ────────────────────────────────────────────────────────

  private async getRevenueStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [overall, monthly, byType] = await Promise.all([
      // Tổng doanh thu
      this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .getRawOne<{ total: string }>(),

      // Doanh thu tháng này
      this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .andWhere('p.paid_at >= :startOfMonth', { startOfMonth })
        .getRawOne<{ total: string }>(),

      // Breakdown theo loại
      this.paymentRepo
        .createQueryBuilder('p')
        .select('p.order_type', 'orderType')
        .addSelect('SUM(p.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .groupBy('p.order_type')
        .getRawMany<{ orderType: string; total: string; count: string }>(),
    ]);

    const typeMap = Object.fromEntries(
      byType.map((t) => [
        t.orderType,
        { total: Number(t.total), count: Number(t.count) },
      ]),
    );

    return {
      totalRevenue: Number(overall?.total ?? 0),
      revenueThisMonth: Number(monthly?.total ?? 0),
      fromSubscriptions: typeMap[PaymentOrderType.SUBSCRIPTION]?.total ?? 0,
      fromCreditTopups: typeMap[PaymentOrderType.CREDIT_TOPUP]?.total ?? 0,
      subscriptionOrders: typeMap[PaymentOrderType.SUBSCRIPTION]?.count ?? 0,
      creditOrders: typeMap[PaymentOrderType.CREDIT_TOPUP]?.count ?? 0,
    };
  }

  // ─── Application Stats ────────────────────────────────────────────────────

  private async getApplicationStats() {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [total, thisWeek] = await Promise.all([
      this.applicationRepo.count(),
      this.applicationRepo
        .createQueryBuilder('a')
        .where('a.applied_at >= :startOfWeek', { startOfWeek })
        .getCount(),
    ]);

    return { total, thisWeek };
  }

  // ─── Credit Stats ─────────────────────────────────────────────────────────

  private async getCreditStats() {
    const result = await this.walletRepo
      .createQueryBuilder('w')
      .select('SUM(w.balance)', 'totalInCirculation')
      .addSelect('SUM(w.total_earned)', 'totalEverEarned')
      .addSelect('SUM(w.total_spent)', 'totalEverSpent')
      .getRawOne<{
        totalInCirculation: string;
        totalEverEarned: string;
        totalEverSpent: string;
      }>();

    return {
      totalInCirculation: Number(result?.totalInCirculation ?? 0),
      totalEverEarned: Number(result?.totalEverEarned ?? 0),
      totalEverSpent: Number(result?.totalEverSpent ?? 0),
    };
  }

  // ─── Headhunting Stats ────────────────────────────────────────────────────

  private async getHeadhuntingStats() {
    const [contactUnlocks, aiScoringRuns] = await Promise.all([
      this.txRepo
        .createQueryBuilder('tx')
        .where('tx.type = :t', { t: CreditTransactionType.CONTACT_UNLOCK })
        .getCount(),

      this.txRepo
        .createQueryBuilder('tx')
        .where('tx.type = :t', { t: CreditTransactionType.AI_SCORING })
        .getCount(),
    ]);

    return { contactUnlocks, aiScoringRuns };
  }

  // ─── Revenue Chart ────────────────────────────────────────────────────────

  async getRevenueChart(
    period: 'daily' | 'weekly' | 'monthly',
    from?: string,
    to?: string,
  ) {
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const trunc =
      period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select(`DATE_TRUNC('${trunc}', p.paid_at)`, 'period')
      .addSelect('SUM(p.amount)', 'revenue')
      .addSelect('COUNT(*)', 'orders')
      .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
      .andWhere('p.paid_at BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate,
      })
      .groupBy(`DATE_TRUNC('${trunc}', p.paid_at)`)
      .orderBy(`DATE_TRUNC('${trunc}', p.paid_at)`, 'ASC')
      .getRawMany<{ period: string; revenue: string; orders: string }>();

    return rows.map((r) => ({
      period: r.period,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }

  // ─── User Growth Chart ────────────────────────────────────────────────────

  async getUserGrowthChart(period: 'daily' | 'weekly' | 'monthly') {
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const trunc =
      period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select(`DATE_TRUNC('${trunc}', u.created_at)`, 'period')
      .addSelect('COUNT(*)', 'newUsers')
      .addSelect('u.role', 'role')
      .where('u.created_at >= :from', { from: fromDate })
      .groupBy(`DATE_TRUNC('${trunc}', u.created_at), u.role`)
      .orderBy(`DATE_TRUNC('${trunc}', u.created_at)`, 'ASC')
      .getRawMany<{ period: string; newUsers: string; role: string }>();

    return rows.map((r) => ({
      period: r.period,
      newUsers: Number(r.newUsers),
      role: r.role,
    }));
  }
}
