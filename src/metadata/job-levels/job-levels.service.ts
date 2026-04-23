import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobLevelMetadataEntity } from './job-level.entity';

@Injectable()
export class JobLevelsService {
  constructor(
    @InjectRepository(JobLevelMetadataEntity)
    private readonly repo: Repository<JobLevelMetadataEntity>,
  ) {}

  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  // Placeholder cho seeding logic nếu cần chạy từ code
  async seed() {
    const levels = [
      { name: 'Intern (Thực tập sinh)', slug: 'intern' },
      { name: 'Fresher (Mới tốt nghiệp)', slug: 'fresher' },
      { name: 'Junior (Nhân viên)', slug: 'junior' },
      { name: 'Middle/Senior (Chuyên viên)', slug: 'middle-senior' },
      { name: 'Lead/Manager (Quản lý)', slug: 'manager' },
    ];

    for (const level of levels) {
      const exists = await this.repo.findOne({ where: { slug: level.slug } });
      if (!exists) {
        await this.repo.save(this.repo.create(level));
      }
    }
  }
}
