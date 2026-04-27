import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { CandidateCvAiExtractorService } from './candidate-cv-ai-extractor.service';
import { CandidateCvImporterService } from './candidate-cv-importer.service';
import { ParseAndApplyResult } from '../interfaces/cv-parser.interface';

/**
 * CandidateCvParserService
 *
 * Đã refactor thành Facade Pattern:
 * Điều phối flow "Parse CV rồi áp vào hồ sơ" bằng cách ủy quyền cho:
 *   1. CandidateCvAiExtractorService (Fetch file & AI Parsing)
 *   2. CandidateCvImporterService (Sanitization & Database Upsert)
 */
@Injectable()
export class CandidateCvParserService {
  private readonly logger = new Logger(CandidateCvParserService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    private readonly aiExtractor: CandidateCvAiExtractorService,
    private readonly cvImporter: CandidateCvImporterService,
  ) {}

  async parseAndApply(userId: number): Promise<ParseAndApplyResult> {
    const candidate = await this.findCandidateOrThrow(userId);

    // 1. Tải file từ Supabase và gọi AI parse thành JSON (được sanitize)
    const parsed = await this.aiExtractor.extractFromUrl(candidate.cvUrl);

    // 2. Insert dữ liệu vào 5 bảng thông qua Importer
    const summary = await this.cvImporter.importToDatabase(candidate, parsed);

    this.logger.log(
      `CV Parse OK · Candidate #${candidate.id} · ` +
        `profile(${summary.profileFieldsUpdated.join(',') || 'none'}) · ` +
        `workExp+${summary.workExperiencesAdded} edu+${summary.educationsAdded} ` +
        `proj+${summary.projectsAdded} cert+${summary.certificatesAdded} skill+${summary.skillsAdded}`,
    );

    return this.buildSuccessResponse(summary);
  }

  private async findCandidateOrThrow(userId: number): Promise<CandidateEntity> {
    const candidate = await this.candidateRepo.findOne({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException('Hồ sơ ứng viên không tồn tại');
    }
    if (!candidate.cvUrl) {
      throw new BadRequestException(
        'Bạn chưa upload CV. Vui lòng upload CV trước khi sử dụng tính năng này.',
      );
    }
    return candidate;
  }

  private buildSuccessResponse(
    summary: ParseAndApplyResult['summary'],
  ): ParseAndApplyResult {
    const {
      profileFieldsUpdated,
      workExperiencesAdded,
      educationsAdded,
      projectsAdded,
      certificatesAdded,
      skillsAdded,
    } = summary;

    return {
      message:
        `Phân tích CV thành công. Đã cập nhật ${profileFieldsUpdated.length} trường hồ sơ, ` +
        `thêm ${workExperiencesAdded} kinh nghiệm, ${educationsAdded} học vấn, ` +
        `${projectsAdded} dự án, ${certificatesAdded} chứng chỉ, ${skillsAdded} kỹ năng.`,
      summary,
    };
  }
}
