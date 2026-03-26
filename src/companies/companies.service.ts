import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyEntity } from './entities/company.entity';
import { CompanyImageEntity } from './entities/company-image.entity';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { SupabaseService } from '../storage/supabase.service';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(CompanyEntity)
    private readonly companyRepo: Repository<CompanyEntity>,
    @InjectRepository(CompanyImageEntity)
    private readonly companyImageRepo: Repository<CompanyImageEntity>,
    private readonly supabaseService: SupabaseService,
  ) {}

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
    await this.companyRepo.save(company);
    return company;
  }

  async uploadLogo(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file logo');
    const company = await this.getCompanyByUser(userId);

    const originalName = file.originalname.replace(/\s+/g, '_');
    const path = `companies/logos/${company.id}-${Date.now()}-${originalName}`;
    const logoUrl = await this.supabaseService.uploadFile(file, path);

    company.logoUrl = logoUrl;
    await this.companyRepo.save(company);

    return { message: 'Upload logo thành công', logoUrl };
  }

  async uploadBanner(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file banner');
    const company = await this.getCompanyByUser(userId);

    const originalName = file.originalname.replace(/\s+/g, '_');
    const path = `companies/banners/${company.id}-${Date.now()}-${originalName}`;
    const bannerUrl = await this.supabaseService.uploadFile(file, path);

    company.bannerUrl = bannerUrl;
    await this.companyRepo.save(company);

    return { message: 'Upload banner thành công', bannerUrl };
  }

  async uploadCompanyImages(userId: number, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 hình ảnh');
    }
    const company = await this.getCompanyByUser(userId);

    const uploadedImages = [];
    for (const file of files) {
      const originalName = file.originalname.replace(/\s+/g, '_');
      const path = `companies/images/${company.id}-${Date.now()}-${originalName}`;
      const imageUrl = await this.supabaseService.uploadFile(file, path);

      const newImage = this.companyImageRepo.create({
        companyId: company.id,
        imageUrl,
      });
      const savedImage = await this.companyImageRepo.save(newImage);
      uploadedImages.push(savedImage);
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
}
