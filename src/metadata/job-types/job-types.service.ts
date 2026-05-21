import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobTypeMetadataEntity } from './job-type.entity';
import { UpstashCacheService } from '../../common/cache/upstash-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/cache/cache-keys.constant';

@Injectable()
export class JobTypesService {
  constructor(
    @InjectRepository(JobTypeMetadataEntity)
    private readonly repo: Repository<JobTypeMetadataEntity>,
    private readonly cacheService: UpstashCacheService,
  ) {}

  async findAll() {
    const cacheKey = CACHE_KEYS.METADATA_JOB_TYPES;
    const cached = await this.cacheService.get<JobTypeMetadataEntity[]>(cacheKey);
    if (cached) return cached;

    const data = await this.repo.find();
    
    await this.cacheService.set(cacheKey, data, CACHE_TTL.METADATA);
    return data;
  }
}
