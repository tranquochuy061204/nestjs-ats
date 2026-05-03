import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { JobEntity, JobStatus } from '../../jobs/entities/job.entity';
import { CandidateFilterDto } from '../dto/candidate-filter.dto';
import { getPaginatedResult } from '../../common/utils/pagination.util';
import { CandidateSortBy, SortOrder } from '../../common/enums/sort-order.enum';
import { ContactUnlockLogEntity } from '../../subscriptions/entities/contact-unlock-log.entity';
import { EmployersService } from '../../employers/employers.service';
import { HEADHUNTING_CONFIG } from '../../common/constants/headhunting.constant';
import { Degree } from '../../common/enums/degree.enum';

import {
  HIDDEN_FIELDS,
  USER_SENSITIVE_FIELDS,
} from '../constants/candidate-search.constant';
import { ScoringWeights } from '../interfaces/candidate-search.interface';

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
        where: { id: jobId, status: JobStatus.PUBLISHED },
        relations: ['skills'],
      });
      if (!job) {
        throw new BadRequestException(
          'Tin tuyển dụng không tồn tại, đã đóng hoặc chưa được duyệt để tìm kiếm ứng viên.',
        );
      }
    }

    const qb = this.buildBaseQuery();
    const weights = this.normalizeWeights(
      (dto.scoring as Partial<ScoringWeights>) || {},
    );

    this.logger.log(
      `🔍 [Search] Incoming weights: ${JSON.stringify(dto.scoring)}`,
    );
    this.logger.log(
      `🔍 [Search] Normalized weights: ${JSON.stringify(weights)}`,
    );

    this.applyTextSearch(qb, dto);

    // Nếu có jobId (tính năng gợi ý), ta nới lỏng các filter cứng để chuyển sang chấm điểm (Scoring)
    // Chỉ dùng filter cứng khi user chủ động lọc trên UI (không có jobId)
    const isSuggestion = !!jobId;

    // Xác định danh sách skill để so khớp (dùng cho cả scoring và trả về metadata)
    const effectiveSkillIds =
      dto.skillIds && dto.skillIds.length > 0
        ? dto.skillIds
        : (job?.skills
            ?.map((s) => s.skillId)
            .filter((id) => !!id) as number[]) || [];

    if (!isSuggestion) {
      this.applyBasicFilters(qb, dto, job);
      this.applySalaryFilter(qb, dto, job);
      this.applySkillFilter(qb, dto, job);
      this.applyCategoryFilter(qb, dto, job);
      this.applyExperienceFilter(qb, dto, job);
    } else {
      // Với gợi ý: vẫn lọc Skill và Category (vì đây là tiêu chí cốt lõi)
      // Nhưng các thông số khác sẽ để Scoring xử lý
      this.applySkillFilter(qb, dto, job);
      this.applyCategoryFilter(qb, dto, job);
    }

    if (dto.sortBy === CandidateSortBy.RELEVANCE || isSuggestion) {
      this.applyRelevanceScoring(qb, dto, weights, job);
    } else {
      this.applySort(qb, dto);
    }

    const result = await getPaginatedResult<CandidateEntity>(qb, page, limit);
    const entities = result.data;
    const entityIds = entities.map((c: CandidateEntity) => c.id);

    // Tính toán matchScore riêng cho danh sách ứng viên này (tránh lỗi join/pagination)
    const scoreMap = new Map<number, { score: string; matchedCount: number }>();
    if (
      entityIds.length > 0 &&
      (dto.sortBy === CandidateSortBy.RELEVANCE || isSuggestion)
    ) {
      const scoreQb = this.candidateRepo
        .createQueryBuilder('candidate')
        .select('candidate.id', 'id')
        .where('candidate.id IN (:...entityIds)', { entityIds });

      // Tính số lượng kỹ năng khớp (chỉ tính nếu có danh sách kỹ năng để so khớp)
      if (effectiveSkillIds.length > 0) {
        scoreQb.addSelect(
          `(SELECT COUNT(*) FROM candidate_skill_tag WHERE candidate_id = candidate.id AND skill_metadata_id IN (${effectiveSkillIds.join(',')}))`,
          'matched_count',
        );
      } else {
        scoreQb.addSelect('0', 'matched_count');
      }

      this.applyRelevanceScoring(scoreQb, dto, weights, job);

      const rawScores = await scoreQb.getRawMany();
      rawScores.forEach(
        (r: { id: number; match_score: string; matched_count: string }) => {
          scoreMap.set(r.id, {
            score: r.match_score,
            matchedCount: parseInt(r.matched_count || '0', 10),
          });
        },
      );
    }

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
      data: entities.map((c: CandidateEntity) => {
        const sanitized = this.sanitizeForPublic(c);
        // Lấy dữ liệu từ Map đã chuẩn bị
        const matchData = scoreMap.get(c.id);
        const matchScoreRaw = matchData?.score;
        const matchScore = matchScoreRaw
          ? parseFloat(matchScoreRaw).toFixed(2)
          : null;

        return {
          ...sanitized,
          contactUnlocked: unlockedCandidateIds.has(c.id),
          matchScore: matchScore ? parseFloat(matchScore) : null,
          matchedSkillsCount: matchData?.matchedCount || 0,
        };
      }),
      appliedWeights: weights,
      totalSkillsCount: effectiveSkillIds.length,
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
    const skillIds = dto.skillIds || job?.skills?.map((s) => s.skillId);
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
    const categoryIds =
      dto.categoryIds || (job?.categoryId ? [job.categoryId] : []);
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

    const columnMap: Partial<Record<CandidateSortBy, string>> = {
      [CandidateSortBy.CREATED_AT]: 'candidate.id',
      [CandidateSortBy.EXPERIENCE]: 'candidate.yearWorkingExperience',
    };

    const column = columnMap[sortBy] ?? 'candidate.id';
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

    const weightsArray = Object.values(merged) as number[];
    const total = weightsArray.reduce((sum, w) => sum + w, 0);

    if (total === 0) return merged;

    return {
      skillWeight: (merged.skillWeight / total) * 100,
      levelWeight: (merged.levelWeight / total) * 100,
      experienceWeight: (merged.experienceWeight / total) * 100,
      salaryWeight: (merged.salaryWeight / total) * 100,
      degreeWeight: (merged.degreeWeight / total) * 100,
      locationWeight: (merged.locationWeight / total) * 100,
      profileWeight: (merged.profileWeight / total) * 100,
    };
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

    const scoreExpr = `(${criteriaScoreExpr}) * (${keywordMultExpr})`;
    qb.addSelect(scoreExpr, 'match_score');
    qb.orderBy('match_score', 'DESC');
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

    const skillIds = dto.skillIds || job?.skills?.map((s) => s.skillId) || [];

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
            WHEN candidate.level_id IS NULL THEN 0.3
            WHEN ABS(candidate.level_id - ${lId}) = 1 THEN 0.6 
            ELSE 0.1 
          END)`
        : '1.0';

    // 3. Experience Match Score
    const expExpr = `(CASE 
      WHEN candidate.year_working_experience >= ${expReq} THEN 1.0
      WHEN candidate.year_working_experience IS NULL THEN 0.3
      WHEN candidate.year_working_experience >= ${expReq} - 1 THEN 0.7
      WHEN candidate.year_working_experience >= ${expReq} - 2 THEN 0.4
      ELSE 0.1
    END)`;

    // 4. Salary Match Score (More lenient)
    const salaryExpr = `(CASE 
      WHEN candidate.salaryMin IS NULL AND candidate.salaryMax IS NULL THEN 0.5
      WHEN candidate.salaryMin <= ${sMax} AND candidate.salaryMax >= ${sMin} THEN 1.0
      WHEN candidate.salaryMin <= ${sMax} * 1.2 AND candidate.salaryMax >= ${sMin} * 0.8 THEN 0.7
      WHEN candidate.salaryMin <= ${sMax} * 1.5 AND candidate.salaryMax >= ${sMin} * 0.5 THEN 0.3
      ELSE 0.1
    END)`;

    // 5. Degree Match Score
    const dReq = dto.requiredDegree || job?.requiredDegree || Degree.NONE;
    const ranks = HEADHUNTING_CONFIG.SEARCH_SCORING.DEGREE_RANK;
    const rRank = ranks[dReq] || 0;
    const degreeExpr = `(CASE 
      WHEN (SELECT MAX(CASE degree WHEN 'postgraduate' THEN 6 WHEN 'university' THEN 5 WHEN 'college' THEN 4 WHEN 'intermediate' THEN 3 WHEN 'high_school' THEN 2 WHEN 'certificate' THEN 1 ELSE 0 END) FROM education WHERE candidate_id = candidate.id) >= ${rRank} THEN 1.0
      WHEN (SELECT MAX(CASE degree WHEN 'postgraduate' THEN 6 WHEN 'university' THEN 5 WHEN 'college' THEN 4 WHEN 'intermediate' THEN 3 WHEN 'high_school' THEN 2 WHEN 'certificate' THEN 1 ELSE 0 END) FROM education WHERE candidate_id = candidate.id) IS NULL THEN 0.2
      ELSE 0.1
    END)`;

    // 6. Location Match Score
    const locExpr =
      pId > 0
        ? `(CASE 
            WHEN candidate.province_id = ${pId} THEN 1.0 
            WHEN candidate.province_id IS NULL THEN 0.5
            ELSE 0.2 
          END)`
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
