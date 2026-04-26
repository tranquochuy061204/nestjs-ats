import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import 'multer';
import { SupabaseService } from '../../storage/supabase.service';
import { CandidateEntity } from '../entities/candidate.entity';
import { CertificateEntity } from '../entities/certificate.entity';
import { CreateCertificateDto } from '../dto/create-certificate.dto';
import { UpdateCertificateDto } from '../dto/update-certificate.dto';

@Injectable()
export class CandidateCertificatesService {
  private readonly logger = new Logger(CandidateCertificatesService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    @InjectRepository(CertificateEntity)
    private readonly certificateRepository: Repository<CertificateEntity>,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getCertificates(userId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    return this.certificateRepository.find({
      where: { candidateId: candidate.id },
    });
  }

  async createCertificate(
    userId: number,
    dto: CreateCertificateDto,
    file?: Express.Multer.File,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    let cerImgUrl: string | undefined = undefined;
    let filePath: string | undefined = undefined;

    if (file) {
      const uniqueId = Date.now();
      filePath = `candidates/${userId}/certificates/cert_${uniqueId}_${file.originalname}`;
      cerImgUrl = await this.supabaseService.uploadFile(file, filePath);
    }

    try {
      const certificate = this.certificateRepository.create({
        ...dto,
        candidateId: candidate.id,
        ...(cerImgUrl ? { cerImgUrl } : {}),
      });

      return await this.certificateRepository.save(certificate);
    } catch (e) {
      if (filePath) {
        this.logger.error(
          `Database error, deleting orphaned certificate: ${filePath}`,
        );
        await this.supabaseService.deleteFile(filePath).catch(() => null);
      }
      throw e;
    }
  }

  async updateCertificate(
    userId: number,
    certId: number,
    dto: UpdateCertificateDto,
    file?: Express.Multer.File,
  ) {
    const candidate = await this.findCandidateByUserId(userId);
    const cert = await this.certificateRepository.findOne({
      where: { id: certId, candidateId: candidate.id },
    });

    if (!cert) throw new NotFoundException('Certificate not found');

    let newImgUrl: string | undefined = undefined;
    let newFilePath: string | undefined = undefined;
    const oldImgUrl = cert.cerImgUrl;

    if (file) {
      const uniqueId = Date.now();
      newFilePath = `candidates/${userId}/certificates/cert_${uniqueId}_${file.originalname}`;
      newImgUrl = await this.supabaseService.uploadFile(file, newFilePath);
    }

    try {
      if (newImgUrl) cert.cerImgUrl = newImgUrl;
      Object.assign(cert, dto);
      await this.certificateRepository.save(cert);

      // Save was successful. Delete the old file to save space if we uploaded a new one.
      if (newImgUrl && oldImgUrl) {
        const urlParts = oldImgUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await this.supabaseService
          .deleteFile(`candidates/${userId}/certificates/${fileName}`)
          .catch(() => null);
      }
      return cert;
    } catch (e) {
      if (newFilePath) {
        this.logger.error(
          `Database error, deleting orphaned new certificate: ${newFilePath}`,
        );
        await this.supabaseService.deleteFile(newFilePath).catch(() => null);
      }
      throw e;
    }
  }

  async deleteCertificate(userId: number, certId: number) {
    const candidate = await this.findCandidateByUserId(userId);
    const cert = await this.certificateRepository.findOne({
      where: { id: certId, candidateId: candidate.id },
    });

    if (!cert) throw new NotFoundException('Certificate not found');

    if (cert.cerImgUrl) {
      try {
        const urlParts = cert.cerImgUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await this.supabaseService.deleteFile(
          `candidates/${userId}/certificates/${fileName}`,
        );
      } catch (e) {
        this.logger.error(
          `Error deleting certificate: ${(e as Error).message}`,
          (e as Error).stack,
        );
      }
    }

    await this.certificateRepository.remove(cert);
    return { message: 'Certificate deleted successfully' };
  }

  private async findCandidateByUserId(userId: number) {
    const candidate = await this.candidateRepository.findOne({
      where: { userId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate profile not found');
    }
    return candidate;
  }
}
