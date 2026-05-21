import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UserEntity,
  UserRole,
  UserStatus,
} from '../../users/entities/user.entity';
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
import { UpstashCacheService } from '../../common/cache/upstash-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/cache/cache-keys.constant';

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
    private readonly cacheService: UpstashCacheService,
  ) {}

  async getOverview(timeFilter?: TimeFilterDto) {
    const dateRange =
      timeFilter?.year && timeFilter?.granularity
        ? DateRangeBuilder.buildRange(
            timeFilter.year,
            timeFilter.granularity,
            timeFilter.date ?? timeFilter.month ?? timeFilter.quarter,
          )
        : DateRangeBuilder.getCurrentMonthRange();
    const { startDate, endDate } = dateRange;

    // Cache key dựa trên filter params (TTL-only — dữ liệu analytics, không cần real-time)
    const cacheKey = CACHE_KEYS.ADMIN_OVERVIEW(
      this.cacheService.hashKey({ startDate, endDate }),
    );
    const cached = await this.cacheService.get<unknown>(cacheKey);
    if (cached) return cached;

    const [
      users,
      companies,
      jobs,
      revenue,
      applications,
      credits,
      headhunting,
      phase1Metrics,
    ] = await Promise.all([
      this.getUserStats(startDate, endDate),
      this.getCompanyStats(startDate, endDate),
      this.getJobStats(startDate, endDate),
      this.getRevenueStats(startDate, endDate),
      this.getApplicationStats(startDate, endDate),
      this.getCreditStats(),
      this.getHeadhuntingStats(),
      this.getPhase1Metrics(startDate, endDate),
    ]);

    const result = {
      users,
      companies,
      jobs,
      revenue: {
        ...revenue,
        breakdown: [
          {
            label: 'Doanh thu từ VIP',
            value: revenue.fromSubscriptions,
            orders: revenue.subscriptionOrders,
            details:
              phase1Metrics.arpu.breakdown.find(
                (b) => b.label === 'VIP Subscription',
              )?.details || [],
          },
          {
            label: 'Doanh thu từ Credit',
            value: revenue.fromCreditTopups,
            orders: revenue.creditOrders,
            details:
              phase1Metrics.arpu.breakdown.find(
                (b) => b.label === 'Credit Topup',
              )?.details || [],
          },
        ],
      },
      applications,
      credits,
      headhunting,
      phase1Metrics,
      period: { startDate, endDate },
    };

    await this.cacheService.set(cacheKey, result, CACHE_TTL.ADMIN_STATS);
    return result;
  }

  // ─── User Stats ───────────────────────────────────────────────────────────

  private async getUserStats(startDate: Date, endDate: Date) {
    const qb = this.userRepo.createQueryBuilder('u');

    const [byRole, byStatus, newUsers] = await Promise.all([
      qb
        .clone()
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where(
          "(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN :start AND :end",
          {
            start: startDate,
            end: endDate,
          },
        )
        .groupBy('u.role')
        .getRawMany<{ role: string; count: string }>(),

      qb
        .clone()
        .select('u.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where(
          "(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN :start AND :end",
          {
            start: startDate,
            end: endDate,
          },
        )
        .groupBy('u.status')
        .getRawMany<{ status: string; count: string }>(),

      qb
        .clone()
        .where(
          "(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN :start AND :end",
          {
            start: startDate,
            end: endDate,
          },
        )
        .getCount(),
    ]);

    const roleCounts = Object.fromEntries(
      byRole.map((r) => [r.role, Number(r.count)]),
    );
    const statusCounts = Object.fromEntries(
      byStatus.map((s) => [s.status, Number(s.count)]),
    );
    const total = Object.values(roleCounts).reduce((a, b) => a + b, 0);

    const latestUsers = await qb
      .clone()
      .where(
        "(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN :start AND :end",
        {
          start: startDate,
          end: endDate,
        },
      )
      .orderBy('u.created_at', 'DESC')
      .limit(100)
      .getMany();

    const mapToDetail = (users: UserEntity[]) =>
      users.map((u) => ({
        type: 'users' as const,
        title: u.email,
        subtitle: `Tham gia: ${u.created_at ? new Date(u.created_at.getTime() + 7 * 60 * 60 * 1000).toLocaleDateString('vi-VN') : 'N/A'}`,
        valueNode: u.status === UserStatus.ACTIVE ? 'Hoạt động' : 'Bị khóa',
        subItems: [
          {
            label: 'Vai trò',
            value:
              u.role === UserRole.CANDIDATE
                ? 'Ứng viên'
                : u.role === UserRole.EMPLOYER
                  ? 'Nhà tuyển dụng'
                  : 'Admin',
          },
        ],
      }));

    return {
      total,
      candidates: roleCounts[UserRole.CANDIDATE] ?? 0,
      employers: roleCounts[UserRole.EMPLOYER] ?? 0,
      admins: roleCounts[UserRole.ADMIN] ?? 0,
      active: statusCounts[UserStatus.ACTIVE] ?? 0,
      locked: statusCounts[UserStatus.LOCKED] ?? 0,
      newInPeriod: newUsers,
      candidateDetails: mapToDetail(
        latestUsers.filter((u) => u.role === UserRole.CANDIDATE),
      ),
      employerDetails: mapToDetail(
        latestUsers.filter((u) => u.role === UserRole.EMPLOYER),
      ),
      adminDetails: mapToDetail(
        latestUsers.filter((u) => u.role === UserRole.ADMIN),
      ),
      activeDetails: mapToDetail(
        latestUsers.filter((u) => u.status === UserStatus.ACTIVE),
      ),
      lockedDetails: mapToDetail(
        latestUsers.filter((u) => u.status === UserStatus.LOCKED),
      ),
      newDetails: mapToDetail(latestUsers),
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

      this.subscriptionRepo
        .createQueryBuilder('cs')
        .innerJoin('cs.package', 'p')
        .select('COUNT(DISTINCT cs.company_id)', 'count')
        .where("p.name != 'free'")
        .andWhere('cs.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('cs.start_date <= :end', { end: endDate })
        .andWhere('(cs.end_date IS NULL OR cs.end_date >= :start)', {
          start: startDate,
        })
        .getRawOne<{ count: string }>(),
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
      withActiveVip: Number(withVip?.count ?? 0),
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
    const [periodRevenue, byType] = await Promise.all([
      this.paymentRepo
        .createQueryBuilder('p')
        .select('SUM(p.amount)', 'total')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .andWhere('p.paid_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .getRawOne<{ total: string }>(),

      this.paymentRepo
        .createQueryBuilder('p')
        .select('p.order_type', 'orderType')
        .addSelect('SUM(p.amount)', 'total')
        .addSelect('COUNT(*)', 'count')
        .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
        .andWhere('p.paid_at BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy('p.order_type')
        .getRawMany<{ orderType: string; total: string; count: string }>(),
    ]);

    const typeMap = Object.fromEntries(
      byType.map((t) => [
        t.orderType,
        { total: Number(t.total), count: Number(t.count) },
      ]),
    );

    const totalInPeriod = Number(periodRevenue?.total ?? 0);

    return {
      totalRevenue: totalInPeriod,
      revenueInPeriod: totalInPeriod,
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
      timeFilter?.year && timeFilter?.granularity
        ? DateRangeBuilder.buildRange(
            timeFilter.year,
            timeFilter.granularity,
            timeFilter.date ?? timeFilter.month ?? timeFilter.quarter,
          )
        : DateRangeBuilder.getCurrentMonthRange();
    const { startDate, endDate } = dateRange;

    const trunc = this.getChartTruncForGranularity(timeFilter?.granularity);

    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .select(
        `DATE_TRUNC('${trunc}', p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
        'period',
      )
      .addSelect('SUM(p.amount)', 'revenue')
      .addSelect('COUNT(*)', 'orders')
      .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
      .andWhere(
        "(p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN :from AND :to",
        {
          from: startDate,
          to: endDate,
        },
      )
      .groupBy(
        `DATE_TRUNC('${trunc}', p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
      )
      .orderBy(
        `DATE_TRUNC('${trunc}', p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
        'ASC',
      )
      .getRawMany<{ period: string; revenue: string; orders: string }>();

    const getMapKey = (date: Date | string) => {
      const d = new Date(date);
      if (trunc === 'hour') {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${d.getHours()}`;
      }
      if (trunc === 'day') {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const dataMap = new Map<string, { amount: number; orders: number }>(
      rows.map((r) => [
        getMapKey(r.period),
        { amount: Number(r.revenue), orders: Number(r.orders) },
      ]),
    );

    return this.fillDateRange(startDate, endDate, trunc).map((d) => ({
      date: d.toISOString(),
      amount: dataMap.get(getMapKey(d))?.amount ?? 0,
      orders: dataMap.get(getMapKey(d))?.orders ?? 0,
    }));
  }

  // ─── User Growth Chart ────────────────────────────────────────────────────

  async getUserGrowthChart(timeFilter?: TimeFilterDto) {
    const dateRange =
      timeFilter?.year && timeFilter?.granularity
        ? DateRangeBuilder.buildRange(
            timeFilter.year,
            timeFilter.granularity,
            timeFilter.date ?? timeFilter.month ?? timeFilter.quarter,
          )
        : DateRangeBuilder.getCurrentMonthRange();
    const { startDate, endDate } = dateRange;

    const trunc = this.getChartTruncForGranularity(timeFilter?.granularity);

    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select(
        `DATE_TRUNC('${trunc}', u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
        'period',
      )
      .addSelect('COUNT(*)', 'newUsers')
      .addSelect('u.role', 'role')
      .where(
        "(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN :from AND :to",
        {
          from: startDate,
          to: endDate,
        },
      )
      .groupBy(
        `DATE_TRUNC('${trunc}', u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'), u.role`,
      )
      .orderBy(
        `DATE_TRUNC('${trunc}', u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')`,
        'ASC',
      )
      .getRawMany<{ period: string; newUsers: string; role: string }>();

    type GrowthPoint = {
      date: string;
      count: number;
      candidates: number;
      employers: number;
      admins: number;
    };
    const getMapKey = (date: Date | string) => {
      const d = new Date(date);
      if (trunc === 'hour') {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${d.getHours()}`;
      }
      if (trunc === 'day') {
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }
      return `${d.getFullYear()}-${d.getMonth()}`;
    };

    const dataMap = new Map<string, GrowthPoint>();
    rows.forEach((r) => {
      const key = getMapKey(r.period);
      if (!dataMap.has(key)) {
        dataMap.set(key, {
          date: new Date(r.period).toISOString(),
          count: 0,
          candidates: 0,
          employers: 0,
          admins: 0,
        });
      }
      const point = dataMap.get(key) as GrowthPoint;
      const count = Number(r.newUsers);
      point.count += count;
      if (r.role === 'candidate') point.candidates += count;
      if (r.role === 'employer') point.employers += count;
      if (r.role === 'admin') point.admins += count;
    });

    return this.fillDateRange(startDate, endDate, trunc).map(
      (d) =>
        dataMap.get(getMapKey(d)) ?? {
          date: d.toISOString(),
          count: 0,
          candidates: 0,
          employers: 0,
          admins: 0,
        },
    );
  }

  /**
   * Sinh danh sách tất cả các điểm thời gian trong khoảng [start, end]
   * theo độ phân giải trục X của chart.
   * Key trả về khớp chính xác với DATE_TRUNC PostgreSQL format.
   */
  private fillDateRange(start: Date, end: Date, trunc: string): Date[] {
    const dates: Date[] = [];
    const cur = new Date(start);

    if (trunc === 'hour') {
      cur.setMinutes(0, 0, 0);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setHours(cur.getHours() + 1);
      }
    } else if (trunc === 'day') {
      cur.setHours(0, 0, 0, 0);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      // month
      cur.setDate(1);
      cur.setHours(0, 0, 0, 0);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    return dates;
  }

  /**
   * Granularity cho chart — luôn nhỏ hơn 1 bậc so với filter
   * để hiển thị đủ điểm dữ liệu bên trong kỳ được chọn:
   *   day     → hour  (24 cột giờ trong ngày)
   *   month   → day   (N ngày trong tháng)
   *   quarter → month (3 tháng trong quý)
   *   (default / năm) → month
   */
  private getChartTruncForGranularity(granularity?: TimeGranularity): string {
    switch (granularity) {
      case TimeGranularity.DAY:
        return 'hour';
      case TimeGranularity.MONTH:
        return 'day';
      case TimeGranularity.QUARTER:
        return 'month';
      default:
        return 'month';
    }
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

  // ─── Phase 1 Metrics ──────────────────────────────────────────────────────

  private async getPhase1Metrics(startDate: Date, endDate: Date) {
    const [mrr, arpu, conversionRate, funnelConversion] = await Promise.all([
      this.getMRRWithBreakdown(startDate, endDate),
      this.getARPUWithBreakdown(startDate, endDate),
      this.getConversionRateWithBreakdown(startDate, endDate),
      this.getApplicationFunnelConversion(startDate, endDate),
    ]);

    return { mrr, arpu, conversionRate, funnelConversion };
  }

  /** Doanh thu từ VIP subscriptions phát sinh trong kỳ (cash-basis: tính theo ngày bắt đầu/thanh toán) */
  private async getMRRWithBreakdown(startDate: Date, endDate: Date) {
    const [totalMrr, byPackage, subscriptions] = await Promise.all([
      // Tổng tiền nhận được từ VIP trong kỳ
      this.subscriptionRepo
        .createQueryBuilder('cs')
        .innerJoin('cs.package', 'p')
        .select('SUM(p.price)', 'mrr')
        .where("p.name != 'free'")
        .andWhere('cs.start_date BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .getRawOne<{ mrr: string }>(),

      // Tổng theo từng gói
      this.subscriptionRepo
        .createQueryBuilder('cs')
        .innerJoin('cs.package', 'p')
        .select('p.display_name', 'packageName')
        .addSelect('p.name', 'packageCode')
        .addSelect('SUM(p.price)', 'mrr')
        .addSelect('COUNT(cs.id)', 'count')
        .where("p.name != 'free'")
        .andWhere('cs.start_date BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .groupBy('p.display_name')
        .addGroupBy('p.name')
        .getRawMany<{
          packageName: string;
          packageCode: string;
          mrr: string;
          count: string;
        }>(),

      this.subscriptionRepo
        .createQueryBuilder('cs')
        .leftJoinAndSelect('cs.package', 'p')
        .leftJoinAndSelect('cs.company', 'c')
        .where("p.name != 'free'")
        .andWhere('cs.start_date BETWEEN :start AND :end', {
          start: startDate,
          end: endDate,
        })
        .orderBy('cs.start_date', 'DESC')
        .getMany(),
    ]);

    const total = Number(totalMrr?.mrr ?? 0);

    return {
      value: total,
      breakdown: byPackage.map((p) => {
        const packageSubs = subscriptions.filter(
          (s) => s.package?.name === p.packageCode,
        );
        return {
          label: p.packageName,
          value: Number(p.mrr),
          count: Number(p.count),
          percentage: total > 0 ? Math.round((Number(p.mrr) / total) * 100) : 0,
          details: packageSubs.map((s) => ({
            type: 'revenue' as const,
            title: s.company?.name || `Công ty ID: ${s.companyId}`,
            subtitle: `Gói: ${s.package?.displayName || 'Unknown'}`,
            valueNode: Number(s.package?.price ?? 0),
            subItems: [
              {
                label: 'Ngày mua',
                value: s.startDate
                  ? new Date(s.startDate).toLocaleDateString('vi-VN')
                  : 'N/A',
              },
              {
                label: 'Hết hạn',
                value: s.endDate
                  ? new Date(s.endDate).toLocaleDateString('vi-VN')
                  : 'Vô thời hạn',
              },
              {
                label: 'Tiền nhận',
                value: `${new Intl.NumberFormat('vi-VN').format(Number(s.package?.price ?? 0))} ₫`,
              },
            ],
          })),
        };
      }),
    };
  }

  /** ARPU - Average Revenue Per User (paying companies) */
  private async getARPUWithBreakdown(startDate: Date, endDate: Date) {
    const [totalRevenue, payingCompanies, byType, transactions] =
      await Promise.all([
        this.paymentRepo
          .createQueryBuilder('p')
          .select('SUM(p.amount)', 'total')
          .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
          .andWhere('p.paid_at BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .getRawOne<{ total: string }>(),

        this.paymentRepo
          .createQueryBuilder('p')
          .select('COUNT(DISTINCT p.company_id)', 'count')
          .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
          .andWhere('p.paid_at BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .getRawOne<{ count: string }>(),

        this.paymentRepo
          .createQueryBuilder('p')
          .select('p.order_type', 'type')
          .addSelect('SUM(p.amount)', 'revenue')
          .addSelect('COUNT(DISTINCT p.company_id)', 'companies')
          .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
          .andWhere('p.paid_at BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .groupBy('p.order_type')
          .getRawMany<{ type: string; revenue: string; companies: string }>(),

        this.paymentRepo
          .createQueryBuilder('p')
          .innerJoin('p.company', 'c')
          .select([
            'p.id',
            'p.amount',
            'p.paidAt',
            'p.orderType',
            'c.id',
            'c.name',
          ])
          .where('p.payment_status = :s', { s: PaymentOrderStatus.COMPLETED })
          .andWhere('p.paid_at BETWEEN :start AND :end', {
            start: startDate,
            end: endDate,
          })
          .orderBy('p.paid_at', 'DESC')
          .getMany(),
      ]);

    const revenue = Number(totalRevenue?.total ?? 0);
    const companies = Number(payingCompanies?.count ?? 0);
    const arpu = companies > 0 ? Math.round(revenue / companies) : 0;

    return {
      value: arpu,
      totalRevenue: revenue,
      payingCompanies: companies,
      breakdown: byType.map((t) => {
        // Group transactions for this type by company
        const typeTxs = transactions.filter((tx) => tx.orderType === t.type);
        const companyMap = new Map<
          number,
          {
            companyName: string;
            orderCount: number;
            totalAmount: number;
            txs: { id: number; amount: number; paidAt: Date | null }[];
          }
        >();

        for (const tx of typeTxs) {
          if (!tx.company) continue;
          const cid = tx.company.id;
          if (!companyMap.has(cid)) {
            companyMap.set(cid, {
              companyName: tx.company.name,
              orderCount: 0,
              totalAmount: 0,
              txs: [],
            });
          }
          const cData = companyMap.get(cid)!;
          cData.orderCount++;
          cData.totalAmount += Number(tx.amount);
          cData.txs.push({
            id: Number(tx.id),
            amount: Number(tx.amount),
            paidAt: tx.paidAt,
          });
        }

        return {
          label:
            (t.type as PaymentOrderType) === PaymentOrderType.SUBSCRIPTION
              ? 'VIP Subscription'
              : 'Credit Topup',
          value: Number(t.revenue),
          companies: Number(t.companies),
          avgPerCompany:
            Number(t.companies) > 0
              ? Math.round(Number(t.revenue) / Number(t.companies))
              : 0,
          details: Array.from(companyMap.values())
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .map((c) => ({
              type: 'revenue' as const,
              title: c.companyName,
              valueNode: c.totalAmount,
              subItems: c.txs.map((tx) => ({
                label: tx.paidAt
                  ? new Date(tx.paidAt).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '',
                value: tx.amount,
              })),
            })),
        };
      }),
    };
  }

  /** Conversion Rate: Free → Paid */
  private async getConversionRateWithBreakdown(startDate: Date, endDate: Date) {
    const [totalCompanies, paidCompanies, byPackage] = await Promise.all([
      this.companyRepo
        .createQueryBuilder('c')
        .where('c.created_at <= :end', { end: endDate })
        .getCount(),

      this.subscriptionRepo
        .createQueryBuilder('cs')
        .innerJoin('cs.package', 'p')
        .select('COUNT(DISTINCT cs.company_id)', 'count')
        .where("p.name != 'free'")
        .andWhere('cs.start_date <= :end', { end: endDate })
        .andWhere('(cs.end_date IS NULL OR cs.end_date >= :start)', {
          start: startDate,
        })
        .getRawOne<{ count: string }>(),

      this.subscriptionRepo
        .createQueryBuilder('cs')
        .innerJoin('cs.package', 'p')
        .select('p.display_name', 'packageName')
        .addSelect('COUNT(DISTINCT cs.company_id)', 'count')
        .where("p.name != 'free'")
        .andWhere('cs.start_date <= :end', { end: endDate })
        .andWhere('(cs.end_date IS NULL OR cs.end_date >= :start)', {
          start: startDate,
        })
        .groupBy('p.display_name')
        .getRawMany<{ packageName: string; count: string }>(),
    ]);

    const total = totalCompanies;
    const paid = Number(paidCompanies?.count ?? 0);
    const rate = total > 0 ? Math.round((paid / total) * 1000) / 10 : 0;

    return {
      value: rate,
      totalCompanies: total,
      paidCompanies: paid,
      freeCompanies: total - paid,
      breakdown: byPackage.map((p) => ({
        label: p.packageName,
        count: Number(p.count),
        percentage: paid > 0 ? Math.round((Number(p.count) / paid) * 100) : 0,
      })),
    };
  }

  /** Application Funnel Conversion Rates */
  private async getApplicationFunnelConversion(startDate: Date, endDate: Date) {
    const result = await this.applicationRepo
      .createQueryBuilder('ja')
      .select('COUNT(*)', 'total')
      .addSelect(
        "COUNT(*) FILTER (WHERE ja.status IN ('shortlisted', 'skill_test', 'interview', 'offer', 'hired'))",
        'shortlisted',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE ja.status IN ('interview', 'offer', 'hired'))",
        'interview',
      )
      .addSelect("COUNT(*) FILTER (WHERE ja.status = 'hired')", 'hired')
      .where('ja.applied_at BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .getRawOne<{
        total: string;
        shortlisted: string;
        interview: string;
        hired: string;
      }>();

    const total = Number(result?.total ?? 0);
    const shortlisted = Number(result?.shortlisted ?? 0);
    const interview = Number(result?.interview ?? 0);
    const hired = Number(result?.hired ?? 0);

    return {
      appliedToShortlisted:
        total > 0 ? Math.round((shortlisted / total) * 1000) / 10 : 0,
      shortlistedToInterview:
        shortlisted > 0 ? Math.round((interview / shortlisted) * 1000) / 10 : 0,
      interviewToHired:
        interview > 0 ? Math.round((hired / interview) * 1000) / 10 : 0,
    };
  }
}
