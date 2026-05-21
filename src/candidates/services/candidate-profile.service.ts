import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SupabaseService } from '../../storage/supabase.service';
import { CandidateEntity } from '../entities/candidate.entity';
import { WorkExperienceEntity } from '../entities/work-experience.entity';
import { EducationEntity } from '../entities/education.entity';
import { ProjectEntity } from '../entities/project.entity';
import { CandidateSkillTagEntity } from '../entities/candidate-skill-tag.entity';
import { CertificateEntity } from '../entities/certificate.entity';
import { CandidateJobCategoryEntity } from '../entities/candidate-job-category.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { STORAGE_PATHS } from '../../common/constants/storage-paths.constant';
import { JobApplicationEntity } from '../../applications/entities/job-application.entity';
import { UpstashCacheService } from '../../common/cache/upstash-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/cache/cache-keys.constant';

@Injectable()
export class CandidateProfileService {
  private readonly logger = new Logger(CandidateProfileService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(WorkExperienceEntity)
    private readonly workExperienceRepository: Repository<WorkExperienceEntity>,
    @InjectRepository(EducationEntity)
    private readonly educationRepository: Repository<EducationEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(CandidateSkillTagEntity)
    private readonly skillTagRepository: Repository<CandidateSkillTagEntity>,
    @InjectRepository(CertificateEntity)
    private readonly certificateRepository: Repository<CertificateEntity>,
    @InjectRepository(CandidateJobCategoryEntity)
    private readonly candidateJobCategoryRepository: Repository<CandidateJobCategoryEntity>,
    @InjectRepository(JobApplicationEntity)
    private readonly jobApplicationRepository: Repository<JobApplicationEntity>,
    private readonly supabaseService: SupabaseService,
    private readonly cacheService: UpstashCacheService,
  ) {}

  async getProfile(userId: number, reqCandidateId?: number) {
    const cacheKey = CACHE_KEYS.CANDIDATE_PROFILE(userId);
    const cached = await this.cacheService.get<CandidateEntity>(cacheKey);
    if (cached) return cached;

    const qb = this.candidateRepository
      .createQueryBuilder('candidate')
      // Scalar relations (ManyToOne → single row join — very cheap)
      .leftJoinAndSelect('candidate.jobType', 'jobType')
      .leftJoinAndSelect('candidate.level', 'level')
      // Collection relations (OneToMany — each adds one extra join, NOT N+1)
      .leftJoinAndSelect('candidate.workExperiences', 'workExperiences')
      .leftJoinAndSelect('candidate.educations', 'educations')
      .leftJoinAndSelect('candidate.projects', 'projects')
      .leftJoinAndSelect('candidate.certificates', 'certificates')
      .leftJoinAndSelect('candidate.skills', 'skills')
      .leftJoinAndSelect('skills.skillMetadata', 'skillMetadata')
      .leftJoinAndSelect('candidate.jobCategories', 'jobCategories')
      .leftJoinAndSelect('jobCategories.jobCategory', 'jobCategory');

    if (reqCandidateId) {
      qb.where('candidate.id = :id', { id: reqCandidateId });
    } else {
      qb.where('candidate.userId = :userId', { userId });
    }

    const candidate = await qb.getOne();

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    await this.cacheService.set(
      CACHE_KEYS.CANDIDATE_PROFILE(userId),
      candidate,
      CACHE_TTL.CANDIDATE_PROFILE,
    );

    return candidate;
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });

    if (!candidate) throw new NotFoundException('Candidate profile not found');

    Object.assign(candidate, updateProfileDto);
    const saved = await this.candidateRepository.save(candidate);
    // Invalidate cache sau khi cập nhật profile
    await this.cacheService.del(CACHE_KEYS.CANDIDATE_PROFILE(userId));
    return saved;
  }

  async updateVisibility(userId: number, isPublic: boolean) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });

    if (!candidate) throw new NotFoundException('Candidate profile not found');

    candidate.isPublic = isPublic;
    await this.candidateRepository.save(candidate);
    // Invalidate cache vì trạng thái public đã thay đổi
    await this.cacheService.del(CACHE_KEYS.CANDIDATE_PROFILE(userId));
    return {
      message: isPublic ? 'Hồ sơ đã bật công khai' : 'Hồ sơ đã được ẩn',
      isPublic,
    };
  }

  async uploadCv(userId: number, file: Express.Multer.File) {
    const candidate = await this.findCandidateByUserId(userId);

    const oldCvUrl = candidate.cvUrl ?? null;
    const uniqueId = Date.now();
    const filePath = `${STORAGE_PATHS.CANDIDATES.BASE}/${userId}/cv_${uniqueId}.pdf`;

    // Upload new CV and update DB record
    const { publicUrl } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      filePath,
      async (url) => {
        candidate.cvUrl = url;
        await this.candidateRepository.save(candidate);
        return { cvUrl: url };
      },
      // Don't pass oldFilePath here — we handle deletion manually below
      // to check snapshot references first.
    );

    // After successful DB update, clean up old file only if it is NOT
    // referenced as a snapshot in any job_application record.
    if (oldCvUrl) {
      const oldFilePath = `${STORAGE_PATHS.CANDIDATES.BASE}/${userId}/${oldCvUrl.split('/').pop()}`;

      const snapshotCount = await this.jobApplicationRepository.count({
        where: { cvUrlSnapshot: oldCvUrl },
      });

      if (snapshotCount === 0) {
        // Safe to delete — no recruiter is holding a reference to this file.
        await this.supabaseService
          .deleteFile(oldFilePath)
          .catch((e: Error) =>
            this.logger.error(
              `Failed to delete old CV file (${oldFilePath}): ${e.message}`,
            ),
          );
      } else {
        this.logger.log(
          `Old CV file kept: still referenced by ${snapshotCount} application snapshot(s). URL: ${oldCvUrl}`,
        );
      }
    }

    return { cvUrl: publicUrl };
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    const candidate = await this.findCandidateByUserId(userId);

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const filePath = `${STORAGE_PATHS.CANDIDATES.BASE}/${userId}/avatar_${Date.now()}.${ext}`;
    const oldFilePath = candidate.avatarUrl
      ? `${STORAGE_PATHS.CANDIDATES.BASE}/${userId}/${candidate.avatarUrl.split('/').pop()}`
      : undefined;

    const { result } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      filePath,
      async (publicUrl) => {
        candidate.avatarUrl = publicUrl;
        await this.candidateRepository.save(candidate);
        return { avatarUrl: publicUrl };
      },
      oldFilePath,
    );

    return result;
  }

  async createCoreProfile(
    data: {
      userId: number;
      firstName: string;
      lastName: string;
      phone: string;
      provinceId: number;
    },
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(CandidateEntity)
      : this.candidateRepository;

    const candidate = repo.create({
      userId: data.userId,
      fullName: `${data.lastName} ${data.firstName}`,
      phone: data.phone,
      provinceId: data.provinceId,
    });
    return repo.save(candidate);
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }
    return candidate;
  }
}
