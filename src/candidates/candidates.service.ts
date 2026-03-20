import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from './entities/candidate.entity';
import { WorkExperienceEntity } from './entities/work-experience.entity';
import { EducationEntity } from './entities/education.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateWorkExperienceDto } from './dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from './dto/update-work-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';

@Injectable()
export class CandidatesService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(WorkExperienceEntity)
    private readonly workExperienceRepository: Repository<WorkExperienceEntity>,
    @InjectRepository(EducationEntity)
    private readonly educationRepository: Repository<EducationEntity>,
  ) {}

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
