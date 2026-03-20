import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import 'multer';
import { SupabaseService } from '../storage/supabase.service';
import { CandidateEntity } from './entities/candidate.entity';
import { WorkExperienceEntity } from './entities/work-experience.entity';
import { EducationEntity } from './entities/education.entity';
import { ProjectEntity } from './entities/project.entity';
import { CandidateSkillTagEntity } from './entities/candidate-skill-tag.entity';
import { CertificateEntity } from './entities/certificate.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateCertificateDto } from './dto/create-certificate.dto';
import { UpdateCertificateDto } from './dto/update-certificate.dto';
import { AddSkillsDto } from './dto/add-skills.dto';
import { SkillsMetadataService } from '../metadata/skills/skills-metadata.service';
import { CandidateJobCategoryEntity } from './entities/candidate-job-category.entity';
import { JobCategoryMetadataEntity } from '../metadata/job-categories/job-category.entity';
import { UpdateJobCategoriesDto } from './dto/update-job-categories.dto';
import { JobTypeMetadataEntity } from '../metadata/job-types/job-type.entity';

@Injectable()
export class CandidatesService {
  private readonly logger = new Logger(CandidatesService.name);

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
    @InjectRepository(JobCategoryMetadataEntity)
    private readonly jobCategoryRepository: Repository<JobCategoryMetadataEntity>,
    @InjectRepository(JobTypeMetadataEntity)
    private readonly jobTypeRepository: Repository<JobTypeMetadataEntity>,
    private readonly skillsMetadataService: SkillsMetadataService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // ─── Profile CRUD ───────────────────────────────────────────

  async getProfile(userId: number, reqCandidateId?: number) {
    const where = reqCandidateId ? { id: reqCandidateId } : { userId };

    // 1. Phân tách lấy gốc (Chỉ Join các bảng 1-1 / N-1 để tránh nổ RAM)
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

    // 3. Gắn Data trả về
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

    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }

    Object.assign(candidate, updateProfileDto);

    return this.candidateRepository.save(candidate);
  }

  async uploadCv(userId: number, file: Express.Multer.File) {
    const candidate = await this.findCandidateByUserId(userId);

    // Xóa CV cũ nếu có
    if (candidate.cvUrl) {
      try {
        // Lấy đường dẫn path từ url để xóa trên Supabase
        // cvUrl là URL dạng https://blabla.supabase.co/storage/v1/object/public/ats_bucket/candidates/userId/filename
        const urlParts = candidate.cvUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const path = `candidates/${userId}/${fileName}`;
        await this.supabaseService.deleteFile(path);
      } catch (error) {
        this.logger.error(
          `Error deleting old CV: ${(error as Error).message}`,
          (error as Error).stack,
        );
        // Ignore error if we can't delete old CV
      }
    }

    const uniqueId = Date.now();
    const filePath = `candidates/${userId}/cv_${uniqueId}.pdf`;
    const publicUrl = await this.supabaseService.uploadFile(file, filePath);

    candidate.cvUrl = publicUrl;
    await this.candidateRepository.save(candidate);

    return { cvUrl: publicUrl };
  }

  // ─── Work Experience CRUD ───────────────────────────────────

  async getWorkExperiences(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.workExperienceRepository.find({
      where: { candidateId: candidate.id },
      order: { startDate: 'DESC' },
    });
  }

  async createWorkExperience(userId: number, dto: CreateWorkExperienceDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const workExp = this.workExperienceRepository.create({
      ...dto,
      candidateId: candidate.id,
    });
    return this.workExperienceRepository.save(workExp);
  }

  async updateWorkExperience(
    userId: number,
    workExpId: number,
    dto: UpdateWorkExperienceDto,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    const workExp = await this.workExperienceRepository.findOne({
      where: { id: workExpId },
    });

    if (!workExp) {
      throw new NotFoundException('Work experience not found');
    }

    if (workExp.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to update this work experience',
      );
    }

    Object.assign(workExp, dto);
    return this.workExperienceRepository.save(workExp);
  }

  async deleteWorkExperience(userId: number, workExpId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const workExp = await this.workExperienceRepository.findOne({
      where: { id: workExpId },
    });

    if (!workExp) {
      throw new NotFoundException('Work experience not found');
    }

    if (workExp.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this work experience',
      );
    }

    await this.workExperienceRepository.remove(workExp);
    return { message: 'Work experience deleted successfully' };
  }

  // ─── Education CRUD ─────────────────────────────────────────

  async getEducations(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.educationRepository.find({
      where: { candidateId: candidate.id },
      order: { startDate: 'DESC' },
    });
  }

  async createEducation(userId: number, dto: CreateEducationDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const education = this.educationRepository.create({
      ...dto,
      candidateId: candidate.id,
    });
    return this.educationRepository.save(education);
  }

  async updateEducation(
    userId: number,
    educationId: number,
    dto: UpdateEducationDto,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    const education = await this.educationRepository.findOne({
      where: { id: educationId },
    });

    if (!education) {
      throw new NotFoundException('Education not found');
    }

    if (education.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to update this education',
      );
    }

    Object.assign(education, dto);
    return this.educationRepository.save(education);
  }

  async deleteEducation(userId: number, educationId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const education = await this.educationRepository.findOne({
      where: { id: educationId },
    });

    if (!education) {
      throw new NotFoundException('Education not found');
    }

    if (education.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this education',
      );
    }

    await this.educationRepository.remove(education);
    return { message: 'Education deleted successfully' };
  }

  // ─── Projects CRUD ──────────────────────────────────────────

  async getProjects(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.projectRepository.find({
      where: { candidateId: candidate.id },
      order: { startDate: 'DESC' },
    });
  }

  async createProject(userId: number, dto: CreateProjectDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const project = this.projectRepository.create({
      ...dto,
      candidateId: candidate.id,
    });
    return this.projectRepository.save(project);
  }

  async updateProject(
    userId: number,
    projectId: number,
    dto: UpdateProjectDto,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to update this project',
      );
    }

    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async deleteProject(userId: number, projectId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this project',
      );
    }

    await this.projectRepository.remove(project);
    return { message: 'Project deleted successfully' };
  }

  // ─── Certificates CRUD ──────────────────────────────────────────

  async getCertificates(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.certificateRepository.find({
      where: { candidateId: candidate.id },
    });
  }

  async createCertificate(
    userId: number,
    dto: CreateCertificateDto,
    file?: Express.Multer.File,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    let cerImgUrl: string | undefined = undefined;

    if (file) {
      const uniqueId = Date.now();
      const filePath = `candidates/${userId}/certificates/cert_${uniqueId}_${file.originalname}`;
      cerImgUrl = await this.supabaseService.uploadFile(file, filePath);
    }

    const certificate = this.certificateRepository.create({
      ...dto,
      candidateId: candidate.id,
      ...(cerImgUrl ? { cerImgUrl } : {}),
    });

    return this.certificateRepository.save(certificate);
  }

  async updateCertificate(
    userId: number,
    certId: number,
    dto: UpdateCertificateDto,
    file?: Express.Multer.File,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    const cert = await this.certificateRepository.findOne({
      where: { id: certId },
    });

    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.candidateId !== candidate.id)
      throw new ForbiddenException(
        'You do not have permission to update this certificate',
      );

    if (file) {
      if (cert.cerImgUrl) {
        try {
          const urlParts = cert.cerImgUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          await this.supabaseService.deleteFile(
            `candidates/${userId}/certificates/${fileName}`,
          );
        } catch (e) {
          this.logger.error(
            `Error updating certificate: ${(e as Error).message}`,
            (e as Error).stack,
          );
          // Ignore error if we can't delete old CV)
        }
      }

      const uniqueId = Date.now();
      const filePath = `candidates/${userId}/certificates/cert_${uniqueId}_${file.originalname}`;
      cert.cerImgUrl = await this.supabaseService.uploadFile(file, filePath);
    }

    Object.assign(cert, dto);
    return this.certificateRepository.save(cert);
  }

  async deleteCertificate(userId: number, certId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const cert = await this.certificateRepository.findOne({
      where: { id: certId },
    });

    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.candidateId !== candidate.id)
      throw new ForbiddenException(
        'You do not have permission to delete this certificate',
      );

    if (cert.cerImgUrl) {
      try {
        const urlParts = cert.cerImgUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await this.supabaseService.deleteFile(
          `candidates/${userId}/certificates/${fileName}`,
        );
      } catch (e) {
        this.logger.error(
          `Error deleting certificate: ${(e as Error).message}`,
          (e as Error).stack,
        );
        // Ignore error if we can't delete old CV)
      }
    }

    await this.certificateRepository.remove(cert);
    return { message: 'Certificate deleted successfully' };
  }

  // ─── Skills CRUD ───────────────────────────────────────────

  async getSkills(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.skillTagRepository.find({
      where: { candidateId: candidate.id },
      relations: ['skillMetadata'],
    });
  }

  async addSkills(userId: number, dto: AddSkillsDto) {
    const candidate = await this.findCandidateByUserId(userId);
    const results: CandidateSkillTagEntity[] = [];

    // Tách IDs và raw strings
    const ids = dto.skills.filter((s): s is number => typeof s === 'number');
    const rawStrings = dto.skills.filter(
      (s): s is string => typeof s === 'string',
    );

    // Xử lý IDs: batch insert + bulk increment
    if (ids.length > 0) {
      const validSkills = await this.skillsMetadataService.findByIds(ids);
      if (validSkills.length > 0) {
        const validIds = validSkills.map((s) => s.id);
        await this.skillsMetadataService.incrementUseCountBulk(validIds);

        const existingTags = await this.skillTagRepository.find({
          where: { candidateId: candidate.id, skillMetadataId: In(validIds) },
        });
        const existingIds = new Set(existingTags.map((t) => t.skillMetadataId));

        const newTags = validIds
          .filter((id) => !existingIds.has(id))
          .map((id) =>
            this.skillTagRepository.create({
              candidateId: candidate.id,
              skillMetadataId: id,
            }),
          );

        if (newTags.length > 0) {
          const saved = await this.skillTagRepository.save(newTags);
          results.push(...saved);
        }
      }
    }

    // Xử lý raw strings: fuzzy search trước → AI fallback
    const unknowns: string[] = [];

    for (const raw of rawStrings) {
      const found = await this.skillsMetadataService.findByFuzzy(raw);
      if (found) {
        await this.skillsMetadataService.incrementUseCount(found.id);
        // Thêm alias nếu cách viết khác
        if (
          raw.trim() !== found.canonicalName &&
          !found.aliases.includes(raw.trim())
        ) {
          found.aliases = [...found.aliases, raw.trim()];
          await this.skillsMetadataService.upsertSkill(
            found.canonicalName,
            found.type,
            raw.trim(),
          );
        }
        const tag = await this.saveSkillTag(candidate.id, found.id);
        if (tag) results.push(tag);
      } else {
        unknowns.push(raw);
      }
    }

    // Batch gọi AI cho unknowns
    if (unknowns.length > 0) {
      const formatted = await this.skillsMetadataService.formatWithAI(unknowns);

      for (let i = 0; i < formatted.length; i++) {
        const { name, type } = formatted[i];
        const skill = await this.skillsMetadataService.upsertSkill(
          name,
          type,
          unknowns[i].trim(),
        );
        const tag = await this.saveSkillTag(candidate.id, skill.id);
        if (tag) results.push(tag);
      }
    }

    // Load relations cho kết quả
    return this.skillTagRepository.find({
      where: { candidateId: candidate.id },
      relations: ['skillMetadata'],
    });
  }

  async deleteSkill(userId: number, skillTagId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const tag = await this.skillTagRepository.findOne({
      where: { id: skillTagId },
    });

    if (!tag) {
      throw new NotFoundException('Skill tag not found');
    }

    if (tag.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this skill',
      );
    }

    await this.skillTagRepository.remove(tag);
    return { message: 'Skill deleted successfully' };
  }

  /**
   * Helper: lưu candidate_skill_tag, bỏ qua nếu trùng (composite unique).
   */
  private async saveSkillTag(
    candidateId: number,
    skillMetadataId: number,
  ): Promise<CandidateSkillTagEntity | null> {
    const existing = await this.skillTagRepository.findOne({
      where: { candidateId, skillMetadataId },
    });
    if (existing) return existing;

    const tag = this.skillTagRepository.create({
      candidateId,
      skillMetadataId,
    });
    return this.skillTagRepository.save(tag);
  }

  // ─── Job Categories CRUD ───────────────────────────────────────────

  async getJobCategories(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.candidateJobCategoryRepository.find({
      where: { candidateId: candidate.id },
      relations: ['jobCategory'],
    });
  }

  async addJobCategories(userId: number, dto: UpdateJobCategoriesDto) {
    const candidate = await this.findCandidateByUserId(userId);

    const validCategories = await this.jobCategoryRepository.find({
      where: { id: In(dto.categoryIds) },
    });

    if (validCategories.length > 0) {
      const validIds = validCategories.map((c) => c.id);

      const existingRefs = await this.candidateJobCategoryRepository.find({
        where: { candidateId: candidate.id, jobCategoryId: In(validIds) },
      });
      const existingIds = new Set(existingRefs.map((r) => r.jobCategoryId));

      const newRefs = validIds
        .filter((id) => !existingIds.has(id))
        .map((id) =>
          this.candidateJobCategoryRepository.create({
            candidateId: candidate.id,
            jobCategoryId: id,
          }),
        );

      if (newRefs.length > 0) {
        await this.candidateJobCategoryRepository.save(newRefs);
      }
    }

    return this.candidateJobCategoryRepository.find({
      where: { candidateId: candidate.id },
      relations: ['jobCategory'],
    });
  }

  async deleteJobCategory(userId: number, id: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const relation = await this.candidateJobCategoryRepository.findOne({
      where: { id },
    });

    if (!relation) {
      throw new NotFoundException('Job category not found');
    }

    if (relation.candidateId !== candidate.id) {
      throw new ForbiddenException(
        'You do not have permission to delete this job category',
      );
    }

    await this.candidateJobCategoryRepository.remove(relation);
    return { message: 'Job category removed successfully' };
  }

  // ─── Job Types ───────────────────────────────────────

  async getJobTypes() {
    return this.jobTypeRepository.find();
  }

  // ─── Helpers ────────────────────────────────────────────────

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
