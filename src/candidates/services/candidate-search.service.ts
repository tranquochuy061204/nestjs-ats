import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { JobEntity } from '../../jobs/entities/job.entity';
import { CandidateFilterDto } from '../dto/candidate-filter.dto';
import { getPaginatedResult } from '../../common/utils/pagination.util';
import { CandidateSortBy, SortOrder } from '../../common/enums/sort-order.enum';
import { ContactUnlockLogEntity } from '../../subscriptions/entities/contact-unlock-log.entity';
import { EmployersService } from '../../employers/employers.service';
import { HEADHUNTING_CONFIG } from '../../common/constants/headhunting.constant';
import { Degree } from '../../common/enums/degree.enum';

/**
 * Fields nhạy cảm ẩn trực tiếp trên CandidateEntity.
 * NOTE: email KHÔNG có cột trực tiếp trên candidate — nó nằm ở UserEntity.
 *       Xem USER_SENSITIVE_FIELDS bên dưới để mask nested user object.
 */
const HIDDEN_FIELDS: Array<keyof CandidateEntity> = [
  'phone',
  'cvUrl',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
];

/**
 * Fields nhạy cảm cần strip khỏi nested UserEntity nếu relation `user` được load.
 * Đây là lớp bảo vệ thứ hai — buildBaseQuery() cố tình KHÔNG join user.
 * Nếu sau này có ai thêm join user, sanitizer này sẽ tự động ngăn data leak.
 */
const USER_SENSITIVE_FIELDS = [
  'email',
  'password',
  'refreshToken',
  'role',
] as const;

interface ScoringWeights {
  skillWeight: number;
  levelWeight: number;
  experienceWeight: number;
  salaryWeight: number;
  degreeWeight: number;
  locationWeight: number;
  profileWeight: number;
}

@Injectable()
export class CandidateSearchService {
  private readonly logger = new Logger(CandidateSearchService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(ContactUnlockLogEntity)
    private readonly contactUnlockRepo: Repository<ContactUnlockLogEntity>,
    private readonly employersService: EmployersService,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Tìm kiếm ứng viên với filter phức tạp (salary overlap, skill OR, category OR).
   * Chỉ trả về candidate có isPublic = true.
   * Ẩn các trường nhạy cảm (phone, cvUrl, social links).
   */
  async searchCandidates(dto: CandidateFilterDto, employerUserId?: number) {
    const { page, limit, jobId } = dto;

    let job: JobEntity | null = null;
    if (jobId) {
      job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: ['skills'],
      });
    }

    const qb = this.buildBaseQuery();
    const weights = this.normalizeWeights(
      (dto.scoring as Partial<ScoringWeights>) || {},
    );

    this.applyTextSearch(qb, dto);
    this.applyBasicFilters(qb, dto, job);
    this.applySalaryFilter(qb, dto, job);
    this.applySkillFilter(qb, dto, job);
    this.applyCategoryFilter(qb, dto, job);
    this.applyExperienceFilter(qb, dto, job);

    if (dto.sortBy === CandidateSortBy.RELEVANCE) {
      this.applyRelevanceScoring(qb, dto, weights, job);
    } else {
      this.applySort(qb, dto);
    }

    const result = await getPaginatedResult(qb, page, limit);

    let unlockedCandidateIds = new Set<number>();
    if (employerUserId) {
      try {
        const employer = await this.employersService.getProfile(employerUserId);
        if (employer.companyId) {
          const unlockedLogs: Pick<ContactUnlockLogEntity, 'candidateId'>[] =
            await this.contactUnlockRepo.find({
              where: { companyId: employer.companyId },
              select: ['candidateId'],
            });
          unlockedCandidateIds = new Set(
            unlockedLogs.map((log) => log.candidateId),
          );
        }
      } catch (err) {
        this.logger.warn(`Lấy profile employer thất bại: ${err}`);
      }
    }

    // Ẩn fields nhạy cảm khỏi response và thêm status đã unlock
    return {
      ...result,
      data: result.data.map((c) => {
        const sanitized = this.sanitizeForPublic(c);
        return {
          ...sanitized,
          contactUnlocked: unlockedCandidateIds.has(c.id),
        };
      }),
    };
  }

  // ─── Query Builders ───────────────────────────────────────────────────────

  /**
   * Base query với slim JOINs:
   * - Dùng leftJoin + addSelect thay vì leftJoinAndSelect để tránh load toàn bộ entity.
   * - KHÔNG join workExperiences vì không dùng trong filter và rất tốn resources
   *   khi candidate có nhiều entry.
   */
  private buildBaseQuery(): SelectQueryBuilder<CandidateEntity> {
    return (
      this.candidateRepo
        .createQueryBuilder('candidate')
        .where('candidate.isPublic = true')
        // Skills: slim select — chỉ lấy name + type để hiển thị tags
        .leftJoin('candidate.skills', 'skillTag')
        .leftJoin('skillTag.skillMetadata', 'skillMeta')
        .addSelect([
          'skillTag.id',
          'skillMeta.id',
          'skillMeta.canonicalName',
          'skillMeta.type',
        ])
        // Job categories: slim select — chỉ lấy tên ngành
        .leftJoin('candidate.jobCategories', 'jobCat')
        .leftJoin('jobCat.jobCategory', 'categoryMeta')
        .addSelect(['jobCat.id', 'categoryMeta.id', 'categoryMeta.name'])
    );
  }

  /**
   * Tìm theo tên, vị trí, giới thiệu bản thân hoặc các bảng phụ (Kinh nghiệm, Dự án...).
   * Dùng EXISTS để tránh Cartesian Product.
   */
  private applyTextSearch(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
  ): void {
    const { keyword } = dto;
    if (!keyword) return;

    const kw = `%${keyword}%`;

    qb.andWhere(
      new Brackets((orQb) => {
        orQb
          .where('candidate.fullName ILIKE :kw', { kw })
          .orWhere('candidate.position ILIKE :kw', { kw })
          .orWhere('candidate.bio ILIKE :kw', { kw })
          .orWhere(
            `EXISTS (
            SELECT 1 FROM work_experience we 
            WHERE we.candidate_id = candidate.id 
              AND (we.company_name ILIKE :kw OR we.position ILIKE :kw OR we.description ILIKE :kw)
          )`,
            { kw },
          )
          .orWhere(
            `EXISTS (
            SELECT 1 FROM project p 
            WHERE p.candidate_id = candidate.id 
              AND (p.name ILIKE :kw OR p.description ILIKE :kw)
          )`,
            { kw },
          )
          .orWhere(
            `EXISTS (
            SELECT 1 FROM certificate cert 
            WHERE cert.candidate_id = candidate.id 
              AND cert.name ILIKE :kw
          )`,
            { kw },
          )
          .orWhere(
            `EXISTS (
            SELECT 1 FROM education edu 
            WHERE edu.candidate_id = candidate.id 
              AND (edu.school_name ILIKE :kw OR edu.major ILIKE :kw)
          )`,
            { kw },
          );
      }),
    );
  }

  /** Filters đơn giản: province, jobType, level, degree. */
  private applyBasicFilters(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
    job?: JobEntity | null,
  ): void {
    const provinceId = dto.provinceId || job?.provinceId;
    const jobTypeId = dto.jobTypeId || job?.jobTypeId;
    const levelId = dto.levelId || job?.levelId;
    const requiredDegree = dto.requiredDegree || job?.requiredDegree;

    if (provinceId) {
      qb.andWhere('candidate.provinceId = :provinceId', { provinceId });
    }
    if (jobTypeId) {
      qb.andWhere('candidate.jobTypeId = :jobTypeId', { jobTypeId });
    }
    if (levelId) {
      qb.andWhere('candidate.levelId = :levelId', { levelId });
    }
    if (requiredDegree && requiredDegree !== Degree.NONE) {
      const ranks = HEADHUNTING_CONFIG.SEARCH_SCORING.DEGREE_RANK;
      const requiredRank = ranks[requiredDegree] || 0;

      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM education edu 
          WHERE edu.candidate_id = candidate.id 
            AND (
              CASE edu.degree
                WHEN 'postgraduate' THEN 6
                WHEN 'university' THEN 5
                WHEN 'college' THEN 4
                WHEN 'intermediate' THEN 3
                WHEN 'high_school' THEN 2
                WHEN 'certificate' THEN 1
                ELSE 0
              END
            ) >= :requiredRank
        )`,
        { requiredRank },
      );
    }
  }

  /**
   * Salary filter — overlap logic:
   * Tìm candidate có khoảng lương kỳ vọng GIAO THOA với khoảng employer muốn trả.
   * salary = null → không chặn (ứng viên chưa điền lương thì vẫn hiện).
   */
  private applySalaryFilter(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
    job?: JobEntity | null,
  ): void {
    const salaryMin = dto.salaryMin || job?.salaryMin;
    const salaryMax = dto.salaryMax || job?.salaryMax;

    if (salaryMin != null) {
      qb.andWhere(
        '(candidate.salaryMax IS NULL OR candidate.salaryMax >= :salaryMin)',
        { salaryMin },
      );
    }
    if (salaryMax != null) {
      qb.andWhere(
        '(candidate.salaryMin IS NULL OR candidate.salaryMin <= :salaryMax)',
        { salaryMax },
      );
    }
  }

  /**
   * Skill filter — OR logic.
   * Dùng EXISTS subquery để tránh duplicate rows khi join.
   */
  private applySkillFilter(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
    job?: JobEntity | null,
  ): void {
    const skillIds =
      dto.skillIds || job?.skills?.map((s) => s.skillId);
    if (!skillIds || skillIds.length === 0) return;

    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM candidate_skill_tag cst
        WHERE cst.candidate_id = candidate.id
          AND cst.skill_metadata_id IN (:...skillIds)
      )`,
      { skillIds },
    );
  }

  /**
   * Category filter — OR logic.
   * Dùng EXISTS subquery để tránh duplicate rows khi join.
   */
  private applyCategoryFilter(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
    job?: JobEntity | null,
  ): void {
    const categoryIds = dto.categoryIds || (job?.categoryId ? [job.categoryId] : []);
    if (!categoryIds || categoryIds.length === 0) return;

    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM candidate_job_category cjc
        WHERE cjc.candidate_id = candidate.id
          AND cjc.job_category_id IN (:...categoryIds)
      )`,
      { categoryIds },
    );
  }

  /** Experience filter: chỉ lấy candidate có >= minExperience năm kinh nghiệm. */
  private applyExperienceFilter(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
    job?: JobEntity | null,
  ): void {
    const minExperience = dto.minExperience || job?.yearsOfExperience;
    if (minExperience == null) return;

    qb.andWhere(
      '(candidate.yearWorkingExperience IS NULL OR candidate.yearWorkingExperience >= :minExperience)',
      { minExperience },
    );
  }

  /** Sort theo field được chỉ định. */
  private applySort(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
  ): void {
    const { sortBy, sortOrder } = dto;

    const columnMap: Record<string, string> = {
      [CandidateSortBy.CREATED_AT]: 'candidate.id',
      [CandidateSortBy.EXPERIENCE]: 'candidate.yearWorkingExperience',
    };

    const column = columnMap[sortBy as string] ?? 'candidate.id';
    qb.orderBy(column, sortOrder ?? SortOrder.DESC);
  }

  // ─── Scoring Logic ────────────────────────────────────────────────────────

  /** Normalize trọng số về tổng 100. */
  private normalizeWeights(input: Partial<ScoringWeights>): ScoringWeights {
    const defaults = HEADHUNTING_CONFIG.SEARCH_SCORING.DEFAULT_WEIGHTS;
    const merged: ScoringWeights = {
      skillWeight: input.skillWeight ?? defaults.SKILL,
      levelWeight: input.levelWeight ?? defaults.LEVEL,
      experienceWeight: input.experienceWeight ?? defaults.EXPERIENCE,
      salaryWeight: input.salaryWeight ?? defaults.SALARY,
      degreeWeight: input.degreeWeight ?? defaults.DEGREE,
      locationWeight: input.locationWeight ?? defaults.LOCATION,
      profileWeight: input.profileWeight ?? defaults.PROFILE,
    };

    const total = Object.values(merged).reduce(
      (sum: number, w: number) => sum + w,
      0,
    );
    if (total === 0) return defaults as unknown as ScoringWeights;

    const normalized = Object.fromEntries(
      Object.entries(merged).map(([key, val]) => [key, (val / total) * 100]),
    );

    return normalized as unknown as ScoringWeights;
  }

  /**
   * Tính điểm Relevance bằng SQL CASE expressions.
   * finalScore = criteriaScore * keywordMultiplier
   */
  private applyRelevanceScoring(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
    weights: ScoringWeights,
    job?: JobEntity | null,
  ): void {
    const criteriaScoreExpr = this.buildCriteriaScoreExpr(dto, weights, job);
    const keywordMultExpr = this.buildKeywordMultiplierExpr(dto);

    qb.addSelect(`(${criteriaScoreExpr}) * (${keywordMultExpr})`, 'matchScore');

    // Filter out candidates with very low relevance if needed
    // qb.andHaving('matchScore >= :minScore', { minScore: HEADHUNTING_CONFIG.SEARCH_SCORING.MIN_RELEVANCE_SCORE });

    qb.orderBy('matchScore', 'DESC');
  }

  /** Tính hệ số nhân dựa trên vị trí khớp từ khóa. */
  private buildKeywordMultiplierExpr(dto: CandidateFilterDto): string {
    const { keyword } = dto;
    if (!keyword) return '1.0';

    const mult = HEADHUNTING_CONFIG.SEARCH_SCORING.KEYWORD_MULTIPLIER;
    const kw = `%${keyword}%`;

    return `(
      CASE 
        WHEN candidate.fullName ILIKE '${kw}' OR candidate.position ILIKE '${kw}' THEN ${mult.NAME_POSITION}
        WHEN EXISTS (SELECT 1 FROM candidate_skill_tag cst JOIN skill_metadata sm ON sm.id = cst.skill_metadata_id WHERE cst.candidate_id = candidate.id AND sm.canonicalName ILIKE '${kw}') THEN ${mult.SKILL}
        WHEN candidate.bio ILIKE '${kw}' THEN ${mult.BIO}
        ELSE ${mult.OTHER}
      END
    )`;
  }

  /** Tính điểm tiêu chí có trọng số (Skills, Level, Exp, Salary, Degree, Location, Profile). */
  private buildCriteriaScoreExpr(
    dto: CandidateFilterDto,
    weights: ScoringWeights,
    job?: JobEntity | null,
  ): string {
    const sMin = dto.salaryMin || job?.salaryMin || 0;
    const sMax = dto.salaryMax || job?.salaryMax || 999999999;
    const expReq = dto.minExperience || job?.yearsOfExperience || 0;
    const pId = dto.provinceId || job?.provinceId || 0;
    const lId = dto.levelId || job?.levelId || 0;

    const skillIds =
      dto.skillIds || job?.skills?.map((s) => s.skillId) || [];

    // 1. Skill Match Score (0 - 1)
    const skillExpr =
      skillIds.length > 0
        ? `(CAST((SELECT COUNT(*) FROM candidate_skill_tag WHERE candidate_id = candidate.id AND skill_metadata_id IN (${skillIds.join(',')})) AS FLOAT) / ${skillIds.length})`
        : '0.5';

    // 2. Level Match Score
    const levelExpr =
      lId > 0
        ? `(CASE 
            WHEN candidate.level_id = ${lId} THEN 1.0 
            WHEN ABS(candidate.level_id - ${lId}) = 1 THEN 0.5 
            ELSE 0 
          END)`
        : '1.0';

    // 3. Experience Match Score
    const expExpr = `(CASE 
      WHEN candidate.year_working_experience >= ${expReq} THEN 1.0
      WHEN candidate.year_working_experience >= ${expReq} - 1 THEN 0.5
      ELSE 0
    END)`;

    // 4. Salary Match Score (Simplified overlap)
    const salaryExpr = `(CASE 
      WHEN candidate.salaryMin <= ${sMax} AND candidate.salaryMax >= ${sMin} THEN 1.0
      WHEN candidate.salaryMin <= ${sMax} OR candidate.salaryMax >= ${sMin} THEN 0.5
      ELSE 0
    END)`;

    // 5. Degree Match Score
    const dReq = dto.requiredDegree || job?.requiredDegree || Degree.NONE;
    const ranks = HEADHUNTING_CONFIG.SEARCH_SCORING.DEGREE_RANK;
    const rRank = ranks[dReq] || 0;
    const degreeExpr = `(CASE 
      WHEN (SELECT MAX(CASE degree WHEN 'postgraduate' THEN 6 WHEN 'university' THEN 5 WHEN 'college' THEN 4 WHEN 'intermediate' THEN 3 WHEN 'high_school' THEN 2 WHEN 'certificate' THEN 1 ELSE 0 END) FROM education WHERE candidate_id = candidate.id) >= ${rRank} THEN 1.0
      ELSE 0
    END)`;

    // 6. Location Match Score
    const locExpr =
      pId > 0
        ? `(CASE WHEN candidate.province_id = ${pId} THEN 1.0 ELSE 0 END)`
        : '1.0';

    // 7. Profile Completeness Score
    const profileExpr = `(
      (CASE WHEN candidate.cv_url IS NOT NULL THEN 0.4 ELSE 0 END) +
      (CASE WHEN EXISTS(SELECT 1 FROM work_experience WHERE candidate_id = candidate.id) THEN 0.4 ELSE 0 END) +
      (CASE WHEN EXISTS(SELECT 1 FROM certificate WHERE candidate_id = candidate.id) THEN 0.2 ELSE 0 END)
    )`;

    return `(
      (${skillExpr} * ${weights.skillWeight}) +
      (${levelExpr} * ${weights.levelWeight}) +
      (${expExpr} * ${weights.experienceWeight}) +
      (${salaryExpr} * ${weights.salaryWeight}) +
      (${degreeExpr} * ${weights.degreeWeight}) +
      (${locExpr} * ${weights.locationWeight}) +
      (${profileExpr} * ${weights.profileWeight})
    )`;
  }

  // ─── Data Sanitizer ───────────────────────────────────────────────────────

  /**
   * Ẩn thông tin nhạy cảm trước khi trả về cho employer.
   *
   * Hai lớp bảo vệ (thuần in-memory, không thêm SQL):
   *  1. Strip HIDDEN_FIELDS khỏi candidate (phone, cvUrl, social links)
   *  2. Strip USER_SENSITIVE_FIELDS khỏi nested `user` object nếu được load
   *     → defensive guard: buildBaseQuery() cố tình không join user,
   *       nhưng nếu code tương lai thêm join, layer này sẽ ngăn leak.
   */
  private sanitizeForPublic(
    candidate: CandidateEntity,
  ): Partial<CandidateEntity> {
    const result = { ...candidate } as Record<string, unknown>;

    // Layer 1: Strip sensitive top-level fields
    for (const field of HIDDEN_FIELDS) {
      delete result[field];
    }

    // Layer 2: Strip sensitive fields from nested user relation (if loaded)
    if (result['user'] != null && typeof result['user'] === 'object') {
      const sanitizedUser = { ...(result['user'] as Record<string, unknown>) };
      for (const field of USER_SENSITIVE_FIELDS) {
        delete sanitizedUser[field];
      }
      result['user'] = sanitizedUser;
    }

    return result as Partial<CandidateEntity>;
  }
}
