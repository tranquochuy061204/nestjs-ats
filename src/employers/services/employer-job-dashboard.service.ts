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
import { DASHBOARD_CONFIG } from '../../common/constants/dashboard.constant';
import { conversionRate, fillTrendDays } from '../utils/dashboard.util';
import {
  RawAppStats,
  RawTrendRow,
  RawFunnelStats,
  RawInvitationStats,
} from '../interfaces/employer-dashboard.interface';

@Injectable()
export class EmployerJobDashboardService {
  private readonly logger = new Logger(EmployerJobDashboardService.name);

  constructor(
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly dataSource: DataSource,
  ) {}

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
        TO_CHAR(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
        COUNT(*)::text                                       AS count
      FROM job_application
      WHERE job_id = $1
        AND applied_at >= NOW() - ($2 * INTERVAL '1 day')
      GROUP BY TO_CHAR(applied_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC`,
      [jobId, days],
    );
  }

  /** [Per-Job Q4] Invitation stats for a specific job */
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
