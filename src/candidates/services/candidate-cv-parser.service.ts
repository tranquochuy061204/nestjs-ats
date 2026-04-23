import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CandidateEntity } from '../entities/candidate.entity';
import { CandidateSkillTagEntity } from '../entities/candidate-skill-tag.entity';
import { WorkExperienceEntity } from '../entities/work-experience.entity';
import { EducationEntity } from '../entities/education.entity';
import { ProjectEntity } from '../entities/project.entity';
import { CertificateEntity } from '../entities/certificate.entity';
import { SkillsMetadataService } from '../../metadata/skills/skills-metadata.service';
import { CvFullParseResult } from '../interfaces/cv-full-parse.interface';
import { ParsedEducation } from '../interfaces/parsed-education.interface';
import { ParsedProject } from '../interfaces/parsed-project.interface';
import { ParsedWorkExperience } from '../interfaces/parsed-work-experience.interface';
import { CV_FULL_PARSE_PROMPT } from '../prompts/cv-full-parse.prompt';
import { toSlug } from '../../common/utils/string.util';
import { Degree } from '../../common/enums/degree.enum';
import { AiProviderService } from '../../common/ai/ai-provider.service';
import { SkillMetadataEntity } from '../../metadata/skills/skill-metadata.entity';

// ─── Internal Types ───────────────────────────────────────────────────────────

/** Raw buffer + metadata của file CV đã fetch từ Supabase */
interface CvFileData {
  base64: string;
  mimeType: string;
  buffer: Buffer;
}

/** Kết quả tổng hợp sau khi apply CV vào profile */
export interface ParseAndApplyResult {
  message: string;
  summary: {
    profileFieldsUpdated: string[];
    workExperiencesAdded: number;
    educationsAdded: number;
    projectsAdded: number;
    certificatesAdded: number;
    skillsAdded: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CV_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const VALID_CV_MIME_TYPES = ['pdf', 'image'];

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * CandidateCvParserService
 *
 * Điều phối toàn bộ flow "Parse CV rồi áp vào hồ sơ":
 *   1. Fetch file CV từ Supabase (SSRF-protected)
 *   2. Gọi AI (Gemini primary → GLM fallback) để phân tích CV thành JSON
 *   3. Sanitize kết quả AI (validate/type-guard từng field)
 *   4. Upsert profile fields + các entity liên quan vào DB
 */
@Injectable()
export class CandidateCvParserService {
  private readonly logger = new Logger(CandidateCvParserService.name);

  constructor(
    @InjectRepository(CandidateEntity)
    private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(CandidateSkillTagEntity)
    private readonly skillTagRepo: Repository<CandidateSkillTagEntity>,
    @InjectRepository(WorkExperienceEntity)
    private readonly workExpRepo: Repository<WorkExperienceEntity>,
    @InjectRepository(EducationEntity)
    private readonly educationRepo: Repository<EducationEntity>,
    @InjectRepository(ProjectEntity)
    private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(CertificateEntity)
    private readonly certificateRepo: Repository<CertificateEntity>,
    private readonly skillsMetadataService: SkillsMetadataService,
    private readonly configService: ConfigService,
    private readonly aiProvider: AiProviderService,
  ) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  async parseAndApply(userId: number): Promise<ParseAndApplyResult> {
    const candidate = await this.findCandidateOrThrow(userId);
    const fileData = await this.fetchCvFileOrThrow(candidate.cvUrl);
    const parsed = await this.parseWithAi(fileData);

    const profileFieldsUpdated = await this.applyProfileFields(
      candidate,
      parsed,
    );

    const [
      workExperiencesAdded,
      educationsAdded,
      projectsAdded,
      certificatesAdded,
      skillsAdded,
    ] = await Promise.all([
      this.upsertWorkExperiences(candidate.id, parsed.workExperiences),
      this.upsertEducations(candidate.id, parsed.educations),
      this.upsertProjects(candidate.id, parsed.projects),
      this.upsertCertificates(candidate.id, parsed.certificates),
      this.upsertSkills(candidate.id, parsed.skills),
    ]);

    this.logger.log(
      `CV Parse OK · Candidate #${candidate.id} · ` +
        `profile(${profileFieldsUpdated.join(',') || 'none'}) · ` +
        `workExp+${workExperiencesAdded} edu+${educationsAdded} ` +
        `proj+${projectsAdded} cert+${certificatesAdded} skill+${skillsAdded}`,
    );

    return this.buildSuccessResponse({
      profileFieldsUpdated,
      workExperiencesAdded,
      educationsAdded,
      projectsAdded,
      certificatesAdded,
      skillsAdded,
    });
  }

  // ─── Step 1: Fetch candidate & file ───────────────────────────────────────

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

  private async fetchCvFileOrThrow(cvUrl: string): Promise<CvFileData> {
    const fileData = await this.fetchCvFile(cvUrl);
    if (!fileData) {
      throw new BadRequestException(
        'Không thể đọc file CV. Đảm bảo file là PDF hoặc ảnh (JPG/PNG) dưới 10MB và thử lại.',
      );
    }
    return fileData;
  }

  /**
   * Fetch CV từ URL, áp dụng:
   * - SSRF protection (chỉ cho phép domain Supabase)
   * - Giới hạn kích thước 10MB
   * - Chỉ chấp nhận PDF và ảnh
   */
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

  /** SSRF check: chỉ cho phép fetch từ domain Supabase đã cấu hình */
  private isAllowedCvHost(url: string): boolean {
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    if (!supabaseUrl) return true; // Không cấu hình → không chặn (dev mode)

    try {
      return new URL(url).host === new URL(supabaseUrl).host;
    } catch {
      return false;
    }
  }

  // ─── Step 2: AI parsing ───────────────────────────────────────────────────

  /**
   * Gọi AI provider (Gemini → GLM fallback), rồi parse + sanitize response.
   * Throws BadRequestException nếu AI hoàn toàn fail.
   */
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

  /**
   * Extract JSON từ raw AI text, sau đó sanitize từng field để đảm bảo
   * contract của CvFullParseResult — bất kể model nào trả về.
   */
  private parseAiResponse(rawText: string): CvFullParseResult {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in AI response');

    // `level` là field đã bị loại bỏ nhưng một số model cũ vẫn trả về
    const raw = JSON.parse(jsonMatch[0]) as Partial<CvFullParseResult> & {
      level?: string;
    };

    return {
      fullName: this.sanitizeString(raw.fullName),
      phone: this.sanitizeString(raw.phone),
      position: this.sanitizeString(raw.position),
      bio: this.sanitizeString(raw.bio),
      yearWorkingExperience: this.sanitizeNonNegativeInt(
        raw.yearWorkingExperience,
      ),
      workExperiences: this.sanitizeWorkExperiences(raw.workExperiences),
      educations: this.sanitizeEducations(raw.educations),
      projects: this.sanitizeProjects(raw.projects),
      certificates: this.sanitizeStringArray(raw.certificates),
      skills: this.sanitizeStringArray(raw.skills),
    };
  }

  // ─── Step 3: Profile field apply ─────────────────────────────────────────

  /**
   * Cập nhật các field đơn giản của CandidateEntity từ kết quả parse.
   * Chỉ ghi đè field nếu AI trả về giá trị hợp lệ.
   * Returns danh sách field đã được cập nhật.
   */
  private async applyProfileFields(
    candidate: CandidateEntity,
    parsed: CvFullParseResult,
  ): Promise<string[]> {
    const updates: Partial<CandidateEntity> = {};
    const updatedFields: string[] = [];

    const profileFieldMap: [keyof CvFullParseResult, keyof CandidateEntity][] =
      [
        ['fullName', 'fullName'],
        ['phone', 'phone'],
        ['position', 'position'],
        ['bio', 'bio'],
        ['yearWorkingExperience', 'yearWorkingExperience'],
      ];

    for (const [parsedKey, entityKey] of profileFieldMap) {
      const value = parsed[parsedKey];
      if (value != null) {
        (updates as Record<string, unknown>)[entityKey] = value;
        updatedFields.push(entityKey);
      }
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(candidate, updates);
      await this.candidateRepo.save(candidate);
    }

    return updatedFields;
  }

  // ─── Step 4: Upsert related entities ─────────────────────────────────────

  private async upsertWorkExperiences(
    candidateId: number,
    items: ParsedWorkExperience[],
  ): Promise<number> {
    if (!items.length) return 0;

    // Không ghi đè nếu đã có dữ liệu (user tự nhập trước)
    const existingCount = await this.workExpRepo.count({
      where: { candidateId },
    });
    if (existingCount > 0) return 0;

    const entities = items.map((w) =>
      this.workExpRepo.create({
        candidateId,
        companyName: w.companyName,
        position: w.position,
        startDate: w.startDate ?? undefined,
        endDate: w.isWorkingHere ? undefined : (w.endDate ?? undefined),
        isWorkingHere: w.isWorkingHere ?? false,
        description: w.description ?? undefined,
      }),
    );

    await this.workExpRepo.save(entities);
    return entities.length;
  }

  private async upsertEducations(
    candidateId: number,
    items: ParsedEducation[],
  ): Promise<number> {
    if (!items.length) return 0;

    const existingCount = await this.educationRepo.count({
      where: { candidateId },
    });
    if (existingCount > 0) return 0;

    const entities = items.map((e) =>
      this.educationRepo.create({
        candidateId,
        schoolName: e.schoolName,
        major: e.major ?? undefined,
        degree: e.degree ?? Degree.NONE,
        startDate: e.startDate ?? undefined,
        endDate: e.isStillStudying ? undefined : (e.endDate ?? undefined),
        isStillStudying: e.isStillStudying ?? false,
        description: e.description ?? undefined,
      }),
    );

    await this.educationRepo.save(entities);
    return entities.length;
  }

  private async upsertProjects(
    candidateId: number,
    items: ParsedProject[],
  ): Promise<number> {
    if (!items.length) return 0;

    const existingCount = await this.projectRepo.count({
      where: { candidateId },
    });
    if (existingCount > 0) return 0;

    const entities = items.map((p) =>
      this.projectRepo.create({
        candidateId,
        name: p.name,
        startDate: p.startDate ?? undefined,
        endDate: p.endDate ?? undefined,
        description: p.description ?? undefined,
      }),
    );

    await this.projectRepo.save(entities);
    return entities.length;
  }

  private async upsertCertificates(
    candidateId: number,
    names: string[],
  ): Promise<number> {
    if (!names.length) return 0;

    const existing = await this.certificateRepo.find({
      where: { candidateId },
    });
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

    const newEntities = names
      .map((n) => n.trim())
      .filter((n) => n && !existingNames.has(n.toLowerCase()))
      .map((name) => this.certificateRepo.create({ candidateId, name }));

    if (newEntities.length > 0) await this.certificateRepo.save(newEntities);
    return newEntities.length;
  }

  /**
   * Upsert skills cho candidate:
   * 1. Dedup & normalize raw names
   * 2. Fuzzy-match với skill metadata đã có trong DB
   * 3. Những skill chưa có → gọi AI format → upsert vào metadata
   * 4. Link skill metadata → candidate qua skill_tag
   */
  private async upsertSkills(
    candidateId: number,
    skillNames: string[],
  ): Promise<number> {
    if (!skillNames.length) return 0;

    const uniqueNames = [
      ...new Set(skillNames.map((s) => s.trim()).filter(Boolean)),
    ];

    // Bước 1: Tìm skill đã biết trong DB (fuzzy match)
    const knownSkills =
      await this.skillsMetadataService.findManyByFuzzy(uniqueNames);
    const knownSlugs = new Set(knownSkills.map((s) => s.slug));

    // Bước 2: Với skill chưa có → nhờ AI format rồi upsert vào metadata
    const unknownNames = uniqueNames.filter(
      (raw) => !knownSlugs.has(toSlug(raw)),
    );
    const newlyResolved = await this.resolveUnknownSkills(unknownNames);

    // Bước 3: Link tất cả vào candidate
    const allSkills = [...knownSkills, ...newlyResolved];
    return this.linkSkillsToCandidate(candidateId, allSkills);
  }

  /** Format và upsert các skill chưa có trong metadata */
  private async resolveUnknownSkills(
    unknownNames: string[],
  ): Promise<SkillMetadataEntity[]> {
    if (!unknownNames.length) return [];

    try {
      const formatted =
        await this.skillsMetadataService.formatWithAI(unknownNames);

      const results = await Promise.all(
        formatted.map((item, i) => {
          const rawAlias = unknownNames[i] ?? item.name;
          return this.skillsMetadataService.upsertSkill(
            item.name,
            item.type,
            rawAlias,
          );
        }),
      );

      return results.filter((s): s is SkillMetadataEntity => s != null);
    } catch (err) {
      this.logger.error('Failed to resolve unknown skills via AI', err);
      return [];
    }
  }

  /** Tạo skill_tag records; bỏ qua skill đã được link, tăng use_count */
  private async linkSkillsToCandidate(
    candidateId: number,
    skills: SkillMetadataEntity[],
  ): Promise<number> {
    let added = 0;

    for (const skill of skills) {
      if (!skill) continue;

      const alreadyLinked = await this.skillTagRepo.findOne({
        where: { candidateId, skillMetadataId: skill.id },
      });
      if (alreadyLinked) continue;

      await this.skillTagRepo.save(
        this.skillTagRepo.create({ candidateId, skillMetadataId: skill.id }),
      );
      await this.skillsMetadataService.incrementUseCount(skill.id);
      added++;
    }

    return added;
  }

  // ─── Sanitizers: AI response → typed fields ───────────────────────────────
  // Mỗi hàm nhận unknown input và trả về giá trị đã validate.
  // Tách ra để dễ test độc lập và tái sử dụng.

  private sanitizeString(value: unknown): string | null {
    return typeof value === 'string' ? value.trim() || null : null;
  }

  private sanitizeNonNegativeInt(value: unknown): number | null {
    return typeof value === 'number' ? Math.max(0, Math.round(value)) : null;
  }

  private sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is string => typeof item === 'string' && !!item.trim(),
      )
      .map((item) => item.trim());
  }

  private sanitizeWorkExperiences(value: unknown): ParsedWorkExperience[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item): ParsedWorkExperience | null => {
        if (!item || typeof item !== 'object') return null;
        const src = item as Record<string, unknown>;
        if (typeof src['companyName'] !== 'string') return null;

        return {
          companyName: src['companyName'],
          position: typeof src['position'] === 'string' ? src['position'] : '',
          startDate:
            typeof src['startDate'] === 'string' ? src['startDate'] : null,
          endDate: typeof src['endDate'] === 'string' ? src['endDate'] : null,
          isWorkingHere: !!src['isWorkingHere'],
          description:
            typeof src['description'] === 'string' ? src['description'] : null,
        };
      })
      .filter((item): item is ParsedWorkExperience => item !== null);
  }

  private sanitizeEducations(value: unknown): ParsedEducation[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item): ParsedEducation | null => {
        if (!item || typeof item !== 'object') return null;
        const src = item as Record<string, unknown>;
        if (typeof src['schoolName'] !== 'string') return null;

        return {
          schoolName: src['schoolName'],
          major: typeof src['major'] === 'string' ? src['major'] : null,
          degree:
            typeof src['degree'] === 'string' &&
            Object.values(Degree).includes(src['degree'] as Degree)
              ? (src['degree'] as Degree)
              : Degree.NONE,
          startDate:
            typeof src['startDate'] === 'string' ? src['startDate'] : null,
          endDate: typeof src['endDate'] === 'string' ? src['endDate'] : null,
          isStillStudying: !!src['isStillStudying'],
          description:
            typeof src['description'] === 'string' ? src['description'] : null,
        };
      })
      .filter((item): item is ParsedEducation => item !== null);
  }

  private sanitizeProjects(value: unknown): ParsedProject[] {
    if (!Array.isArray(value)) return [];

    return value
      .map((item): ParsedProject | null => {
        if (!item || typeof item !== 'object') return null;
        const src = item as Record<string, unknown>;
        if (typeof src['name'] !== 'string') return null;

        return {
          name: src['name'],
          startDate:
            typeof src['startDate'] === 'string' ? src['startDate'] : null,
          endDate: typeof src['endDate'] === 'string' ? src['endDate'] : null,
          description:
            typeof src['description'] === 'string' ? src['description'] : null,
        };
      })
      .filter((item): item is ParsedProject => item !== null);
  }

  // ─── Response builder ─────────────────────────────────────────────────────

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
