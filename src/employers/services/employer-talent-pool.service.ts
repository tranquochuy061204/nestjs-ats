import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedCandidateEntity } from '../entities/saved-candidate.entity';
import { EmployerEntity } from '../entities/employer.entity';
import { SaveCandidateDto } from '../dto/save-candidate.dto';

@Injectable()
export class EmployerTalentPoolService {
  constructor(
    @InjectRepository(SavedCandidateEntity)
    private readonly savedCandidateRepo: Repository<SavedCandidateEntity>,
    @InjectRepository(EmployerEntity)
    private readonly employerRepo: Repository<EmployerEntity>,
  ) {}

  async getSavedCandidates(employerUserId: number) {
    const employer = await this.findEmployer(employerUserId);
    return this.savedCandidateRepo.find({
      where: { employerId: employer.id },
      relations: [
        'candidate',
        'candidate.skills',
        'candidate.skills.skillMetadata',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async saveCandidate(
    employerUserId: number,
    candidateId: number,
    dto: SaveCandidateDto,
  ) {
    const employer = await this.findEmployer(employerUserId);

    let saved = await this.savedCandidateRepo.findOne({
      where: { employerId: employer.id, candidateId },
    });

    if (saved) {
      saved.note = dto.note || saved.note;
    } else {
      saved = this.savedCandidateRepo.create({
        employerId: employer.id,
        candidateId,
        note: dto.note,
      });
    }

    return this.savedCandidateRepo.save(saved);
  }

  async unsaveCandidate(employerUserId: number, candidateId: number) {
    const employer = await this.findEmployer(employerUserId);
    const result = await this.savedCandidateRepo.delete({
      employerId: employer.id,
      candidateId,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Ứng viên chưa được lưu trong Talent Pool');
    }

    return { success: true };
  }

  private async findEmployer(userId: number): Promise<EmployerEntity> {
    const employer = await this.employerRepo.findOne({ where: { userId } });
    if (!employer) {
      throw new ForbiddenException('Tài khoản không phải nhà tuyển dụng');
    }
    return employer;
  }
}
