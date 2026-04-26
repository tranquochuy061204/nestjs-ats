import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { CandidateEntity } from '../../candidates/entities/candidate.entity';

@Injectable()
export class CandidateJobsService {
  private readonly logger = new Logger(CandidateJobsService.name);

  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
  ) {}

  async getRecommendedJobs(userId: number, page = 1, limit = 10) {
    const candidate = await this.candidateRepo.findOne({
      where: { userId },
      relations: ['skills', 'jobCategories'],
    });

    if (!candidate) {
      throw new NotFoundException('Không tìm thấy hồ sơ ứng viên');
    }

    const candidateSkillIds =
      candidate.skills?.map((s) => s.skillMetadataId).filter(Boolean) || [];
    const candidateCategoryIds =
      candidate.jobCategories?.map((c) => c.jobCategoryId).filter(Boolean) ||
      [];

    const qb = this.jobRepo
      .createQueryBuilder('job')
      .leftJoin('job.company', 'company')
      .addSelect([
        'company.id',
        'company.name',
        'company.logoUrl',
        'company.bannerUrl',
        'company.slug',
      ])
      .leftJoin('job.province', 'province')
      .addSelect(['province.code', 'province.name'])
      .leftJoin('job.category', 'category')
      .addSelect(['category.id', 'category.name'])
      .leftJoin('job.jobType', 'jobType')
      .addSelect(['jobType.id', 'jobType.name'])
      .leftJoin('job.level', 'level')
      .addSelect(['level.id', 'level.name'])
      .leftJoin('job.skills', 'skillTag')
      .leftJoin('skillTag.skillMetadata', 'skillMeta')
      .addSelect([
        'skillTag.id',
        'skillMeta.id',
        'skillMeta.canonicalName',
        'skillMeta.type',
      ])
      .where('job.status = :status', { status: JobStatus.PUBLISHED })
      .andWhere('(job.deadline IS NULL OR job.deadline > NOW())');

    const parts: string[] = [];
    const params: Record<string, unknown> = {};

    if (candidateCategoryIds.length > 0) {
      parts.push(
        'CASE WHEN job.category_id IN (:...catIds) THEN 20 ELSE 0 END',
      );
      params['catIds'] = candidateCategoryIds;
    }

    if (candidate.provinceId) {
      parts.push('CASE WHEN job.province_id = :provId THEN 15 ELSE 0 END');
      params['provId'] = candidate.provinceId;
    }

    if (candidate.jobTypeId) {
      parts.push('CASE WHEN job.job_type_id = :typeId THEN 10 ELSE 0 END');
      params['typeId'] = candidate.jobTypeId;
    }

    if (candidateSkillIds.length > 0) {
      // Coalesce is used to handle jobs with no skills, returning 0
      const skillIdList = candidateSkillIds.join(',');
      const skillScoreExpr = `COALESCE((SELECT COUNT(DISTINCT jst.skill_id) FROM job_skill_tag jst WHERE jst.job_id = job.id AND jst.skill_id IN (${skillIdList})) * 5, 0)`;
      parts.push(skillScoreExpr);
    }

    if (candidate.yearWorkingExperience != null) {
      parts.push(
        'CASE WHEN job.years_of_experience IS NULL OR job.years_of_experience <= :exp THEN 10 ELSE 0 END',
      );
      params['exp'] = candidate.yearWorkingExperience;
    }

    if (candidate.salaryMin != null) {
      parts.push(
        'CASE WHEN job.salary_max IS NULL OR CAST(job.salary_max AS numeric) >= :salMin THEN 10 ELSE 0 END',
      );
      params['salMin'] = candidate.salaryMin;
    }

    const scoreExpr = parts.length > 0 ? `(${parts.join(' + ')})` : '0';

    if (Object.keys(params).length > 0) {
      qb.setParameters(params);
    }

    // Only recommend jobs with score > 0 if there are criteria
    if (parts.length > 0) {
      qb.andWhere(`${scoreExpr} > 0`);
    }

    qb.orderBy(scoreExpr, 'DESC').addOrderBy('job.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }
}
