import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { WorkExperienceEntity } from '../entities/work-experience.entity';
import { CreateWorkExperienceDto } from '../dto/create-work-experience.dto';
import { UpdateWorkExperienceDto } from '../dto/update-work-experience.dto';

@Injectable()
export class CandidateWorkExperienceService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(WorkExperienceEntity)
    private readonly workExperienceRepository: Repository<WorkExperienceEntity>,
  ) {}

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

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    return candidate;
  }
}
