import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { JobFilterDto } from '../dto/job-filter.dto';
import { getPaginatedResult } from '../../common/utils/pagination.util';
import { JobSortBy, SortOrder } from '../../common/enums/sort-order.enum';

@Injectable()
export class PublicJobsService {
  private readonly logger = new Logger(PublicJobsService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  async getPublicJobs(filterDto: JobFilterDto) {
    const { page, limit } = filterDto;

    const qb = this.buildBaseQuery();
    this.applyTextSearch(qb, filterDto);
    this.applyBasicFilters(qb, filterDto);
    this.applySalaryFilter(qb, filterDto);
    this.applySkillFilter(qb, filterDto);
    this.applyDeadlineFilter(qb, filterDto);
    this.applySort(qb, filterDto);

    return getPaginatedResult(qb, page, limit);
  }

  async getCompanyJobsBySlug(slug: string, filterDto: JobFilterDto) {
    const { page, limit } = filterDto;

    const qb = this.buildBaseQuery();
    qb.andWhere('company.slug = :slug', { slug });

    this.applyTextSearch(qb, filterDto);
    this.applyBasicFilters(qb, filterDto);
    this.applySalaryFilter(qb, filterDto);
    this.applySkillFilter(qb, filterDto);
    this.applyDeadlineFilter(qb, filterDto);
    this.applySort(qb, filterDto);

    return getPaginatedResult(qb, page, limit);
  }

  async getJobDetail(jobId: number) {
    const job = await this.jobRepository.findOne({
      where: { id: jobId, status: JobStatus.PUBLISHED },
      relations: [
        'company',
        'employer',
        'province',
        'category',
        'jobType',
        'level',
        'skills',
        'skills.skillMetadata',
      ],
    });

    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại hoặc đã đóng');
    }

    const { company, employer, ...jobData } = job;

    const safeCompany = company
      ? {
          id: company.id,
          name: company.name,
          emailContact: company.emailContact,
          phoneContact: company.phoneContact,
          address: company.address,
          provinceId: company.provinceId,
          logoUrl: company.logoUrl,
          bannerUrl: company.bannerUrl,
          description: company.description,
          content: company.content,
          companySize: company.companySize,
          websiteUrl: company.websiteUrl,
          facebookUrl: company.facebookUrl,
          linkedinUrl: company.linkedinUrl,
          slug: company.slug,
          images: company.images,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
        }
      : null;

    const safeEmployer = employer
      ? {
          id: employer.id,
          fullName: employer.fullName,
          phoneContact: employer.phoneContact,
          avatarUrl: employer.avatarUrl,
          isAdminCompany: employer.isAdminCompany,
        }
      : null;

    return { ...jobData, company: safeCompany, employer: safeEmployer };
  }

  // ─── Query Builders ───────────────────────────────────────────────────────

  /**
   * Base query với slim JOINs:
   * - Dùng leftJoin + addSelect thay vì leftJoinAndSelect để chỉ load columns cần thiết.
   * - Giảm payload trả về từ DB, tránh load description/content/images… trong list view.
   */
  private buildBaseQuery(): SelectQueryBuilder<JobEntity> {
    return (
      this.jobRepository
        .createQueryBuilder('job')
        // Company: chỉ lấy fields dùng trong list card
        .leftJoin('job.company', 'company')
        .addSelect([
          'company.id',
          'company.name',
          'company.logoUrl',
          'company.bannerUrl',
          'company.description',
          'company.websiteUrl',
          'company.slug',
        ])
        // Metadata lookups: slim selects
        .leftJoin('job.province', 'province')
        .addSelect(['province.code', 'province.name'])
        .leftJoin('job.category', 'category')
        .addSelect(['category.id', 'category.name'])
        .leftJoin('job.jobType', 'jobType')
        .addSelect(['jobType.id', 'jobType.name'])
        .leftJoin('job.level', 'level')
        .addSelect(['level.id', 'level.name'])
        // Skills: list card hiển thị skill tags nên luôn join
        .leftJoin('job.skills', 'skillTag')
        .leftJoin('skillTag.skillMetadata', 'skillMeta')
        .addSelect([
          'skillTag.id',
          'skillMeta.id',
          'skillMeta.canonicalName',
          'skillMeta.type',
        ])
        .where('job.status = :status', { status: JobStatus.PUBLISHED })
    );
  }

  /**
   * Full-text search trên title.
   * Nếu keyword > 3 ký tự → cũng search thêm trong description.
   */
  private applyTextSearch(
    qb: SelectQueryBuilder<JobEntity>,
    dto: JobFilterDto,
  ): void {
    const { keyword } = dto;
    if (!keyword) return;

    const pattern = `%${keyword}%`;

    if (keyword.length > 3) {
      qb.andWhere('(job.title ILIKE :kw OR job.description ILIKE :kw)', {
        kw: pattern,
      });
    } else {
      qb.andWhere('job.title ILIKE :kw', { kw: pattern });
    }
  }

  /**
   * Các filter đơn giản: province, category, jobType, level, degree, experience.
   */
  private applyBasicFilters(
    qb: SelectQueryBuilder<JobEntity>,
    dto: JobFilterDto,
  ): void {
    const {
      provinceId,
      categoryId,
      jobTypeId,
      levelId,
      requiredDegree,
      maxYearsRequired,
      status,
    } = dto;

    if (provinceId) {
      qb.andWhere('job.provinceId = :provinceId', { provinceId });
    }
    if (categoryId) {
      qb.andWhere('job.categoryId = :categoryId', { categoryId });
    }
    if (jobTypeId) {
      qb.andWhere('job.jobTypeId = :jobTypeId', { jobTypeId });
    }
    if (levelId) {
      qb.andWhere('job.levelId = :levelId', { levelId });
    }
    if (requiredDegree) {
      qb.andWhere('job.requiredDegree = :requiredDegree', { requiredDegree });
    }
    if (maxYearsRequired != null) {
      qb.andWhere(
        '(job.yearsOfExperience IS NULL OR job.yearsOfExperience <= :maxYearsRequired)',
        { maxYearsRequired },
      );
    }
    // status chỉ dùng cho employer/admin, override PUBLISHED condition
    if (status) {
      qb.andWhere('job.status = :filterStatus', { filterStatus: status });
    }
  }

  /**
   * Salary overlap filter:
   * Tìm job có khoảng lương GIAO THOA với khoảng mong muốn của UV.
   * salary = null → không chặn (không ghi lương thì coi như mọi mức đều phù hợp).
   */
  private applySalaryFilter(
    qb: SelectQueryBuilder<JobEntity>,
    dto: JobFilterDto,
  ): void {
    const { salaryMin, salaryMax } = dto;

    if (salaryMin != null) {
      qb.andWhere('(job.salaryMax IS NULL OR job.salaryMax >= :salaryMin)', {
        salaryMin,
      });
    }
    if (salaryMax != null) {
      qb.andWhere('(job.salaryMin IS NULL OR job.salaryMin <= :salaryMax)', {
        salaryMax,
      });
    }
  }

  /**
   * Skill filter — OR logic.
   * Dùng EXISTS subquery để tránh duplicate rows khi join.
   */
  private applySkillFilter(
    qb: SelectQueryBuilder<JobEntity>,
    dto: JobFilterDto,
  ): void {
    const { skillIds } = dto;
    if (!skillIds || skillIds.length === 0) return;

    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM job_skill_tag jst
        WHERE jst.job_id = job.id
          AND jst.skill_id IN (:...skillIds)
      )`,
      { skillIds },
    );
  }

  /**
   * Deadline filter: chỉ hiện job có deadline = NULL hoặc deadline > NOW().
   */
  private applyDeadlineFilter(
    qb: SelectQueryBuilder<JobEntity>,
    dto: JobFilterDto,
  ): void {
    if (dto.hasDeadline) {
      qb.andWhere('(job.deadline IS NULL OR job.deadline > NOW())');
    }
  }

  /**
   * Sort logic:
   * - [Fix F] Bumped jobs luôn lên đầu (isBumped=true AND bumpedUntil > NOW())
   * - RELEVANCE: parameterized CASE expression (safe khỏi SQL injection)
   * - Các field khác: sort trực tiếp
   */
  private applySort(
    qb: SelectQueryBuilder<JobEntity>,
    dto: JobFilterDto,
  ): void {
    const { sortBy, sortOrder, keyword, provinceId, categoryId } = dto;

    // [Fix F] Bumped tin luôn ưu tiên lên đầu, bất kể sort mode.
    // Dùng addSelect + alias thay vì raw column string trong addOrderBy —
    // TypeORM resolve alias trực tiếp, không intercept dot-notation.
    qb.addSelect(
      'CASE WHEN job.isBumped = true AND job.bumpedUntil > NOW() THEN 0 ELSE 1 END',
      'bump_priority',
    )
      .addOrderBy('bump_priority', 'ASC')
      .addOrderBy('job.bumpedAt', 'DESC', 'NULLS LAST');

    if (sortBy === JobSortBy.RELEVANCE) {
      /**
       * Composite relevance score — hoàn toàn parameterized để tránh SQL injection.
       * Điểm: title match = 10, province match = 5, category match = 3.
       *
       * NOTE: Dùng raw CASE expression trực tiếp trong orderBy().
       * getCount() + getMany() riêng (xem pagination.util.ts) tránh lỗi TypeORM
       * "alias was not found" từ getManyAndCount().
       */
      const parts: string[] = [];
      const params: Record<string, unknown> = {};

      if (keyword) {
        parts.push('CASE WHEN job.title ILIKE :relKw THEN 10 ELSE 0 END');
        params['relKw'] = `%${keyword}%`;
      }
      if (provinceId) {
        parts.push(
          'CASE WHEN job.province_id = :relProvince THEN 5 ELSE 0 END',
        );
        params['relProvince'] = provinceId;
      }
      if (categoryId) {
        parts.push(
          'CASE WHEN job.category_id = :relCategory THEN 3 ELSE 0 END',
        );
        params['relCategory'] = categoryId;
      }

      const scoreExpr = parts.length > 0 ? `(${parts.join(' + ')})` : '0';

      if (Object.keys(params).length > 0) {
        qb.setParameters(params);
      }

      // Tương tự bump_priority: dùng alias để TypeORM không cần parse raw expr
      qb.addSelect(scoreExpr, 'relevance_score')
        .addOrderBy('relevance_score', SortOrder.DESC)
        .addOrderBy('job.createdAt', SortOrder.DESC);
      return;
    }

    const columnMap: Record<string, string> = {
      [JobSortBy.CREATED_AT]: 'job.createdAt',
      [JobSortBy.DEADLINE]: 'job.deadline',
      [JobSortBy.SALARY_MIN]: 'job.salaryMin',
    };

    const column = columnMap[sortBy] ?? 'job.createdAt';
    qb.addOrderBy(column, sortOrder ?? SortOrder.DESC).addOrderBy(
      'job.createdAt',
      SortOrder.DESC,
    );
  }
}
