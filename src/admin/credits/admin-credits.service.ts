import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditPackageEntity } from '../../credits/entities/credit-package.entity';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/update-credit-package.dto';

@Injectable()
export class AdminCreditsService {
  constructor(
    @InjectRepository(CreditPackageEntity)
    private readonly packageRepo: Repository<CreditPackageEntity>,
  ) {}

  async getAllPackages() {
    return this.packageRepo.find({ order: { priceVnd: 'ASC' } });
  }

  async getPackageById(id: number) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Credit package not found');
    return pkg;
  }

  async updatePackage(id: number, dto: UpdateCreditPackageDto) {
    const pkg = await this.getPackageById(id);
    Object.assign(pkg, dto);
    return this.packageRepo.save(pkg);
  }

  async createPackage(dto: CreateCreditPackageDto) {
    const pkg = this.packageRepo.create(dto);
    return this.packageRepo.save(pkg);
  }

  async deletePackage(id: number) {
    const pkg = await this.getPackageById(id);
    return this.packageRepo.remove(pkg);
  }
}
