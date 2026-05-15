import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmployerEntity } from '../entities/employer.entity';
import { DashboardFilterDto } from '../dto/dashboard-filter.dto';
import { DASHBOARD_CONFIG } from '../../common/constants/dashboard.constant';
import { conversionRate, fillTrendDays } from '../utils/dashboard.util';
import {
  RawJobStats,
  RawAppStats,
  RawTrendRow,
  RawFunnelStats,
  RawHeadhuntingStats,
  RawTopJob,
  RawPublishedJob,
  RawAppDetail,
  RawInvitationDetail,
} from '../interfaces/employer-dashboard.interface';
import {
  DateRangeBuilder,
  DateRange,
} from '../../common/utils/date-range.util';

@Injectable()
export class EmployerCompanyDashboardService {
  private readonly logger = new Logger(EmployerCompanyDashboardService.name);

  constructor(
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /** Thống kê tổng quan toàn công ty */
  async getCompanyStats(
    employerUserId: number,
    dto: DashboardFilterDto,
  ): Promise<unknown> {
    const { companyId, employerId } =
      await this.findEmployerWithCompany(employerUserId);

    // Get date range from filter or default to current month
    const dateRange =
      dto.year && dto.granularity
        ? DateRangeBuilder.buildRange(
            dto.year,
            dto.granularity,
            dto.date ?? dto.month ?? dto.quarter,
          )
        : DateRangeBuilder.getCurrentMonthRange();

    const [
      jobStats,
      appStats,
      funnelStats,
      trendRows,
      headhunting,
      topJobs,
      publishedJobsList,
      applicationsList,
      invitationsList,
    ] = await Promise.all([
      this.queryJobStats(companyId, dto.expiringSoonDays, dateRange),
      this.queryAppStats(companyId, dateRange),
      this.queryFunnelStats(companyId, dateRange),
      this.queryTrend(companyId, dateRange, dto.granularity || 'day'),
      this.queryHeadhuntingStats(employerId, dateRange),
      this.queryTopJobs(companyId, dateRange),
      this.queryPublishedJobsList(companyId, dateRange),
      this.queryApplicationsList(companyId, dateRange),
      this.queryInvitationsList(employerId, dateRange),
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
        publishedInPeriod: parseInt(jobStats.published_in_period, 10),
        publishedJobsList: publishedJobsList.map((j) => ({
          id: parseInt(j.id, 10),
          title: j.title,
          status: j.status,
          publishedAt: j.published_at,
        })),
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
        applicationsList: applicationsList.map((a) => ({
          id: parseInt(a.id, 10),
          candidateName: a.candidate_name,
          jobTitle: a.job_title,
          status: a.status,
          appliedAt: a.created_at,
        })),
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
          data: fillTrendDays(trendRows, dateRange, dto.granularity || 'day'),
        },
      },
      headhunting: {
        invitationsSent: parseInt(headhunting.invitations_sent, 10),
        invitationsList: invitationsList.map((i) => ({
          id: parseInt(i.id, 10),
          candidateName: i.candidate_name,
          jobTitle: i.job_title,
          status: i.status,
          sentAt: i.created_at,
        })),
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

  // ─── Raw Queries ──────────────────────────────────────────────────────────

  /** [Q1] Job counts by status + expiringSoon — 1 table scan */
  private async queryJobStats(
    companyId: number,
    expiringSoonDays: number,
    dateRange: DateRange,
  ): Promise<RawJobStats> {
    const rows = await this.dataSource.query<RawJobStats[]>(
      `SELECT
        COUNT(*) FILTER (WHERE created_at BETWEEN $3 AND $4)             AS total,
        COUNT(*) FILTER (WHERE status = 'draft' AND created_at BETWEEN $3 AND $4) AS draft,
        COUNT(*) FILTER (WHERE status = 'pending' AND created_at BETWEEN $3 AND $4) AS pending,
        COUNT(*) FILTER (WHERE status = 'published' AND created_at BETWEEN $3 AND $4) AS published,
        COUNT(*) FILTER (WHERE status = 'closed' AND created_at BETWEEN $3 AND $4) AS closed,
        COUNT(*) FILTER (WHERE status = 'rejected' AND created_at BETWEEN $3 AND $4) AS rejected,
        COUNT(*) FILTER (WHERE published_at BETWEEN $3 AND $4)           AS published_in_period,
        COUNT(*) FILTER (
          WHERE status = 'published'
            AND deadline IS NOT NULL
            AND deadline BETWEEN NOW() AND NOW() + ($1 * INTERVAL '1 day')
        )                                                                 AS expiring_soon
      FROM job
      WHERE company_id = $2`,
      [expiringSoonDays, companyId, dateRange.startDate, dateRange.endDate],
    );
    return (
      rows[0] ?? {
        total: '0',
        draft: '0',
        pending: '0',
        published: '0',
        closed: '0',
        rejected: '0',
        published_in_period: '0',
        expiring_soon: '0',
      }
    );
  }

  /** [Q1.5] Published Jobs List in Period */
  private async queryPublishedJobsList(
    companyId: number,
    dateRange: DateRange,
  ): Promise<RawPublishedJob[]> {
    return this.dataSource.query<RawPublishedJob[]>(
      `SELECT
        id::text,
        title,
        status,
        published_at::text
      FROM job
      WHERE company_id = $1
        AND published_at BETWEEN $2 AND $3
      ORDER BY published_at DESC`,
      [companyId, dateRange.startDate, dateRange.endDate],
    );
  }

  /** [Q2] Application counts by status (scoped to company) — 1 scan via JOIN */
  private async queryAppStats(
    companyId: number,
    dateRange: DateRange,
  ): Promise<RawAppStats> {
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
      WHERE j.company_id = $1
        AND ja.applied_at BETWEEN $2 AND $3`,
      [companyId, dateRange.startDate, dateRange.endDate],
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
  private async queryFunnelStats(
    companyId: number,
    dateRange: DateRange,
  ): Promise<RawFunnelStats> {
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
      WHERE j.company_id = $1
        AND ja.applied_at BETWEEN $2 AND $3`,
      [companyId, dateRange.startDate, dateRange.endDate],
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

  private async queryTrend(
    companyId: number,
    dateRange: DateRange,
    granularity: 'day' | 'month' | 'quarter',
  ): Promise<RawTrendRow[]> {
    const formatStr = granularity === 'quarter' ? 'YYYY-MM' : 'YYYY-MM-DD';
    return this.dataSource.query<RawTrendRow[]>(
      `SELECT
        TO_CHAR(ja.applied_at AT TIME ZONE 'Asia/Ho_Chi_Minh', $4) AS date,
        COUNT(*)::text                                          AS count
      FROM job_application ja
      INNER JOIN job j ON j.id = ja.job_id
      WHERE j.company_id = $1
        AND ja.applied_at BETWEEN $2 AND $3
      GROUP BY date
      ORDER BY date ASC`,
      [companyId, dateRange.startDate, dateRange.endDate, formatStr],
    );
  }

  /** [Q5] Headhunting stats (scoped to personal employer_id) — 1 scan */
  private async queryHeadhuntingStats(
    employerId: number,
    dateRange: DateRange,
  ): Promise<RawHeadhuntingStats> {
    const rows = await this.dataSource.query<RawHeadhuntingStats[]>(
      `SELECT
        COUNT(*)                                                          AS invitations_sent,
        COUNT(*) FILTER (WHERE status = 'accepted')                      AS accepted,
        COUNT(*) FILTER (WHERE status = 'declined')                      AS declined,
        COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
        (SELECT COUNT(*) FROM saved_candidate WHERE employer_id = $1)    AS saved_candidates
      FROM job_invitation
      WHERE employer_id = $1
        AND created_at BETWEEN $2 AND $3`,
      [employerId, dateRange.startDate, dateRange.endDate],
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

  /** [Q6] Top 5 jobs by application count */
  private async queryTopJobs(
    companyId: number,
    dateRange: DateRange,
  ): Promise<RawTopJob[]> {
    return this.dataSource.query<RawTopJob[]>(
      `SELECT
        j.id           AS job_id,
        j.title,
        j.status,
        COUNT(ja.id)   AS application_count
      FROM job j
      LEFT JOIN job_application ja ON ja.job_id = j.id AND ja.applied_at BETWEEN $2 AND $3
      WHERE j.company_id = $1
      GROUP BY j.id, j.title, j.status
      ORDER BY application_count DESC
      LIMIT $4`,
      [
        companyId,
        dateRange.startDate,
        dateRange.endDate,
        DASHBOARD_CONFIG.TOP_JOBS_LIMIT,
      ],
    );
  }

  /** [Q7] Applications List in Period */
  private async queryApplicationsList(
    companyId: number,
    dateRange: DateRange,
  ): Promise<RawAppDetail[]> {
    return this.dataSource.query<RawAppDetail[]>(
      `SELECT
        ja.id::text,
        c.full_name AS candidate_name,
        j.title AS job_title,
        ja.status,
        ja.applied_at::text AS created_at
      FROM job_application ja
      INNER JOIN job j ON j.id = ja.job_id
      INNER JOIN candidate c ON c.id = ja.candidate_id
      WHERE j.company_id = $1
        AND ja.applied_at BETWEEN $2 AND $3
      ORDER BY ja.applied_at DESC`,
      [companyId, dateRange.startDate, dateRange.endDate],
    );
  }

  /** [Q8] Invitations List in Period */
  private async queryInvitationsList(
    employerId: number,
    dateRange: DateRange,
  ): Promise<RawInvitationDetail[]> {
    return this.dataSource.query<RawInvitationDetail[]>(
      `SELECT
        ji.id::text,
        c.full_name AS candidate_name,
        j.title AS job_title,
        ji.status,
        ji.created_at::text AS created_at
      FROM job_invitation ji
      INNER JOIN job j ON j.id = ji.job_id
      INNER JOIN candidate c ON c.id = ji.candidate_id
      WHERE ji.employer_id = $1
        AND ji.created_at BETWEEN $2 AND $3
      ORDER BY ji.created_at DESC`,
      [employerId, dateRange.startDate, dateRange.endDate],
    );
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
