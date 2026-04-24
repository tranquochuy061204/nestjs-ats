import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { CandidateFilterDto } from '../dto/candidate-filter.dto';
import { getPaginatedResult } from '../../common/utils/pagination.util';
import { CandidateSortBy, SortOrder } from '../../common/enums/sort-order.enum';

/** Fields ẩn trong kết quả tìm kiếm (thông tin nhạy cảm) */
const HIDDEN_FIELDS = [
  'phone',
  'cvUrl',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
];

@Injectable()
export class CandidateSearchService {
  private readonly logger = new Logger(CandidateSearchService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Tìm kiếm ứng viên đa yếu tố cho employer.
   * Chỉ trả về candidate có isPublic = true.
   * Ẩn các trường nhạy cảm (phone, cvUrl, social links).
   */
  async searchCandidates(dto: CandidateFilterDto) {
    const { page, limit } = dto;

    const qb = this.buildBaseQuery();
    this.applyTextSearch(qb, dto);
    this.applyBasicFilters(qb, dto);
    this.applySalaryFilter(qb, dto);
    this.applySkillFilter(qb, dto);
    this.applyCategoryFilter(qb, dto);
    this.applyExperienceFilter(qb, dto);
    this.applySort(qb, dto);

    const result = await getPaginatedResult(qb, page, limit);

    // Ẩn fields nhạy cảm khỏi response
    return {
      ...result,
      data: result.data.map((c) => this.sanitizeForPublic(c)),
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

  /** Tìm theo tên hoặc vị trí mong muốn. */
  private applyTextSearch(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
  ): void {
    const { keyword } = dto;
    if (!keyword) return;

    qb.andWhere(
      '(candidate.fullName ILIKE :kw OR candidate.position ILIKE :kw)',
      { kw: `%${keyword}%` },
    );
  }

  /** Filters đơn giản: province, jobType. */
  private applyBasicFilters(
    qb: SelectQueryBuilder<CandidateEntity>,
    dto: CandidateFilterDto,
  ): void {
    const { provinceId, jobTypeId } = dto;

    if (provinceId) {
      qb.andWhere('candidate.provinceId = :provinceId', { provinceId });
    }
    if (jobTypeId) {
      qb.andWhere('candidate.jobTypeId = :jobTypeId', { jobTypeId });
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
  ): void {
    const { salaryMin, salaryMax } = dto;

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
  ): void {
    const { skillIds } = dto;
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
  ): void {
    const { categoryIds } = dto;
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
  ): void {
    const { minExperience } = dto;
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

    const column = columnMap[sortBy] ?? 'candidate.id';
    qb.orderBy(column, sortOrder ?? SortOrder.DESC);
  }

  // ─── Data Sanitizer ───────────────────────────────────────────────────────

  /** Ẩn thông tin nhạy cảm trước khi trả về cho employer. */
  private sanitizeForPublic(
    candidate: CandidateEntity,
  ): Partial<CandidateEntity> {
    const result = { ...candidate } as Record<string, unknown>;
    for (const field of HIDDEN_FIELDS) {
      delete result[field];
    }
    return result as Partial<CandidateEntity>;
  }
}
