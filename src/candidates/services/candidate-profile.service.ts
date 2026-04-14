import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly supabaseService: SupabaseService,
  ) {}

  async getProfile(userId: number, reqCandidateId?: number) {
    const where = reqCandidateId ? { id: reqCandidateId } : { userId };

    const candidate = await this.candidateRepository.findOne({
      where,
      relations: ['jobType'],
    });

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    const [
      workExperiences,
      educations,
      projects,
      certificates,
      skills,
      jobCategories,
    ] = await Promise.all([
      this.workExperienceRepository.find({
        where: { candidateId: candidate.id },
      }),
      this.educationRepository.find({
        where: { candidateId: candidate.id },
      }),
      this.projectRepository.find({
        where: { candidateId: candidate.id },
      }),
      this.certificateRepository.find({
        where: { candidateId: candidate.id },
      }),
      this.skillTagRepository.find({
        where: { candidateId: candidate.id },
        relations: ['skillMetadata'],
      }),
      this.candidateJobCategoryRepository.find({
        where: { candidateId: candidate.id },
        relations: ['jobCategory'],
      }),
    ]);

    candidate.workExperiences = workExperiences;
    candidate.educations = educations;
    candidate.projects = projects;
    candidate.certificates = certificates;
    candidate.skills = skills;
    candidate.jobCategories = jobCategories;

    return candidate;
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });

    if (!candidate) throw new NotFoundException('Candidate profile not found');

    Object.assign(candidate, updateProfileDto);
    return this.candidateRepository.save(candidate);
  }

  async updateVisibility(userId: number, isPublic: boolean) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });

    if (!candidate) throw new NotFoundException('Candidate profile not found');

    candidate.isPublic = isPublic;
    await this.candidateRepository.save(candidate);
    return {
      message: isPublic ? 'Hồ sơ đã bật công khai' : 'Hồ sơ đã được ẩn',
      isPublic,
    };
  }

  async uploadCv(userId: number, file: Express.Multer.File) {
    const candidate = await this.findCandidateByUserId(userId);

    const uniqueId = Date.now();
    const filePath = `${STORAGE_PATHS.CANDIDATES.BASE}/${userId}/cv_${uniqueId}.pdf`;
    const oldFilePath = candidate.cvUrl
      ? `${STORAGE_PATHS.CANDIDATES.BASE}/${userId}/${candidate.cvUrl.split('/').pop()}`
      : undefined;

    const { result } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      filePath,
      async (publicUrl) => {
        candidate.cvUrl = publicUrl;
        await this.candidateRepository.save(candidate);
        return { cvUrl: publicUrl };
      },
      oldFilePath,
    );

    return result;
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

  async createCoreProfile(data: {
    userId: number;
    firstName: string;
    lastName: string;
    phone: string;
    provinceId: number;
  }) {
    const candidate = this.candidateRepository.create({
      userId: data.userId,
      fullName: `${data.lastName} ${data.firstName}`,
      phone: data.phone,
      provinceId: data.provinceId,
    });
    return this.candidateRepository.save(candidate);
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
