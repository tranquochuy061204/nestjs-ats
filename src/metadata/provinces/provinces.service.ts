import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProvinceMetadataEntity } from './province.entity';
import { UpstashCacheService } from '../../common/cache/upstash-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/cache/cache-keys.constant';

@Injectable()
export class ProvincesService {
  constructor(
    @InjectRepository(ProvinceMetadataEntity)
    private readonly provinceRepository: Repository<ProvinceMetadataEntity>,
    private readonly cacheService: UpstashCacheService,
  ) {}

  async findAll(): Promise<ProvinceMetadataEntity[]> {
    const cacheKey = CACHE_KEYS.METADATA_PROVINCES;
    const cached = await this.cacheService.get<ProvinceMetadataEntity[]>(cacheKey);
    if (cached) return cached;

    const data = await this.provinceRepository.find({
      order: {
        name: 'ASC',
      },
    });

    await this.cacheService.set(cacheKey, data, CACHE_TTL.METADATA);
    return data;
  }

  async search(query: string): Promise<ProvinceMetadataEntity[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return this.findAll();

    return this.provinceRepository
      .createQueryBuilder('province')
      .where('LOWER(province.name) LIKE :q', { q: `%${trimmed}%` })
      .orWhere('LOWER(province.slug) LIKE :q', { q: `%${trimmed}%` })
      .orderBy('province.name', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<ProvinceMetadataEntity> {
    const province = await this.provinceRepository.findOne({
      where: { code: id },
    });
    if (!province) {
      throw new NotFoundException(`Province with ID ${id} not found`);
    }
    return province;
  }
}
