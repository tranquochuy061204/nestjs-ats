import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from '../../common/ai/ai-provider.service';
import { CvFileData } from '../interfaces/cv-parser.interface';
import { CvFullParseResult } from '../interfaces/cv-full-parse.interface';
import { CV_FULL_PARSE_PROMPT } from '../prompts/cv-full-parse.prompt';
import {
  sanitizeString,
  sanitizeNonNegativeInt,
  sanitizeWorkExperiences,
  sanitizeEducations,
  sanitizeProjects,
  sanitizeStringArray,
} from '../utils/cv-sanitizer.util';

const MAX_CV_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const VALID_CV_MIME_TYPES = ['pdf', 'image'];

@Injectable()
export class CandidateCvAiExtractorService {
  private readonly logger = new Logger(CandidateCvAiExtractorService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiProvider: AiProviderService,
  ) {}

  async extractFromUrl(cvUrl: string): Promise<CvFullParseResult> {
    const fileData = await this.fetchCvFileOrThrow(cvUrl);
    return this.parseWithAi(fileData);
  }

  private async fetchCvFileOrThrow(cvUrl: string): Promise<CvFileData> {
    const fileData = await this.fetchCvFile(cvUrl);
    if (!fileData) {
      throw new BadRequestException(
        'Không thể đọc file CV. Đảm bảo file là PDF hoặc ảnh (JPG/PNG) dưới 10MB và thử lại.',
      );
    }
    return fileData;
  }

  private async fetchCvFile(url: string): Promise<CvFileData | null> {
    if (!url || !url.startsWith('http')) return null;
    if (!this.isAllowedCvHost(url)) return null;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_CV_SIZE_BYTES) {
        this.logger.warn(`CV file too large (${contentLength} bytes): ${url}`);
        return null;
      }

      const mimeType = res.headers.get('content-type') || 'application/pdf';
      const isValidType = VALID_CV_MIME_TYPES.some((t) => mimeType.includes(t));
      if (!isValidType) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      return { base64: buffer.toString('base64'), mimeType, buffer };
    } catch (err) {
      this.logger.error(`Fetch CV failed: ${url}`, err);
      return null;
    }
  }

  private isAllowedCvHost(url: string): boolean {
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    if (!supabaseUrl) return true;

    try {
      return new URL(url).host === new URL(supabaseUrl).host;
    } catch {
      return false;
    }
  }

  private async parseWithAi(fileData: CvFileData): Promise<CvFullParseResult> {
    try {
      const rawText = await this.aiProvider.generateWithFile(
        CV_FULL_PARSE_PROMPT,
        fileData,
      );
      return this.parseAiResponse(rawText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI CV parse failed: ${msg}`);
      throw new BadRequestException(
        'AI không thể phân tích nội dung CV. Vui lòng thử lại hoặc điền thông tin thủ công.',
      );
    }
  }

  private parseAiResponse(rawText: string): CvFullParseResult {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in AI response');

    const raw = JSON.parse(jsonMatch[0]) as Partial<CvFullParseResult>;

    return {
      fullName: sanitizeString(raw.fullName),
      phone: sanitizeString(raw.phone),
      position: sanitizeString(raw.position),
      bio: sanitizeString(raw.bio),
      yearWorkingExperience: sanitizeNonNegativeInt(raw.yearWorkingExperience),
      workExperiences: sanitizeWorkExperiences(raw.workExperiences),
      educations: sanitizeEducations(raw.educations),
      projects: sanitizeProjects(raw.projects),
      certificates: sanitizeStringArray(raw.certificates),
      skills: sanitizeStringArray(raw.skills),
    };
  }
}
