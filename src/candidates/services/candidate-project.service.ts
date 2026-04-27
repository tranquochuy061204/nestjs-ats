import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { ProjectEntity } from '../entities/project.entity';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';

@Injectable()
export class CandidateProjectService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

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
