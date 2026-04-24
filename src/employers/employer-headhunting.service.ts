import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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

@Injectable()
export class EmployerHeadhuntingService {
  private readonly logger = new Logger(EmployerHeadhuntingService.name);

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
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async getSuggestedCandidates(employerUserId: number, jobId: number) {
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

    const jobSkillIds = job.skills
      .map((s) => s.skillId)
      .filter((id): id is number => id != null);
    const totalJobSkills = jobSkillIds.length;
    const minExp = job.yearsOfExperience ?? 0;
    const jobSalaryMin = job.salaryMin ? Number(job.salaryMin) : null;
    const jobSalaryMax = job.salaryMax ? Number(job.salaryMax) : null;

    // ----------------------------------------------------------------
    // Hệ thống Weighted Composite Scoring (Tổng 100 điểm)
    //   - Kỹ năng khớp:     0-40 điểm
    //   - Kinh nghiệm:      0-25 điểm (>= yêu cầu = 25, không đủ = hard block)
    //   - Lương phù hợp:    0-20 điểm
    //   - Hồ sơ đầy đủ:    0-10 điểm (CV + Work Exp + Cert)
    //   - Địa điểm:         0-5  điểm (cùng tỉnh = 5, khác = 0, không block)
    // ----------------------------------------------------------------

    const { SCORING, THRESHOLDS } = HEADHUNTING_CONFIG;

    // --- 1. SKILL SCORE (0-40) ---
    let skillScoreExpr: string;
    if (jobSkillIds.length > 0) {
      const skillIdList = jobSkillIds.join(',');
      skillScoreExpr = `
        LEAST(${SCORING.MAX_SKILL}, COALESCE(
          (SELECT COUNT(DISTINCT cst.skill_metadata_id)::float
           FROM candidate_skill_tag cst
           WHERE cst.candidate_id = c.id
             AND cst.skill_metadata_id IN (${skillIdList})
          ) / ${totalJobSkills} * ${SCORING.MAX_SKILL},
        0))`;
    } else {
      // Job chưa set kỹ năng → tất cả đều nhận điểm trung tính
      skillScoreExpr = `${SCORING.NEUTRAL_SKILL}`;
    }

    // --- 2. EXPERIENCE SCORE (0-25) ---
    // Ứng viên không đủ kinh nghiệm bị chặn ở WHERE, nên nếu qua được = 25 điểm
    const expScoreExpr = `${SCORING.MAX_EXPERIENCE}`;

    // --- 3. SALARY SCORE (0-20) ---
    // Logic: kỳ vọng lương của ứng viên có nằm trong range của Job không?
    let salaryScoreExpr: string;
    if (jobSalaryMin == null && jobSalaryMax == null) {
      // Job không set lương → không phạt ai
      salaryScoreExpr = `${SCORING.SALARY.PARTIAL}`;
    } else if (jobSalaryMin != null && jobSalaryMax != null) {
      salaryScoreExpr = `
        CASE
          WHEN c.salary_min IS NULL OR c.salary_max IS NULL THEN ${SCORING.SALARY.PARTIAL}
          WHEN CAST(c.salary_min AS float) > ${jobSalaryMax} OR CAST(c.salary_max AS float) < ${jobSalaryMin} THEN ${SCORING.SALARY.MISMATCH}
          WHEN CAST(c.salary_min AS float) >= ${jobSalaryMin} AND CAST(c.salary_max AS float) <= ${jobSalaryMax} THEN ${SCORING.SALARY.MATCH}
          ELSE ${SCORING.SALARY.PARTIAL}
        END`;
    } else {
      // Chỉ có một mốc lương
      const salaryBound = jobSalaryMin ?? jobSalaryMax;
      salaryScoreExpr = `
        CASE
          WHEN c.salary_min IS NULL OR c.salary_max IS NULL THEN ${SCORING.SALARY.PARTIAL}
          WHEN CAST(c.salary_min AS float) <= ${salaryBound} AND CAST(c.salary_max AS float) >= ${salaryBound} THEN ${SCORING.SALARY.MATCH}
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

    // --- 5. LOCATION SCORE (0-5, soft — không block) ---
    const locationScoreExpr =
      job.provinceId != null
        ? `CASE WHEN c.province_id = ${job.provinceId} THEN ${SCORING.LOCATION} ELSE 0 END`
        : `0`;

    const totalScoreExpr = `(
      ${skillScoreExpr}
      + ${expScoreExpr}
      + ${salaryScoreExpr}
      + ${profileScoreExpr}
      + ${locationScoreExpr}
    )`;

    // ----------------------------------------------------------------
    // Build query
    // ----------------------------------------------------------------
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
          job.categoryId
            ? `EXISTS (
                SELECT 1 FROM candidate_job_category cjc
                WHERE cjc.candidate_id = c.id AND cjc.job_category_id = :categoryId
              )`
            : '1=1',
          { categoryId: job.categoryId },
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

        .orderBy(totalScoreExpr, 'DESC')
        .limit(THRESHOLDS.MAX_SUGGESTIONS);

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

      if (qualified.length === 0) return [];

      const orderedIds = qualified.map((r) => Number(r.candidateId));
      const scoreMap = new Map(
        qualified.map((r) => [
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

      // Bước 2: Fetch full entities để trả về đầy đủ thông tin
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

      return orderedIds
        .map((id) => {
          const entity = entityMap.get(id);
          if (!entity) return null;
          return { ...entity, ...scoreMap.get(id) };
        })
        .filter(Boolean);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Lỗi khi tính toán gợi ý ứng viên cho Job #${jobId}: ${errorMessage}`,
        errorStack,
      );
      // Với hệ thống gợi ý, nếu lỗi do SQL hoặc logic tính toán, ta có thể trả về mảng rỗng
      // để không làm sập giao diện của Employer, hoặc throw tùy yêu cầu.
      return [];
    }
  }

  async getCandidateDetail(employerUserId: number, candidateId: number) {
    await this.findEmployer(employerUserId);

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

    return candidate;
  }

  async saveCandidate(
    employerUserId: number,
    candidateId: number,
    dto: SaveCandidateDto,
  ) {
    const employer = await this.findEmployerWithCompany(employerUserId);

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
        this.configService.get<string>('APP_URL') || 'http://localhost:3000';
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
