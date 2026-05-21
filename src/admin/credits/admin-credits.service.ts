import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditPackageEntity } from '../../credits/entities/credit-package.entity';
import {
  CreateCreditPackageDto,
  UpdateCreditPackageDto,
} from './dto/update-credit-package.dto';
import { UpstashCacheService } from '../../common/cache/upstash-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../common/cache/cache-keys.constant';

@Injectable()
export class AdminCreditsService {
  constructor(
    @InjectRepository(CreditPackageEntity)
    private readonly packageRepo: Repository<CreditPackageEntity>,
    private readonly cacheService: UpstashCacheService,
  ) {}

  async getAllPackages() {
    const cached = await this.cacheService.get<unknown[]>(
      CACHE_KEYS.CREDIT_PACKAGES,
    );
    if (cached) return cached;

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

    const result = packages.map((pkg) => ({
      ...pkg,
      purchasedCount: statsMap[pkg.slug] || 0,
    }));

    await this.cacheService.set(
      CACHE_KEYS.CREDIT_PACKAGES,
      result,
      CACHE_TTL.CREDIT_PACKAGES,
    );
    return result;
  }

  async getPackageById(id: number) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Credit package not found');
    return pkg;
  }

  async updatePackage(id: number, dto: UpdateCreditPackageDto) {
    const pkg = await this.getPackageById(id);
    Object.assign(pkg, dto);
    const saved = await this.packageRepo.save(pkg);
    // Invalidate cache vì cấu hình gói đã thay đổi
    await this.cacheService.del(CACHE_KEYS.CREDIT_PACKAGES);
    return saved;
  }

  async createPackage(dto: CreateCreditPackageDto) {
    const pkg = this.packageRepo.create(dto);
    const saved = await this.packageRepo.save(pkg);
    await this.cacheService.del(CACHE_KEYS.CREDIT_PACKAGES);
    return saved;
  }

  async deletePackage(id: number) {
    const pkg = await this.getPackageById(id);
    await this.packageRepo.remove(pkg);
    await this.cacheService.del(CACHE_KEYS.CREDIT_PACKAGES);
    return { message: `Credit package #${id} deleted` };
  }
}
