import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobCategoryMetadataEntity } from './job-category.entity';
import { UpstashCacheService } from '../../common/cache/upstash-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/cache/cache-keys.constant';

@Injectable()
export class JobCategoriesService {
  constructor(
    @InjectRepository(JobCategoryMetadataEntity)
    private readonly repo: Repository<JobCategoryMetadataEntity>,
    private readonly cacheService: UpstashCacheService,
  ) {}

  async findAll() {
    const cacheKey = CACHE_KEYS.METADATA_JOB_CATEGORIES;
    const cached = await this.cacheService.get<JobCategoryMetadataEntity[]>(cacheKey);
    if (cached) return cached;

    const data = await this.repo.find();
    
    await this.cacheService.set(cacheKey, data, CACHE_TTL.METADATA);
    return data;
  }
}
