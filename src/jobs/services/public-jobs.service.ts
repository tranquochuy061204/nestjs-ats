import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobEntity, JobStatus } from '../entities/job.entity';
import { JobFilterDto } from '../dto/job-filter.dto';
import { getPaginatedResult } from '../../common/utils/pagination.util';

@Injectable()
export class PublicJobsService {
  constructor(
    @InjectRepository(JobEntity)
    private readonly jobRepository: Repository<JobEntity>,
  ) {}

  async getPublicJobs(filterDto: JobFilterDto) {
    const {
      page = 1,
      limit = 10,
      keyword,
      provinceId,
      categoryId,
      jobTypeId,
    } = filterDto;

    const qb = this.jobRepository
      .createQueryBuilder('job')
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
      .leftJoinAndSelect('job.province', 'province')
      .leftJoinAndSelect('job.category', 'category')
      .leftJoinAndSelect('job.jobType', 'jobType')
      .leftJoinAndSelect('job.skills', 'skillTag')
      .leftJoinAndSelect('skillTag.skillMetadata', 'skillMeta')
      .where('job.status = :status', { status: JobStatus.PUBLISHED });

    if (keyword) {
      qb.andWhere('job.title ILIKE :keyword', { keyword: `%${keyword}%` });
    }
    if (provinceId) {
      qb.andWhere('job.provinceId = :provinceId', { provinceId });
    }
    if (categoryId) {
      qb.andWhere('job.categoryId = :categoryId', { categoryId });
    }
    if (jobTypeId) {
      qb.andWhere('job.jobTypeId = :jobTypeId', { jobTypeId });
    }

    qb.orderBy('job.createdAt', 'DESC');

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
        'skills',
        'skills.skillMetadata',
      ],
    });

    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại hoặc đã đóng');
    }

    const { company, employer, ...jobData } = job;

    // Lọc dữ liệu an toàn cho Company
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

    // Lọc dữ liệu an toàn cho Employer
    const safeEmployer = employer
      ? {
          id: employer.id,
          fullName: employer.fullName,
          phoneContact: employer.phoneContact,
          avatarUrl: employer.avatarUrl,
          isAdminCompany: employer.isAdminCompany,
        }
      : null;

    return {
      ...jobData,
      company: safeCompany,
      employer: safeEmployer,
    };
  }
}
