import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobCategoryMetadataEntity } from './job-category.entity';

@Injectable()
export class JobCategoriesService {
  constructor(
    @InjectRepository(JobCategoryMetadataEntity)
    private readonly repo: Repository<JobCategoryMetadataEntity>,
  ) {}

  findAll() {
    return this.repo.find();
  }
}
