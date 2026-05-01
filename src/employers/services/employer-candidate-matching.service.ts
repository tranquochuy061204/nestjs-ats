import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';
import { EmployerEntity } from '../entities/employer.entity';
import { JobEntity, JobStatus } from '../../jobs/entities/job.entity';
import { HEADHUNTING_CONFIG } from '../../common/constants/headhunting.constant';

// New services
import { EmployerContactUnlockService } from './employer-contact-unlock.service';

@Injectable()
export class EmployerCandidateMatchingService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    private readonly unlockService: EmployerContactUnlockService,
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
    const scoreMap = new Map<number, any>(
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
      relations: ['skills', 'skills.skillMetadata', 'jobCategories', 'jobType'],
    });

    const entityMap = new Map(entities.map((e) => [e.id, e]));

    // Check which suggested candidates are already unlocked by this company
    const unlockedLogs = await this.unlockService.getUnlockedCandidateIds(
      employer.companyId,
      orderedIds,
    );
    const unlockedSet = new Set(unlockedLogs);

    const data = orderedIds
      .map((id) => {
        const entity = entityMap.get(id);
        if (!entity) return null;
        const scoreInfo = scoreMap.get(id) as Record<string, any>;

        const masked = this.unlockService.maskCandidate(
          entity,
          unlockedSet.has(id),
        ) as Record<string, any>;

        return {
          ...masked,
          ...scoreInfo,
        };
      })
      .filter((item): item is any => item !== null);

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  private async findEmployerWithCompany(
    employerUserId: number,
  ): Promise<EmployerEntity & { companyId: number }> {
    const employer = await this.employerRepo.findOne({
      where: { userId: employerUserId },
      relations: ['company'],
    });

    if (!employer || !employer.companyId) {
      throw new BadRequestException(
        'Bạn chưa có công ty hoặc chưa được duyệt để thực hiện chức năng này',
      );
    }
    return employer as EmployerEntity & { companyId: number };
  }
}
