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
import { TimeFilterDto } from '../../common/dto/time-filter.dto';
import { DateRangeBuilder } from '../../common/utils/date-range.util';
import { TimeGranularity } from '../../common/enums/time-period.enum';

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

  async getOverview(timeFilter?: TimeFilterDto) {
    const dateRange =
      timeFilter?.getDateRange() || DateRangeBuilder.getCurrentMonthRange();
    const { startDate, endDate } = dateRange;

    const [
      users,
      companies,
      jobs,
      revenue,
      applications,
      credits,
      headhunting,
    ] = await Promise.all([
      this.getUserStats(startDate, endDate),
      this.getCompanyStats(startDate, endDate),
      this.getJobStats(startDate, endDate),
      this.getRevenueStats(startDate, endDate),
      this.getApplicationStats(startDate, endDate),
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
      period: { startDate, endDate },
    };
  }

  // ─── User Stats ───────────────────────────────────────────────────────────

  private async getUserStats(startDate: Date, endDate: Date) {
    const qb = this.userRepo.createQueryBuilder('u');

    const [byRole, byStatus, newUsers] = await Promise.all([
      // GROUP BY role (filtered by date range)
      qb
        .clone()
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('u.created_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy('u.role')
        .getRawMany<{ role: string; count: string }>(),

      // GROUP BY status (filtered by date range)
      qb
        .clone()
        .select('u.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('u.created_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy('u.status')
        .getRawMany<{ status: string; count: string }>(),

      // New users in date range
      qb
        .clone()
        .where('u.created_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
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
      newInPeriod: newUsers,
    };
  }

  // ─── Company Stats ────────────────────────────────────────────────────────

  private async getCompanyStats(startDate: Date, endDate: Date) {
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

  private async getJobStats(startDate: Date, endDate: Date) {
    const [byStatus, newPublished] = await Promise.all([
      this.jobRepo
        .createQueryBuilder('j')
        .select('j.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('j.created_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy('j.status')
        .getRawMany<{ status: string; count: string }>(),

      this.jobRepo
        .createQueryBuilder('j')
        .where('j.published_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
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
      newPublishedInPeriod: newPublished,
    };
  }

  // ─── Revenue Stats ────────────────────────────────────────────────────────

  private async getRevenueStats(startDate: Date, endDate: Date) {
    const [overall, periodRevenue, byType] = await Promise.all([
      // Tổng doanh thu
      this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .getRawOne<{ total: string }>(),

      // Doanh thu trong khoảng thời gian
      this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .andWhere('p.paid_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
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
      revenueInPeriod: Number(periodRevenue?.total ?? 0),
      fromSubscriptions: typeMap[PaymentOrderType.SUBSCRIPTION]?.total ?? 0,
      fromCreditTopups: typeMap[PaymentOrderType.CREDIT_TOPUP]?.total ?? 0,
      subscriptionOrders: typeMap[PaymentOrderType.SUBSCRIPTION]?.count ?? 0,
      creditOrders: typeMap[PaymentOrderType.CREDIT_TOPUP]?.count ?? 0,
    };
  }

  // ─── Application Stats ────────────────────────────────────────────────────

  private async getApplicationStats(startDate: Date, endDate: Date) {
    const [total, inPeriod] = await Promise.all([
      this.applicationRepo.count(),
      this.applicationRepo
        .createQueryBuilder('a')
        .where('a.applied_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .getCount(),
    ]);

    return { total, inPeriod };
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

  async getRevenueChart(timeFilter?: TimeFilterDto) {
    const dateRange =
      timeFilter?.getDateRange() || DateRangeBuilder.getCurrentMonthRange();
    const { startDate, endDate } = dateRange;

    const trunc = timeFilter?.granularity
      ? this.getTruncForGranularity(timeFilter.granularity)
      : 'day';

    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select(`DATE_TRUNC('${trunc}', p.paid_at)`, 'period')
      .addSelect('SUM(p.amount)', 'revenue')
      .addSelect('COUNT(*)', 'orders')
      .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
      .andWhere('p.paid_at BETWEEN :from AND :to', {
        from: startDate,
        to: endDate,
      })
      .groupBy(`DATE_TRUNC('${trunc}', p.paid_at)`)
      .orderBy(`DATE_TRUNC('${trunc}', p.paid_at)`, 'ASC')
      .getRawMany<{ period: string; revenue: string; orders: string }>();

    return rows.map((r) => ({
      date: r.period,
      amount: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }

  // ─── User Growth Chart ────────────────────────────────────────────────────

  async getUserGrowthChart(timeFilter?: TimeFilterDto) {
    const dateRange =
      timeFilter?.getDateRange() || DateRangeBuilder.getCurrentMonthRange();
    const { startDate, endDate } = dateRange;

    const trunc = timeFilter?.granularity
      ? this.getTruncForGranularity(timeFilter.granularity)
      : 'day';

    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select(`DATE_TRUNC('${trunc}', u.created_at)`, 'period')
      .addSelect('COUNT(*)', 'newUsers')
      .addSelect('u.role', 'role')
      .where('u.created_at BETWEEN :from AND :to', {
        from: startDate,
        to: endDate,
      })
      .groupBy(`DATE_TRUNC('${trunc}', u.created_at), u.role`)
      .orderBy(`DATE_TRUNC('${trunc}', u.created_at)`, 'ASC')
      .getRawMany<{ period: string; newUsers: string; role: string }>();

    const results: Record<string, any> = {};

    rows.forEach((r) => {
      const dateStr = r.period;
      if (!results[dateStr]) {
        results[dateStr] = {
          date: dateStr,
          count: 0,
          candidates: 0,
          employers: 0,
          admins: 0,
        };
      }
      const count = Number(r.newUsers);
      results[dateStr].count += count;
      if (r.role === 'candidate') results[dateStr].candidates += count;
      if (r.role === 'employer') results[dateStr].employers += count;
      if (r.role === 'admin') results[dateStr].admins += count;
    });

    return Object.values(results);
  }

  private getTruncForGranularity(granularity: TimeGranularity): string {
    switch (granularity) {
      case TimeGranularity.DAY:
        return 'day';
      case TimeGranularity.MONTH:
        return 'month';
      case TimeGranularity.QUARTER:
        return 'quarter';
      default:
        return 'day';
    }
  }
}
