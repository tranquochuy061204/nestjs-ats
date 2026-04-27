import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity, CompanyStatus } from './entities/company.entity';
import { CompanyImageEntity } from './entities/company-image.entity';
import { CompanyStatusHistoryEntity } from './entities/company-status-history.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SupabaseService } from '../storage/supabase.service';
import { sanitizeFilename, toSlug } from '../common/utils/string.util';
import { STORAGE_PATHS } from '../common/constants/storage-paths.constant';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CompanyImageEntity)
    private readonly companyImageRepo: Repository<CompanyImageEntity>,
    @InjectRepository(CompanyStatusHistoryEntity)
    private readonly historyRepo: Repository<CompanyStatusHistoryEntity>,
    private readonly supabaseService: SupabaseService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async getCompanyPublicBySlug(slug: string) {
    const company = await this.companyRepo.findOne({
      where: { slug },
      relations: ['images'],
    });

    if (!company) {
      throw new NotFoundException('Không tìm thấy thông tin công ty');
    }

    // [Feature #7] has_vip_badge: đọc từ subscription hiện tại của công ty
    const { package: pkg } = await this.subscriptionsService.getActiveSubscription(company.id);

    // Chỉ trả về các trường công khai cho ứng viên
    return {
      id: company.id,
      name: company.name,
      emailContact: company.emailContact,
      phoneContact: company.phoneContact,
      address: company.address,
      provinceId: company.provinceId,
      logoUrl: company.logoUrl,
      bannerUrl: company.bannerUrl,
      description: company.description,
      content: company.content,
      companySize: company.companySize,
      websiteUrl: company.websiteUrl,
      facebookUrl: company.facebookUrl,
      linkedinUrl: company.linkedinUrl,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      slug: company.slug,
      images: company.images,
      isVip: pkg.hasVipBadge,  // [Feature #7]
    };
  }

  /**
   * Helper function to find company verifying userCreatorId
   */
  async getCompanyByUser(userId: number) {
    const company = await this.companyRepo.findOne({
      where: { userCreatorId: userId },
      relations: ['images', 'employers'],
    });

    if (!company) {
      throw new NotFoundException(
        'Không tìm thấy công ty của tài khoản này hoặc bạn không phải admin',
      );
    }

    return company;
  }

  async updateCompanyProfile(userId: number, dto: UpdateCompanyDto) {
    const company = await this.getCompanyByUser(userId);

    Object.assign(company, dto);

    if (dto.name) {
      company.slug = toSlug(dto.name);
    }

    await this.companyRepo.save(company);
    return company;
  }

  async uploadLogo(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file logo');
    const company = await this.getCompanyByUser(userId);

    const originalName = sanitizeFilename(file.originalname);
    const filePath = `${STORAGE_PATHS.COMPANIES.LOGOS}/${company.id}-${Date.now()}-${originalName}`;
    const oldFilePath = company.logoUrl
      ? `${STORAGE_PATHS.COMPANIES.LOGOS}/${company.logoUrl.split('/').pop()}`
      : undefined;

    const { result } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      filePath,
      async (url) => {
        company.logoUrl = url;
        await this.companyRepo.save(company);
        return { message: 'Upload logo thành công', logoUrl: url };
      },
      oldFilePath,
    );

    return result;
  }

  async uploadBanner(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file banner');
    const company = await this.getCompanyByUser(userId);

    const originalName = sanitizeFilename(file.originalname);
    const filePath = `${STORAGE_PATHS.COMPANIES.BANNERS}/${company.id}-${Date.now()}-${originalName}`;
    const oldFilePath = company.bannerUrl
      ? `${STORAGE_PATHS.COMPANIES.BANNERS}/${company.bannerUrl.split('/').pop()}`
      : undefined;

    const { result } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      filePath,
      async (url) => {
        company.bannerUrl = url;
        await this.companyRepo.save(company);
        return { message: 'Upload banner thành công', bannerUrl: url };
      },
      oldFilePath,
    );

    return result;
  }

  async uploadCompanyImages(userId: number, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 hình ảnh');
    }
    const company = await this.getCompanyByUser(userId);

    const uploadedImages = [];
    // Track all uploaded paths for orphan cleanup if a DB save fails mid-batch
    const uploadedPaths: string[] = [];

    for (const file of files) {
      const originalName = sanitizeFilename(file.originalname);
      const filePath = `${STORAGE_PATHS.COMPANIES.IMAGES}/${company.id}-${Date.now()}-${originalName}`;
      const imageUrl = await this.supabaseService.uploadFile(file, filePath);
      uploadedPaths.push(filePath);

      try {
        const newImage = this.companyImageRepo.create({
          companyId: company.id,
          imageUrl,
        });
        const savedImage = await this.companyImageRepo.save(newImage);
        uploadedImages.push(savedImage);
      } catch (dbError) {
        // Orphan Fix: DB failed → delete ALL files uploaded in this batch
        this.logger.error(
          `Failed to save image record, deleting ${uploadedPaths.length} orphaned file(s)...`,
        );
        await Promise.all(
          uploadedPaths.map((p) =>
            this.supabaseService.deleteFile(p).catch(() => null),
          ),
        );
        throw dbError;
      }
    }

    return {
      message: 'Upload hình ảnh môi trường làm việc thành công',
      images: uploadedImages,
    };
  }

  async deleteCompanyImage(userId: number, imageId: number) {
    const company = await this.getCompanyByUser(userId);

    const image = await this.companyImageRepo.findOne({
      where: { id: imageId, companyId: company.id },
    });

    if (!image) {
      throw new NotFoundException(
        'Hình ảnh không tồn tại hoặc không có quyền xóa',
      );
    }

    await this.companyImageRepo.remove(image);
    return { message: 'Xóa hình ảnh thành công' };
  }

  // -----------------------
  // BUSINESS LICENSE & VERIFICATION
  // -----------------------

  async uploadBusinessLicense(userId: number, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file giấy phép kinh doanh');
    }
    const company = await this.getCompanyByUser(userId);

    const originalName = sanitizeFilename(file.originalname);
    const filePath = `${STORAGE_PATHS.COMPANIES.LICENSES}/${company.id}-${Date.now()}-${originalName}`;
    const oldFilePath = company.businessLicenseUrl
      ? `${STORAGE_PATHS.COMPANIES.LICENSES}/${company.businessLicenseUrl.split('/').pop()}`
      : undefined;

    const { result } = await this.supabaseService.atomicUploadAndUpdate(
      file,
      filePath,
      async (url) => {
        company.businessLicenseUrl = url;
        company.status = CompanyStatus.PENDING;
        await this.companyRepo.save(company);
        return {
          message:
            'Tải lên giấy phép kinh doanh thành công. Vui lòng chờ Admin duyệt.',
          licenseUrl: url,
        };
      },
      oldFilePath,
    );

    return result;
  }

  async getPendingVerifications(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const qb = this.companyRepo
      .createQueryBuilder('company')
      .where('company.businessLicenseUrl IS NOT NULL')
      .andWhere('company.status = :status', { status: CompanyStatus.PENDING });

    qb.orderBy('company.updatedAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page,
      lastPage: Math.ceil(total / limit),
    };
  }

  async verifyCompany(id: number) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const oldStatus = company.status;
    await this.companyRepo.update(id, {
      status: CompanyStatus.APPROVED,
      verifiedAt: new Date(),
      rejectionReason: null,
    });

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        companyId: id,
        oldStatus,
        newStatus: CompanyStatus.APPROVED,
      }),
    );

    return { message: 'Công ty đã được xác nhận thực thành công' };
  }

  async rejectVerification(id: number, reason: string) {
    const company = await this.companyRepo.findOne({ where: { id } });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const oldStatus = company.status;
    await this.companyRepo.update(id, {
      status: CompanyStatus.REJECTED,
      rejectionReason: reason,
    });

    // Log history
    await this.historyRepo.save(
      this.historyRepo.create({
        companyId: id,
        oldStatus,
        newStatus: CompanyStatus.REJECTED,
        reason,
      }),
    );

    return { message: `Đã từ chối xác thực. Lý do: ${reason}` };
  }

  async getCompanyHistory(companyId: number) {
    return this.historyRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }
}
