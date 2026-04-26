import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { WorkExperienceEntity } from '../entities/work-experience.entity';
import { EducationEntity } from '../entities/education.entity';
import { ProjectEntity } from '../entities/project.entity';
import { CreateWorkExperienceDto } from '../dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from '../dto/update-work-experience.dto';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Injectable()
export class CandidateExperienceService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(WorkExperienceEntity)
    private readonly workExperienceRepository: Repository<WorkExperienceEntity>,
    @InjectRepository(EducationEntity)
    private readonly educationRepository: Repository<EducationEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

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
      where: { id: workExpId, candidateId: candidate.id },
    });
    if (!workExp) throw new NotFoundException('Work experience not found');
    Object.assign(workExp, dto);
    return this.workExperienceRepository.save(workExp);
  }

  async deleteWorkExperience(userId: number, workExpId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const workExp = await this.workExperienceRepository.findOne({
      where: { id: workExpId, candidateId: candidate.id },
    });
    if (!workExp) throw new NotFoundException('Work experience not found');
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
      where: { id: educationId, candidateId: candidate.id },
    });
    if (!education) throw new NotFoundException('Education not found');
    Object.assign(education, dto);
    return this.educationRepository.save(education);
  }

  async deleteEducation(userId: number, educationId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const education = await this.educationRepository.findOne({
      where: { id: educationId, candidateId: candidate.id },
    });
    if (!education) throw new NotFoundException('Education not found');
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
      where: { id: projectId, candidateId: candidate.id },
    });
    if (!project) throw new NotFoundException('Project not found');
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async deleteProject(userId: number, projectId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const project = await this.projectRepository.findOne({
      where: { id: projectId, candidateId: candidate.id },
    });
    if (!project) throw new NotFoundException('Project not found');
    await this.projectRepository.remove(project);
    return { message: 'Project deleted successfully' };
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    return candidate;
  }
}
