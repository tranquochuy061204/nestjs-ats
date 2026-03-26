import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobTypeMetadataEntity } from './job-type.entity';

@Injectable()
export class JobTypesService {
  constructor(
    @InjectRepository(JobTypeMetadataEntity)
    private readonly repo: Repository<JobTypeMetadataEntity>,
  ) {}

  findAll() {
    return this.repo.find();
  }
}
