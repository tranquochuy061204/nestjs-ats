import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProvinceMetadataEntity } from './province.entity';

@Injectable()
export class ProvincesService {
  constructor(
    @InjectRepository(ProvinceMetadataEntity)
    private readonly provinceRepository: Repository<ProvinceMetadataEntity>,
  ) {}

  async findAll(): Promise<ProvinceMetadataEntity[]> {
    return this.provinceRepository.find({
      order: {
        name: 'ASC',
      },
    });
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
