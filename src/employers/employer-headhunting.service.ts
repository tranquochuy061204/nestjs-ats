import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In } from 'typeorm';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { SavedCandidateEntity } from './entities/saved-candidate.entity';
import { EmployerEntity } from './entities/employer.entity';
import { JobEntity, JobStatus } from '../jobs/entities/job.entity';
import {
  JobInvitationEntity,
  InvitationStatus,
} from '../jobs/entities/job-invitation.entity';
import { SaveCandidateDto } from './dto/save-candidate.dto';
import { CreateJobInvitationDto } from '../jobs/dto/create-job-invitation.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { HEADHUNTING_CONFIG } from '../common/constants/headhunting.constant';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { CreditsService } from '../credits/credits.service';
import { ContactUnlockLogEntity } from '../subscriptions/entities/contact-unlock-log.entity';
import { CreditTransactionType } from '../credits/entities/credit-transaction.entity';

@Injectable()
export class EmployerHeadhuntingService {
  private readonly logger = new Logger(EmployerHeadhuntingService.name);

  /** Credit charge khi xem profile nếu không phải VIP free quota */
  private static readonly CONTACT_UNLOCK_CREDIT_COST = 5;

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(SavedCandidateEntity)
    private readonly savedCandidateRepo: Repository<SavedCandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(JobInvitationEntity)
    private readonly invitationRepo: Repository<JobInvitationEntity>,
    @InjectRepository(ContactUnlockLogEntity)
    private readonly contactUnlockRepo: Repository<ContactUnlockLogEntity>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly creditsService: CreditsService,
    private readonly dataSource: DataSource,
  ) {}

  async getSuggestedCandidates(
    employerUserId: number,
    jobId: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const employer = await this.findEmployerWithCompany(employerUserId);

    const job = await this.jobRepo.findOne({
      where: { id: jobId, companyId: employer.companyId },
      relations: ['skills'],
    });

    if (!job) {
      throw new NotFoundException(
        'Tin tuyển dụng không tồn tại hoặc không thuộc công ty của bạn',
      );
    }

    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Chỉ có thể gợi ý ứng viên cho tin tuyển dụng đang đăng tuyển (PUBLISHED)',
      );
    }

    // Ép integer để đảm bảo type-safe (không phải user input nên rủi ro thấp,
    // nhưng dùng parameterized bindings triệt để loại bỏ mọi khả năng injection)
    const jobSkillIds = job.skills
      .map((s) => s.skillId)
      .filter((id): id is number => id != null)
      .map((id) => Math.trunc(id)); // enforce integer

    const totalJobSkills = jobSkillIds.length;
    const minExp = Math.trunc(job.yearsOfExperience ?? 0);
    const jobSalaryMin = job.salaryMin
      ? Math.trunc(Number(job.salaryMin))
      : null;
    const jobSalaryMax = job.salaryMax
      ? Math.trunc(Number(job.salaryMax))
      : null;
    const jobProvinceId = job.provinceId ? Math.trunc(job.provinceId) : null;
    const jobCategoryId = job.categoryId ? Math.trunc(job.categoryId) : null;

    const { SCORING, THRESHOLDS } = HEADHUNTING_CONFIG;

    // ----------------------------------------------------------------
    // Hệ thống Weighted Composite Scoring (Tổng 100 điểm)
    //   - Kỹ năng khớp:     0-40 điểm
    //   - Kinh nghiệm:      0-25 điểm (>= yêu cầu = 25, không đủ = hard block)
    //   - Lương phù hợp:    0-20 điểm
    //   - Hồ sơ đầy đủ:    0-10 điểm (CV + Work Exp + Cert)
    //   - Địa điểm:         0-5  điểm (cùng tỉnh = 5, khác = 0, không block)
    // ----------------------------------------------------------------

    // --- 1. SKILL SCORE (0-40) — dùng UNNEST để parameterized hoàn toàn ---
    let skillScoreExpr: string;
    if (jobSkillIds.length > 0) {
      // UNNEST($N::int[]) cho phép pass array an toàn qua parameterized binding
      skillScoreExpr = `
        LEAST(${SCORING.MAX_SKILL}, COALESCE(
          (SELECT COUNT(DISTINCT cst.skill_metadata_id)::float
           FROM candidate_skill_tag cst
           WHERE cst.candidate_id = c.id
             AND cst.skill_metadata_id = ANY(:skillIds::int[])
          ) / ${totalJobSkills} * ${SCORING.MAX_SKILL},
        0))`;
    } else {
      skillScoreExpr = `${SCORING.NEUTRAL_SKILL}`;
    }

    // --- 2. EXPERIENCE SCORE (0-25) ---
    const expScoreExpr = `${SCORING.MAX_EXPERIENCE}`;

    // --- 3. SALARY SCORE (0-20) — dùng named params ---
    let salaryScoreExpr: string;
    if (jobSalaryMin == null && jobSalaryMax == null) {
      salaryScoreExpr = `${SCORING.SALARY.PARTIAL}`;
    } else if (jobSalaryMin != null && jobSalaryMax != null) {
      salaryScoreExpr = `
        CASE
          WHEN c.salary_min IS NULL OR c.salary_max IS NULL THEN ${SCORING.SALARY.PARTIAL}
          WHEN CAST(c.salary_min AS float) > :jobSalaryMax OR CAST(c.salary_max AS float) < :jobSalaryMin THEN ${SCORING.SALARY.MISMATCH}
          WHEN CAST(c.salary_min AS float) >= :jobSalaryMin AND CAST(c.salary_max AS float) <= :jobSalaryMax THEN ${SCORING.SALARY.MATCH}
          ELSE ${SCORING.SALARY.PARTIAL}
        END`;
    } else {
      salaryScoreExpr = `
        CASE
          WHEN c.salary_min IS NULL OR c.salary_max IS NULL THEN ${SCORING.SALARY.PARTIAL}
          WHEN CAST(c.salary_min AS float) <= :salaryBound AND CAST(c.salary_max AS float) >= :salaryBound THEN ${SCORING.SALARY.MATCH}
          ELSE ${SCORING.SALARY.MISMATCH}
        END`;
    }

    // --- 4. PROFILE COMPLETENESS SCORE (0-10) ---
    const profileScoreExpr = `(
      CASE WHEN c.cv_url IS NOT NULL THEN ${SCORING.PROFILE.HAS_CV} ELSE 0 END
      + CASE WHEN EXISTS(
          SELECT 1 FROM work_experience we WHERE we.candidate_id = c.id
        ) THEN ${SCORING.PROFILE.HAS_WORK_EXP} ELSE 0 END
      + CASE WHEN EXISTS(
          SELECT 1 FROM certificate cert WHERE cert.candidate_id = c.id
        ) THEN ${SCORING.PROFILE.HAS_CERTIFICATE} ELSE 0 END
    )`;

    // --- 5. LOCATION SCORE (0-5, soft — không block) — dùng named param ---
    const locationScoreExpr =
      jobProvinceId != null
        ? `CASE WHEN c.province_id = :jobProvinceId THEN ${SCORING.LOCATION} ELSE 0 END`
        : `0`;

    const totalScoreExpr = `(
      ${skillScoreExpr}
      + ${expScoreExpr}
      + ${salaryScoreExpr}
      + ${profileScoreExpr}
      + ${locationScoreExpr}
    )`;

    // ----------------------------------------------------------------
    // Build query với parameterized bindings
    // ----------------------------------------------------------------
    // Tính offset cho pagination
    const offset = (page - 1) * limit;

    try {
      const qb = this.candidateRepo
        .createQueryBuilder('c')
        .select('c.id', 'candidateId')
        .addSelect(skillScoreExpr, 'skillScore')
        .addSelect(expScoreExpr, 'experienceScore')
        .addSelect(salaryScoreExpr, 'salaryScore')
        .addSelect(profileScoreExpr, 'profileScore')
        .addSelect(locationScoreExpr, 'locationScore')
        .addSelect(totalScoreExpr, 'matchScore')

        // --- HARD FILTERS ---
        .where('c.is_public = true')
        .andWhere('COALESCE(c.year_working_experience, 0) >= :minExp', {
          minExp,
        })

        // Ngành nghề là tiêu chí quan trọng nhất → giữ là semi-hard filter
        .andWhere(
          jobCategoryId
            ? `EXISTS (
                SELECT 1 FROM candidate_job_category cjc
                WHERE cjc.candidate_id = c.id AND cjc.job_category_id = :categoryId
              )`
            : '1=1',
          { categoryId: jobCategoryId },
        )

        // Loại bỏ ứng viên đã được mời vào Job này
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM job_invitation ji
            WHERE ji.candidate_id = c.id AND ji.job_id = :jobId
          )`,
          { jobId },
        )

        // Loại bỏ ứng viên đã tự ứng tuyển vào Job này
        .andWhere(
          `NOT EXISTS (
            SELECT 1 FROM job_application ja
            WHERE ja.candidate_id = c.id AND ja.job_id = :jobIdApp
          )`,
          { jobIdApp: jobId },
        )

        // Bind tất cả named params
        .setParameters({
          ...(jobSkillIds.length > 0 ? { skillIds: jobSkillIds } : {}),
          ...(jobSalaryMin != null ? { jobSalaryMin } : {}),
          ...(jobSalaryMax != null ? { jobSalaryMax } : {}),
          ...(jobSalaryMin == null && jobSalaryMax != null
            ? { salaryBound: jobSalaryMax }
            : jobSalaryMax == null && jobSalaryMin != null
              ? { salaryBound: jobSalaryMin }
              : {}),
          ...(jobProvinceId != null ? { jobProvinceId } : {}),
        })

        .orderBy(totalScoreExpr, 'DESC')
        .limit(THRESHOLDS.MAX_SUGGESTIONS); // Lấy tối đa N record có score cao nhất trước

      const rawRows = await qb.getRawMany<{
        candidateId: string;
        skillScore: string;
        experienceScore: string;
        salaryScore: string;
        profileScore: string;
        locationScore: string;
        matchScore: string;
      }>();

      // Lọc ngưỡng tối thiểu để tránh gợi ý ứng viên quá kém phù hợp
      const qualified = rawRows.filter(
        (r) => parseFloat(r.matchScore) >= THRESHOLDS.MIN_SUGGESTION_SCORE,
      );

      const total = qualified.length;

      // Áp dụng pagination thủ công sau khi đã có full scoring list
      const paged = qualified.slice(offset, offset + limit);

      if (paged.length === 0) {
        return { data: [], total, page, lastPage: Math.ceil(total / limit) };
      }

      const orderedIds = paged.map((r) => Number(r.candidateId));
      const scoreMap = new Map(
        paged.map((r) => [
          parseInt(r.candidateId, 10),
          {
            matchScore: Math.round(parseFloat(r.matchScore)),
            scoreBreakdown: {
              skillScore: Math.round(parseFloat(r.skillScore || '0')),
              experienceScore: Math.round(parseFloat(r.experienceScore || '0')),
              salaryScore: Math.round(parseFloat(r.salaryScore || '0')),
              profileScore: Math.round(parseFloat(r.profileScore || '0')),
              locationScore: Math.round(parseFloat(r.locationScore || '0')),
            },
          },
        ]),
      );

      // Fetch full entities để trả về đầy đủ thông tin
      const entities = await this.candidateRepo.find({
        where: { id: In(orderedIds) },
        relations: [
          'skills',
          'skills.skillMetadata',
          'jobCategories',
          'jobType',
        ],
      });

      const entityMap = new Map(entities.map((e) => [e.id, e]));

      const data = orderedIds
        .map((id) => {
          const entity = entityMap.get(id);
          if (!entity) return null;
          return { ...entity, ...scoreMap.get(id) };
        })
        .filter(Boolean);

      return { data, total, page, lastPage: Math.ceil(total / limit) };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Lỗi khi tính toán gợi ý ứng viên cho Job #${jobId}: ${errorMessage}`,
        errorStack,
      );
      return { data: [], total: 0, page, lastPage: 0 };
    }
  }

  /**
   * Xem chi tiết hồ sơ ứng viên — có kiểm tra VIP / credit unlock.
   *
   * Logic:
   *  1. Nếu đã unlock rồi (ở contact_unlock_log) → trả về miễn phí
   *  2. VIP có free_contact_unlock=true và còn monthly quota → unlock miễn phí, ghi log
   *  3. Còn lại (Free hoặc VIP hết quota) → charge 5 Credit, ghi log
   */
  async getCandidateDetail(employerUserId: number, candidateId: number) {
    const employer = await this.findEmployerWithCompany(employerUserId);
    const companyId = employer.companyId;

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, isPublic: true },
      relations: [
        'jobType',
        'skills',
        'skills.skillMetadata',
        'workExperiences',
        'educations',
        'projects',
        'certificates',
        'jobCategories',
        'jobCategories.jobCategory',
      ],
    });

    if (!candidate) {
      throw new NotFoundException(
        'Không tìm thấy ứng viên hoặc hồ sơ không được công khai',
      );
    }

    // 1. Kiểm tra đã unlock chưa (để tránh charge lại)
    const existingUnlock = await this.contactUnlockRepo.findOne({
      where: { companyId, candidateId },
    });
    if (existingUnlock) {
      return { ...candidate, contactUnlocked: true, creditSpent: 0 };
    }

    // 2. Kiểm tra subscription
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(companyId);

    let creditSpent = EmployerHeadhuntingService.CONTACT_UNLOCK_CREDIT_COST;
    let usedFreeQuota = false;

    if (pkg.freeContactUnlock) {
      // Trong VIP: kiểm tra monthly quota
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);

      const usedThisMonth = await this.contactUnlockRepo
        .createQueryBuilder('ul')
        .where('ul.company_id = :companyId', { companyId })
        .andWhere('ul.unlocked_at >= :firstOfMonth', { firstOfMonth })
        .getCount();

      if (
        usedThisMonth < pkg.monthlyHeadhuntProfileViews ||
        pkg.monthlyHeadhuntProfileViews === -1
      ) {
        creditSpent = 0;
        usedFreeQuota = true;
      }
    }

    // 3. Charge credit nếu cần + ghi log trong 1 transaction
    if (creditSpent > 0) {
      await this.creditsService.chargeCredit(companyId, creditSpent, {
        type: CreditTransactionType.PURCHASE,
        description: `Mở khoá liên hệ ứng viên #${candidateId}`,
        referenceType: 'candidate',
        referenceId: candidateId,
        createdBy: employerUserId,
      });
    }

    // Ghi log unlock (dùng upsert để an toàn khi race condition)
    await this.dataSource.query(
      `INSERT INTO contact_unlock_log (company_id, candidate_id, credit_spent)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [companyId, candidateId, creditSpent],
    );

    this.logger.log(
      `Contact unlock: company=${companyId} candidate=${candidateId} ` +
        `freeQuota=${usedFreeQuota} creditSpent=${creditSpent}`,
    );

    return { ...candidate, contactUnlocked: true, creditSpent };
  }

  async saveCandidate(
    employerUserId: number,
    candidateId: number,
    dto: SaveCandidateDto,
  ) {
    const employer = await this.findEmployerWithCompany(employerUserId);

    //VIP gate: chỉ VIP mới được lưu ứng viên
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(employer.companyId);
    if (!pkg.canHeadhuntSaveAndInvite) {
      throw new ForbiddenException('Tính năng lưu ứng viên yêu cầu gói VIP');
    }

    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId, isPublic: true },
    });
    if (!candidate) {
      throw new NotFoundException('Ứng viên không tồn tại hoặc đã ẩn hồ sơ');
    }

    let saved = await this.savedCandidateRepo.findOne({
      where: { employerId: employer.id, candidateId },
    });

    if (saved) {
      saved.note = dto.note || saved.note;
    } else {
      saved = this.savedCandidateRepo.create({
        employerId: employer.id,
        candidateId,
        note: dto.note,
      });
    }

    return this.savedCandidateRepo.save(saved);
  }

  async unsaveCandidate(employerUserId: number, candidateId: number) {
    const employer = await this.findEmployer(employerUserId);
    const result = await this.savedCandidateRepo.delete({
      employerId: employer.id,
      candidateId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Ứng viên chưa được lưu trong Talent Pool');
    }

    return { message: 'Đã xóa ứng viên khỏi Talent Pool' };
  }

  async getSavedCandidates(employerUserId: number) {
    const employer = await this.findEmployer(employerUserId);

    return this.savedCandidateRepo.find({
      where: { employerId: employer.id },
      relations: [
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
        'candidate.jobCategories',
        'candidate.jobType',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async sendJobInvitation(employerUserId: number, dto: CreateJobInvitationDto) {
    const employer = await this.findEmployerWithCompany(employerUserId);

    // VIP gate: chỉ VIP mới được gửi thư mời
    const { package: pkg } =
      await this.subscriptionsService.getActiveSubscription(employer.companyId);
    if (!pkg.canHeadhuntSaveAndInvite) {
      throw new ForbiddenException(
        'Tính năng gửi thư mời ứng tuyển yêu cầu gói VIP',
      );
    }

    // FIX: Kiểm tra Job tồn tại + thuộc công ty + đang PUBLISHED
    const job = await this.jobRepo.findOne({
      where: { id: dto.jobId, companyId: employer.companyId },
      relations: ['company'],
    });
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }
    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new BadRequestException(
        'Chỉ có thể gửi thư mời cho tin tuyển dụng đang đăng tuyển',
      );
    }

    const candidate = await this.candidateRepo.findOne({
      where: { id: dto.candidateId, isPublic: true },
      relations: ['user'],
    });
    if (!candidate) {
      throw new NotFoundException('Ứng viên không tồn tại hoặc đã ẩn hồ sơ');
    }

    const existing = await this.invitationRepo.findOne({
      where: { jobId: dto.jobId, candidateId: dto.candidateId },
    });
    if (existing) {
      throw new BadRequestException(
        'Bạn đã gửi thư mời cho ứng viên này vào vị trí này rồi',
      );
    }

    const invitation = this.invitationRepo.create({
      employerId: employer.id,
      candidateId: dto.candidateId,
      jobId: dto.jobId,
      message: dto.message,
      status: InvitationStatus.PENDING,
    });

    const savedInvitation = await this.invitationRepo.save(invitation);

    // --- REAL-TIME NOTIFICATION ---
    await this.notificationsService.createNotification({
      userId: candidate.userId,
      type: NotificationType.HEADHUNT_INVITATION,
      title: 'Lời mời công việc mới',
      content: `Bạn nhận được lời mời ứng tuyển vào vị trí "${job.title}" từ công ty ${job.company?.name || 'nhà tuyển dụng'}.`,
      metadata: {
        jobId: job.id,
        invitationId: savedInvitation.id,
      },
    });

    // --- EMAIL NOTIFICATION ---
    if (candidate.user?.email) {
      const appUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      const actionUrl = `${appUrl}/candidate/invitations/${savedInvitation.id}`;

      void this.mailService.sendJobInvitationEmail(
        candidate.user.email,
        candidate.fullName || 'Ứng viên',
        job.title,
        job.company?.name || 'Công ty',
        actionUrl,
        dto.message || undefined,
      );
    }

    return savedInvitation;
  }

  async getSentInvitations(employerUserId: number) {
    const employer = await this.findEmployer(employerUserId);
    return this.invitationRepo.find({
      where: { employerId: employer.id },
      relations: ['candidate', 'job'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Chỉ kiểm tra tài khoản có phải employer không.
   * Dùng cho các action cá nhân: xem/quản lý saved candidates, xem profile ứng viên.
   * Employer bị remove khỏi công ty (companyId = null) vẫn có thể dùng.
   */
  private async findEmployer(userId: number): Promise<EmployerEntity> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    return employer;
  }

  /**
   * Kiểm tra tài khoản là employer VÀ đang thuộc một công ty.
   * Dùng cho các action liên quan đến job/company: tìm kiếm, gợi ý, gửi thư mời.
   */
  private async findEmployerWithCompany(
    userId: number,
  ): Promise<EmployerEntity & { companyId: number }> {
    const employer = await this.findEmployer(userId);
    if (employer.companyId === null || employer.companyId === undefined) {
      throw new ForbiddenException(
        'Bạn đã bị xóa khỏi công ty. Vui lòng liên hệ admin để được hỗ trợ.',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
