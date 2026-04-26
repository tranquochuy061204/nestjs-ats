import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmployerEntity } from '../entities/employer.entity';
import { JobEntity } from '../../jobs/entities/job.entity';
import { DashboardFilterDto } from '../dto/dashboard-filter.dto';
import { DASHBOARD_CONFIG } from '../../common/constants/dashboard.constant';

import {
  RawJobStats,
  RawAppStats,
  RawTrendRow,
  RawFunnelStats,
  RawHeadhuntingStats,
  RawTopJob,
  RawInvitationStats,
} from '../interfaces/employer-dashboard.interface';

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Tính tỉ lệ chuyển đổi, trả về null nếu mẫu số = 0 */
function conversionRate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10; // 1 decimal
}

/** Fill các ngày thiếu trong khoảng trend với count = 0 */
function fillTrendDays(
  rawRows: RawTrendRow[],
  days: number,
): { date: string; count: number }[] {
  const map = new Map(
    rawRows.map((r) => {
      // Fix lỗi Postgres DATE chuyển thành Object trong NodeJS -> Ép 100% về String
      const parsedDate = new Date(r.date);
      // Fallback nếu r.date là string "2026-04-25" thì parse có thể bị lệch múi giờ (nếu không có Z)
      // nhưng vì postgres trả về Object (có timezone 00:00:00) nên toISOString là an toàn.
      const dateStr =
        typeof r.date === 'string' && r.date.match(/^\d{4}-\d{2}-\d{2}$/)
          ? r.date
          : parsedDate.toISOString().slice(0, 10);

      return [dateStr, parseInt(r.count, 10)];
    }),
  );
  const result: { date: string; count: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD
    result.push({ date: dateStr, count: map.get(dateStr) ?? 0 });
  }

  return result;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class EmployerDashboardService {
  private readonly logger = new Logger(EmployerDashboardService.name);

  constructor(
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Thống kê tổng quan toàn công ty */
  async getCompanyStats(
    employerUserId: number,
    dto: DashboardFilterDto,
  ): Promise<unknown> {
    const { companyId, employerId } =
      await this.findEmployerWithCompany(employerUserId);

    const [jobStats, appStats, funnelStats, trendRows, headhunting, topJobs] =
      await Promise.all([
        this.queryJobStats(companyId, dto.expiringSoonDays),
        this.queryAppStats(companyId),
        this.queryFunnelStats(companyId),
        this.queryTrend(companyId, DASHBOARD_CONFIG.TREND_DAYS),
        this.queryHeadhuntingStats(employerId),
        this.queryTopJobs(companyId),
      ]);

    const byStatus = {
      applied: parseInt(appStats.applied, 10),
      shortlisted: parseInt(appStats.shortlisted, 10),
      skill_test: parseInt(appStats.skill_test, 10),
      interview: parseInt(appStats.interview, 10),
      offer: parseInt(appStats.offer, 10),
      hired: parseInt(appStats.hired, 10),
      rejected: parseInt(appStats.rejected, 10),
      withdrawn: parseInt(appStats.withdrawn, 10),
    };

    return {
      jobs: {
        total: parseInt(jobStats.total, 10),
        byStatus: {
          draft: parseInt(jobStats.draft, 10),
          pending: parseInt(jobStats.pending, 10),
          published: parseInt(jobStats.published, 10),
          closed: parseInt(jobStats.closed, 10),
          rejected: parseInt(jobStats.rejected, 10),
        },
        expiringSoon: {
          count: parseInt(jobStats.expiring_soon, 10),
          days: dto.expiringSoonDays,
        },
      },
      applications: {
        total: parseInt(appStats.total, 10),
        byStatus,
        conversionRate: {
          appliedToShortlisted: conversionRate(
            parseInt(funnelStats.ever_shortlisted, 10),
            parseInt(funnelStats.total_applied, 10),
          ),
          shortlistedToInterview: conversionRate(
            parseInt(funnelStats.ever_interviewed, 10),
            parseInt(funnelStats.ever_shortlisted, 10),
          ),
          interviewToHired: conversionRate(
            parseInt(funnelStats.ever_hired, 10),
            parseInt(funnelStats.ever_interviewed, 10),
          ),
          rejectionRate: conversionRate(
            parseInt(funnelStats.total_rejected, 10),
            parseInt(funnelStats.total_applied, 10),
          ),
        },
        trend: {
          last7Days: fillTrendDays(trendRows, DASHBOARD_CONFIG.TREND_DAYS),
        },
      },
      headhunting: {
        invitationsSent: parseInt(headhunting.invitations_sent, 10),
        accepted: parseInt(headhunting.accepted, 10),
        declined: parseInt(headhunting.declined, 10),
        pending: parseInt(headhunting.pending, 10),
        savedCandidates: parseInt(headhunting.saved_candidates, 10),
      },
      topJobs: topJobs.map((r) => ({
        jobId: parseInt(r.job_id, 10),
        title: r.title,
        status: r.status,
        applicationCount: parseInt(r.application_count, 10),
      })),
    };
  }

  /** Thống kê chi tiết cho 1 job cụ thể */
  async getJobDashboard(
    employerUserId: number,
    jobId: number,
  ): Promise<unknown> {
    const { companyId } = await this.findEmployerWithCompany(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId },
      select: ['id', 'title', 'status', 'deadline', 'slots'],
    });

    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    const [appStats, funnelStats, trendRows, invStats] = await Promise.all([
      this.queryAppStatsByJob(jobId),
      this.queryFunnelStatsByJob(jobId),
      this.queryTrendByJob(jobId, DASHBOARD_CONFIG.TREND_DAYS),
      this.queryInvitationsByJob(jobId),
    ]);

    const byStatus = {
      applied: parseInt(appStats.applied, 10),
      shortlisted: parseInt(appStats.shortlisted, 10),
      skill_test: parseInt(appStats.skill_test, 10),
      interview: parseInt(appStats.interview, 10),
      offer: parseInt(appStats.offer, 10),
      hired: parseInt(appStats.hired, 10),
      rejected: parseInt(appStats.rejected, 10),
      withdrawn: parseInt(appStats.withdrawn, 10),
    };

    return {
      job: {
        id: job.id,
        title: job.title,
        status: job.status,
        deadline: job.deadline,
        slots: job.slots,
      },
      applications: {
        total: parseInt(appStats.total, 10),
        byStatus,
        conversionRate: {
          appliedToShortlisted: conversionRate(
            parseInt(funnelStats.ever_shortlisted, 10),
            parseInt(funnelStats.total_applied, 10),
          ),
          shortlistedToInterview: conversionRate(
            parseInt(funnelStats.ever_interviewed, 10),
            parseInt(funnelStats.ever_shortlisted, 10),
          ),
          interviewToHired: conversionRate(
            parseInt(funnelStats.ever_hired, 10),
            parseInt(funnelStats.ever_interviewed, 10),
          ),
          rejectionRate: conversionRate(
            parseInt(funnelStats.total_rejected, 10),
            parseInt(funnelStats.total_applied, 10),
          ),
        },
        trend: {
          last7Days: fillTrendDays(trendRows, DASHBOARD_CONFIG.TREND_DAYS),
        },
      },
      invitations: {
        sent: parseInt(invStats.sent, 10),
        accepted: parseInt(invStats.accepted, 10),
        declined: parseInt(invStats.declined, 10),
        pending: parseInt(invStats.pending, 10),
      },
    };
  }

  // ─── Raw Queries ──────────────────────────────────────────────────────────

  /** [Q1] Job counts by status + expiringSoon — 1 table scan */
  private async queryJobStats(
    companyId: number,
    expiringSoonDays: number,
  ): Promise<RawJobStats> {
    const rows = await this.dataSource.query<RawJobStats[]>(
      `SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'draft')                         AS draft,
        COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
        COUNT(*) FILTER (WHERE status = 'published')                     AS published,
        COUNT(*) FILTER (WHERE status = 'closed')                        AS closed,
        COUNT(*) FILTER (WHERE status = 'rejected')                      AS rejected,
        COUNT(*) FILTER (
          WHERE status = 'published'
            AND deadline IS NOT NULL
            AND deadline BETWEEN NOW() AND NOW() + ($1 * INTERVAL '1 day')
        )                                                                 AS expiring_soon
      FROM job
      WHERE company_id = $2`,
      [expiringSoonDays, companyId],
    );
    return (
      rows[0] ?? {
        total: '0',
        draft: '0',
        pending: '0',
        published: '0',
        closed: '0',
        rejected: '0',
        expiring_soon: '0',
      }
    );
  }

  /** [Q2] Application counts by status (scoped to company) — 1 scan via JOIN */
  private async queryAppStats(companyId: number): Promise<RawAppStats> {
    const rows = await this.dataSource.query<RawAppStats[]>(
      `SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE ja.status = 'applied')                    AS applied,
        COUNT(*) FILTER (WHERE ja.status = 'shortlisted')                AS shortlisted,
        COUNT(*) FILTER (WHERE ja.status = 'skill_test')                 AS skill_test,
        COUNT(*) FILTER (WHERE ja.status = 'interview')                  AS interview,
        COUNT(*) FILTER (WHERE ja.status = 'offer')                      AS offer,
        COUNT(*) FILTER (WHERE ja.status = 'hired')                      AS hired,
        COUNT(*) FILTER (WHERE ja.status = 'rejected')                   AS rejected,
        COUNT(*) FILTER (WHERE ja.status = 'withdrawn')                  AS withdrawn
      FROM job_application ja
      INNER JOIN job j ON j.id = ja.job_id
      WHERE j.company_id = $1`,
      [companyId],
    );
    return (
      rows[0] ?? {
        total: '0',
        applied: '0',
        shortlisted: '0',
        skill_test: '0',
        interview: '0',
        offer: '0',
        hired: '0',
        rejected: '0',
        withdrawn: '0',
      }
    );
  }

  /** [Q3] Funnel Stats Cumulative via history */
  private async queryFunnelStats(companyId: number): Promise<RawFunnelStats> {
    const rows = await this.dataSource.query<RawFunnelStats[]>(
      `SELECT
        COUNT(DISTINCT ja.id) AS total_applied,
        COUNT(DISTINCT CASE WHEN ja.status IN ('shortlisted', 'skill_test', 'interview', 'offer', 'hired') OR ah.new_status IN ('shortlisted', 'skill_test', 'interview', 'offer', 'hired') THEN ja.id END) AS ever_shortlisted,
        COUNT(DISTINCT CASE WHEN ja.status IN ('interview', 'offer', 'hired') OR ah.new_status IN ('interview', 'offer', 'hired') THEN ja.id END) AS ever_interviewed,
        COUNT(DISTINCT CASE WHEN ja.status = 'hired' OR ah.new_status = 'hired' THEN ja.id END) AS ever_hired,
        COUNT(DISTINCT CASE WHEN ja.status = 'rejected' OR ah.new_status = 'rejected' THEN ja.id END) AS total_rejected
      FROM job_application ja
      INNER JOIN job j ON j.id = ja.job_id
      LEFT JOIN application_status_history ah ON ah.application_id = ja.id
      WHERE j.company_id = $1`,
      [companyId],
    );
    return (
      rows[0] ?? {
        total_applied: '0',
        ever_shortlisted: '0',
        ever_interviewed: '0',
        ever_hired: '0',
        total_rejected: '0',
      }
    );
  }

  /** [Q4] 7-day application trend — GROUP BY DATE */
  private async queryTrend(
    companyId: number,
    days: number,
  ): Promise<RawTrendRow[]> {
    return this.dataSource.query<RawTrendRow[]>(
      `SELECT
        DATE(ja.created_at AT TIME ZONE 'UTC') AS date,
        COUNT(*)                               AS count
      FROM job_application ja
      INNER JOIN job j ON j.id = ja.job_id
      WHERE j.company_id = $1
        AND ja.created_at >= NOW() - ($2 * INTERVAL '1 day')
      GROUP BY DATE(ja.created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC`,
      [companyId, days],
    );
  }

  /** [Q5] Headhunting stats (scoped to personal employer_id) — 1 scan */
  private async queryHeadhuntingStats(
    employerId: number,
  ): Promise<RawHeadhuntingStats> {
    const rows = await this.dataSource.query<RawHeadhuntingStats[]>(
      `SELECT
        COUNT(*)                                                          AS invitations_sent,
        COUNT(*) FILTER (WHERE status = 'accepted')                      AS accepted,
        COUNT(*) FILTER (WHERE status = 'declined')                      AS declined,
        COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
        (SELECT COUNT(*) FROM saved_candidate WHERE employer_id = $1)    AS saved_candidates
      FROM job_invitation
      WHERE employer_id = $1`,
      [employerId],
    );
    return (
      rows[0] ?? {
        invitations_sent: '0',
        accepted: '0',
        declined: '0',
        pending: '0',
        saved_candidates: '0',
      }
    );
  }

  /** [Q5] Top 5 jobs by application count */
  private async queryTopJobs(companyId: number): Promise<RawTopJob[]> {
    return this.dataSource.query<RawTopJob[]>(
      `SELECT
        j.id           AS job_id,
        j.title,
        j.status,
        COUNT(ja.id)   AS application_count
      FROM job j
      LEFT JOIN job_application ja ON ja.job_id = j.id
      WHERE j.company_id = $1
      GROUP BY j.id, j.title, j.status
      ORDER BY application_count DESC
      LIMIT $2`,
      [companyId, DASHBOARD_CONFIG.TOP_JOBS_LIMIT],
    );
  }

  /** [Per-Job Q1] Application counts for a specific job */
  private async queryAppStatsByJob(jobId: number): Promise<RawAppStats> {
    const rows = await this.dataSource.query<RawAppStats[]>(
      `SELECT
        COUNT(*)                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'applied')                       AS applied,
        COUNT(*) FILTER (WHERE status = 'shortlisted')                   AS shortlisted,
        COUNT(*) FILTER (WHERE status = 'skill_test')                    AS skill_test,
        COUNT(*) FILTER (WHERE status = 'interview')                     AS interview,
        COUNT(*) FILTER (WHERE status = 'offer')                         AS offer,
        COUNT(*) FILTER (WHERE status = 'hired')                         AS hired,
        COUNT(*) FILTER (WHERE status = 'rejected')                      AS rejected,
        COUNT(*) FILTER (WHERE status = 'withdrawn')                     AS withdrawn
      FROM job_application
      WHERE job_id = $1`,
      [jobId],
    );
    return (
      rows[0] ?? {
        total: '0',
        applied: '0',
        shortlisted: '0',
        skill_test: '0',
        interview: '0',
        offer: '0',
        hired: '0',
        rejected: '0',
        withdrawn: '0',
      }
    );
  }

  /** [Per-Job Q2] Funnel Stats Cumulative via history */
  private async queryFunnelStatsByJob(jobId: number): Promise<RawFunnelStats> {
    const rows = await this.dataSource.query<RawFunnelStats[]>(
      `SELECT
        COUNT(DISTINCT ja.id) AS total_applied,
        COUNT(DISTINCT CASE WHEN ja.status IN ('shortlisted', 'skill_test', 'interview', 'offer', 'hired') OR ah.new_status IN ('shortlisted', 'skill_test', 'interview', 'offer', 'hired') THEN ja.id END) AS ever_shortlisted,
        COUNT(DISTINCT CASE WHEN ja.status IN ('interview', 'offer', 'hired') OR ah.new_status IN ('interview', 'offer', 'hired') THEN ja.id END) AS ever_interviewed,
        COUNT(DISTINCT CASE WHEN ja.status = 'hired' OR ah.new_status = 'hired' THEN ja.id END) AS ever_hired,
        COUNT(DISTINCT CASE WHEN ja.status = 'rejected' OR ah.new_status = 'rejected' THEN ja.id END) AS total_rejected
      FROM job_application ja
      LEFT JOIN application_status_history ah ON ah.application_id = ja.id
      WHERE ja.job_id = $1`,
      [jobId],
    );
    return (
      rows[0] ?? {
        total_applied: '0',
        ever_shortlisted: '0',
        ever_interviewed: '0',
        ever_hired: '0',
        total_rejected: '0',
      }
    );
  }

  /** [Per-Job Q3] Trend for a specific job */
  private async queryTrendByJob(
    jobId: number,
    days: number,
  ): Promise<RawTrendRow[]> {
    return this.dataSource.query<RawTrendRow[]>(
      `SELECT
        DATE(created_at AT TIME ZONE 'UTC') AS date,
        COUNT(*)                            AS count
      FROM job_application
      WHERE job_id = $1
        AND created_at >= NOW() - ($2 * INTERVAL '1 day')
      GROUP BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY date ASC`,
      [jobId, days],
    );
  }

  /** [Per-Job Q3] Invitation stats for a specific job */
  private async queryInvitationsByJob(
    jobId: number,
  ): Promise<RawInvitationStats> {
    const rows = await this.dataSource.query<RawInvitationStats[]>(
      `SELECT
        COUNT(*)                                                     AS sent,
        COUNT(*) FILTER (WHERE status = 'accepted')                  AS accepted,
        COUNT(*) FILTER (WHERE status = 'declined')                  AS declined,
        COUNT(*) FILTER (WHERE status = 'pending')                   AS pending
      FROM job_invitation
      WHERE job_id = $1`,
      [jobId],
    );
    return rows[0] ?? { sent: '0', accepted: '0', declined: '0', pending: '0' };
  }

  // ─── Auth Helpers ─────────────────────────────────────────────────────────

  private async findEmployerWithCompany(
    userId: number,
  ): Promise<{ companyId: number; employerId: number }> {
    const employer = await this.employerRepo.findOne({ where: { userId } });

    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    if (!employer.companyId) {
      throw new ForbiddenException(
        'Bạn chưa thuộc công ty nào. Vui lòng liên hệ admin để được hỗ trợ.',
      );
    }

    return { companyId: employer.companyId, employerId: employer.id };
  }
}
