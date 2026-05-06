// Core & Config
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';

// Entities
import { SubscriptionPackageEntity } from '../../subscriptions/entities/subscription-package.entity';
import {
  CompanySubscriptionEntity,
  SubscriptionStatus,
} from '../../subscriptions/entities/company-subscription.entity';

// DTOs
import { UpdateSubscriptionPackageDto } from './dto/update-subscription-package.dto';
import { buildPaginationMeta } from '../dto/admin-pagination.dto';

// Services
import { AdminAuditLogsService } from '../audit-logs/admin-audit-logs.service';
import { AuditLogAction } from '../audit-logs/entities/audit-log.entity';

@Injectable()
export class AdminVipService {
  constructor(
    @InjectRepository(SubscriptionPackageEntity)
    private readonly packageRepo: Repository<SubscriptionPackageEntity>,
    @InjectRepository(CompanySubscriptionEntity)
    private readonly subscriptionRepo: Repository<CompanySubscriptionEntity>,
    private readonly auditLogsService: AdminAuditLogsService,
  ) {}

  // ─── Subscription List ────────────────────────────────────────────────────

  async getSubscriptions(query: {
    status?: string;
    packageId?: number;
    page?: number;
    limit?: number;
  }) {
    const { status, packageId, page = 1, limit = 20 } = query;

    const qb = this.subscriptionRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.company', 'c')
      .leftJoinAndSelect('cs.package', 'p')
      .orderBy('cs.endDate', 'ASC');

    if (status) {
      qb.andWhere('cs.status = :status', { status });
    }
    if (packageId) {
      qb.andWhere('cs.package_id = :packageId', { packageId });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const now = new Date();

    // Summary: active + expiring
    const activeCount = await this.subscriptionRepo
      .createQueryBuilder('cs')
      .innerJoin('cs.package', 'p')
      .where('cs.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere("p.name != 'free'")
      .getCount();

    const expiringIn7 = await this.subscriptionRepo
      .createQueryBuilder('cs')
      .innerJoin('cs.package', 'p')
      .where('cs.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere("p.name != 'free'")
      .andWhere('cs.end_date IS NOT NULL')
      .andWhere('cs.end_date <= :in7', {
        in7: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      })
      .andWhere('cs.end_date > :now', { now })
      .getCount();

    const expiringIn30 = await this.subscriptionRepo
      .createQueryBuilder('cs')
      .innerJoin('cs.package', 'p')
      .where('cs.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere("p.name != 'free'")
      .andWhere('cs.end_date IS NOT NULL')
      .andWhere('cs.end_date <= :in30', {
        in30: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      })
      .andWhere('cs.end_date > :now', { now })
      .getCount();

    const items = data.map((sub) => {
      const daysRemaining = sub.endDate
        ? Math.max(
            0,
            Math.ceil(
              (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
            ),
          )
        : null;

      return {
        id: sub.id,
        companyId: sub.companyId,
        companyName: sub.company?.name ?? null,
        packageId: sub.packageId,
        packageName: sub.package?.name ?? null,
        packageDisplayName: sub.package?.displayName ?? null,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        daysRemaining,
        createdAt: sub.createdAt,
      };
    });

    return {
      data: items,
      summary: {
        totalActive: activeCount,
        expiringIn7Days: expiringIn7,
        expiringIn30Days: expiringIn30,
      },
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  async getExpiring(days = 7) {
    const now = new Date();
    const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.subscriptionRepo
      .createQueryBuilder('cs')
      .leftJoinAndSelect('cs.company', 'c')
      .leftJoinAndSelect('cs.package', 'p')
      .where('cs.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('cs.end_date IS NOT NULL')
      .andWhere('cs.end_date <= :deadline', { deadline })
      .andWhere('cs.end_date > :now', { now })
      .orderBy('cs.end_date', 'ASC')
      .getMany();
  }

  async cancelSubscription(id: number, adminId: number) {
    const sub = await this.subscriptionRepo.findOne({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Chỉ có thể hủy subscription đang active');
    }
    await this.subscriptionRepo.update(id, {
      status: SubscriptionStatus.CANCELLED,
    });

    await this.auditLogsService.log({
      adminId,
      action: AuditLogAction.CANCEL_VIP,
      resource: 'company_subscription',
      resourceId: id,
      oldValues: { status: sub.status },
      newValues: { status: SubscriptionStatus.CANCELLED },
    });

    return { message: `Subscription #${id} đã được hủy` };
  }

  // ─── Package Config ───────────────────────────────────────────────────────

  async getAllPackages() {
    return this.packageRepo.find({ order: { price: 'ASC' } });
  }

  async getPackageById(id: number) {
    const pkg = await this.packageRepo.findOne({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async updatePackage(
    id: number,
    dto: UpdateSubscriptionPackageDto,
    adminId: number,
  ) {
    const pkg = await this.getPackageById(id);
    const oldValues = { ...pkg };

    Object.assign(pkg, dto);
    const savedPkg = await this.packageRepo.save(pkg);

    await this.auditLogsService.log({
      adminId,
      action: AuditLogAction.UPDATE_VIP_CONFIG,
      resource: 'subscription_package',
      resourceId: id,
      oldValues,
      newValues: savedPkg,
    });

    return savedPkg;
  }

  async createPackage(dto: UpdateSubscriptionPackageDto & { name: string }) {
    const pkg = this.packageRepo.create(dto);
    return this.packageRepo.save(pkg);
  }

  async deletePackage(id: number) {
    const pkg = await this.getPackageById(id);
    if (pkg.name === 'free' || pkg.name === 'vip') {
      throw new BadRequestException('Không thể xóa các gói hệ thống mặc định');
    }
    return this.packageRepo.remove(pkg);
  }
}
