import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { EducationEntity } from '../entities/education.entity';
import { CreateEducationDto } from '../dto/create-education.dto';
import { UpdateEducationDto } from '../dto/update-education.dto';

@Injectable()
export class CandidateEducationService {
  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(EducationEntity)
    private readonly educationRepository: Repository<EducationEntity>,
  ) {}

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

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found');
    return candidate;
  }
}
