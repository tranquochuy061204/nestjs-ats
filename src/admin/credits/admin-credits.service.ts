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
    const packages = await this.packageRepo.find({
      order: { priceVnd: 'ASC' },
    });

    // Đếm số lần nạp thành công thông qua payment_order
    const stats = await this.packageRepo.manager
      .createQueryBuilder()
      .select("split_part(gateway_order_id, '-', 2)", 'slug')
      .addSelect('COUNT(*)', 'count')
      .from('payment_order', 'po')
      .where("po.order_type = 'credit_topup'")
      .andWhere("po.payment_status = 'completed'")
      .andWhere('po.gateway_order_id IS NOT NULL')
      .groupBy("split_part(gateway_order_id, '-', 2)")
      .getRawMany<{ slug: string; count: string }>();

    const statsMap = stats.reduce(
      (acc, curr) => {
        if (curr.slug) {
          acc[curr.slug] = parseInt(curr.count, 10);
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return packages.map((pkg) => ({
      ...pkg,
      purchasedCount: statsMap[pkg.slug] || 0,
    }));
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
