import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { SavedJobEntity } from '../entities/saved-job.entity';
import { JobEntity, JobStatus } from '../../jobs/entities/job.entity';

@Injectable()
export class CandidateSavedJobsService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(SavedJobEntity)
    private readonly savedJobRepo: Repository<SavedJobEntity>,
    @InjectRepository(JobEntity)
    private readonly jobRepo: Repository<JobEntity>,
  ) {}

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepo.findOne({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException('Không знайдено hồ sơ ứng viên');
    }
    return candidate;
  }

  async saveJob(userId: number, jobId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException('Tin tuyển dụng không tồn tại');
    }

    if (job.status !== (JobStatus.PUBLISHED as string)) {
      throw new NotFoundException('Tin tuyển dụng không khả dụng để lưu');
    }

    const existing = await this.savedJobRepo.findOne({
      where: { candidateId: candidate.id, jobId },
    });

    if (existing) {
      throw new ConflictException('Bạn đã lưu tin tuyển dụng này rồi');
    }

    const savedJob = this.savedJobRepo.create({
      candidateId: candidate.id,
      jobId,
    });

    await this.savedJobRepo.save(savedJob);
    return { message: 'Đã lưu việc làm thành công', saved: true };
  }

  async unsaveJob(userId: number, jobId: number) {
    const candidate = await this.findCandidateByUserId(userId);

    const existing = await this.savedJobRepo.findOne({
      where: { candidateId: candidate.id, jobId },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy tin tuyển dụng đã lưu');
    }

    await this.savedJobRepo.remove(existing);
    return { message: 'Đã bỏ lưu tin tuyển dụng', saved: false };
  }

  async getSavedJobs(userId: number, page = 1, limit = 10) {
    const candidate = await this.findCandidateByUserId(userId);
    const skip = (page - 1) * limit;

    // Use QueryBuilder to fetch jobs with relation to company directly for performance
    const qb = this.savedJobRepo
      .createQueryBuilder('sj')
      .innerJoinAndSelect('sj.job', 'job')
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
      .where('sj.candidateId = :candidateId', { candidateId: candidate.id })
      .orderBy('sj.savedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async checkSaved(userId: number, jobId: number) {
    try {
      const candidate = await this.candidateRepo.findOne({ where: { userId } });
      if (!candidate) return { isSaved: false };

      const existing = await this.savedJobRepo.findOne({
        where: { candidateId: candidate.id, jobId },
      });

      return { isSaved: !!existing };
    } catch {
      return { isSaved: false };
    }
  }
}
