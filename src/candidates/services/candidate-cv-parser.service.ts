import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
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

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CandidateCvParserService {
  private readonly logger = new Logger(CandidateCvParserService.name);
  private genAI: GoogleGenerativeAI;
  private readonly aiModel: string;

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
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    this.aiModel = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.5-flash',
    );
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async parseAndApply(userId: number): Promise<{
    message: string;
    summary: {
      profileFieldsUpdated: string[];
      workExperiencesAdded: number;
      educationsAdded: number;
      projectsAdded: number;
      certificatesAdded: number;
      skillsAdded: number;
    };
  }> {
    if (!this.genAI) {
      throw new BadRequestException(
        'Tính năng AI Parse CV chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
      );
    }

    const candidate = await this.candidateRepo.findOne({ where: { userId } });
    if (!candidate) {
      throw new NotFoundException('Hồ sơ ứng viên không tồn tại');
    }
    if (!candidate.cvUrl) {
      throw new BadRequestException(
        'Bạn chưa upload CV. Vui lòng upload CV trước khi sử dụng tính năng này.',
      );
    }

    const fileData = await this.fetchBase64Cv(candidate.cvUrl);
    if (!fileData) {
      throw new BadRequestException(
        'Không thể đọc file CV. Đảm bảo file là PDF hoặc ảnh (JPG/PNG) dưới 10MB và thử lại.',
      );
    }

    const parsed = await this.callGeminiFullParse(fileData);

    // ── Profile fields ──
    const profileFieldsUpdated: string[] = [];
    const updates: Partial<CandidateEntity> = {};

    if (parsed.fullName) {
      updates.fullName = parsed.fullName;
      profileFieldsUpdated.push('fullName');
    }
    if (parsed.phone) {
      updates.phone = parsed.phone;
      profileFieldsUpdated.push('phone');
    }
    if (parsed.position) {
      updates.position = parsed.position;
      profileFieldsUpdated.push('position');
    }
    if (parsed.bio) {
      updates.bio = parsed.bio;
      profileFieldsUpdated.push('bio');
    }
    if (parsed.yearWorkingExperience != null) {
      updates.yearWorkingExperience = parsed.yearWorkingExperience;
      profileFieldsUpdated.push('yearWorkingExperience');
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(candidate, updates);
      await this.candidateRepo.save(candidate);
    }

    // ── Related entities ──
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
        `profile(${profileFieldsUpdated.join(',')}) · ` +
        `workExp+${workExperiencesAdded} edu+${educationsAdded} ` +
        `proj+${projectsAdded} cert+${certificatesAdded} skill+${skillsAdded}`,
    );

    return {
      message:
        `Phân tích CV thành công. Đã cập nhật ${profileFieldsUpdated.length} trường hồ sơ, ` +
        `thêm ${workExperiencesAdded} kinh nghiệm, ${educationsAdded} học vấn, ` +
        `${projectsAdded} dự án, ${certificatesAdded} chứng chỉ, ${skillsAdded} kỹ năng.`,
      summary: {
        profileFieldsUpdated,
        workExperiencesAdded,
        educationsAdded,
        projectsAdded,
        certificatesAdded,
        skillsAdded,
      },
    };
  }

  // ─── Gemini Call ─────────────────────────────────────────────────────────

  private async callGeminiFullParse(fileData: {
    base64: string;
    mimeType: string;
  }): Promise<CvFullParseResult> {
    try {
      const model = this.genAI.getGenerativeModel({ model: this.aiModel });
      const result = await model.generateContent([
        { inlineData: { data: fileData.base64, mimeType: fileData.mimeType } },
        CV_FULL_PARSE_PROMPT,
      ]);

      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in AI response');

      const raw = JSON.parse(jsonMatch[0]);

      // Sanitize to ensure contract is met regardless of model variation
      return {
        fullName:
          typeof raw.fullName === 'string' ? raw.fullName.trim() || null : null,
        phone: typeof raw.phone === 'string' ? raw.phone.trim() || null : null,
        position:
          typeof raw.position === 'string' ? raw.position.trim() || null : null,
        bio: typeof raw.bio === 'string' ? raw.bio.trim() || null : null,
        yearWorkingExperience:
          typeof raw.yearWorkingExperience === 'number'
            ? Math.max(0, Math.round(raw.yearWorkingExperience))
            : null,
        workExperiences: Array.isArray(raw.workExperiences)
          ? raw.workExperiences.filter(
              (w: any) => w?.companyName && w?.position,
            )
          : [],
        educations: Array.isArray(raw.educations)
          ? raw.educations
              .filter((e: any) => e?.schoolName)
              .map((e: any) => ({
                ...e,
                degree: Object.values(Degree).includes(e.degree as Degree)
                  ? (e.degree as Degree)
                  : Degree.NONE,
              }))
          : [],
        projects: Array.isArray(raw.projects)
          ? raw.projects.filter((p: any) => p?.name)
          : [],
        certificates: Array.isArray(raw.certificates)
          ? raw.certificates.filter(
              (c: any) => typeof c === 'string' && c.trim(),
            )
          : [],
        skills: Array.isArray(raw.skills)
          ? raw.skills.filter((s: any) => typeof s === 'string' && s.trim())
          : [],
      };
    } catch (error: unknown) {
      this.logger.error(
        'Gemini CV parse failed',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException(
        'AI không thể phân tích nội dung CV. Vui lòng thử lại hoặc điền thông tin thủ công.',
      );
    }
  }

  // ─── Upsert Logic ────────────────────────────────────────────────────────

  private async upsertWorkExperiences(
    candidateId: number,
    items: ParsedWorkExperience[],
  ): Promise<number> {
    if (!items.length) return 0;
    const count = await this.workExpRepo.count({ where: { candidateId } });
    if (count > 0) return 0;

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
    const count = await this.educationRepo.count({ where: { candidateId } });
    if (count > 0) return 0;

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
    const count = await this.projectRepo.count({ where: { candidateId } });
    if (count > 0) return 0;

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
    const existingSet = new Set(existing.map((c) => c.name.toLowerCase()));
    const newOnes = names
      .map((n) => n.trim())
      .filter((n) => n && !existingSet.has(n.toLowerCase()))
      .map((name) => this.certificateRepo.create({ candidateId, name }));

    if (newOnes.length > 0) await this.certificateRepo.save(newOnes);
    return newOnes.length;
  }

  private async upsertSkills(
    candidateId: number,
    skillNames: string[],
  ): Promise<number> {
    if (!skillNames.length) return 0;
    const uniqueRawSkills = Array.from(
      new Set(skillNames.map((s) => s.trim()).filter((s) => s)),
    );
    const foundSkills =
      await this.skillsMetadataService.findManyByFuzzy(uniqueRawSkills);
    const foundSkillSlugs = new Set(foundSkills.map((s) => s.slug));
    const knownSkillsList = [...foundSkills];
    const unknownRawSkillsList = uniqueRawSkills.filter(
      (raw) => !foundSkillSlugs.has(toSlug(raw)),
    );

    if (unknownRawSkillsList.length > 0) {
      try {
        const formatted =
          await this.skillsMetadataService.formatWithAI(unknownRawSkillsList);
        for (let i = 0; i < formatted.length; i++) {
          const raw = unknownRawSkillsList[i] || formatted[i].name;
          const { name, type } = formatted[i];
          const newSkill = await this.skillsMetadataService.upsertSkill(
            name,
            type,
            raw,
          );
          knownSkillsList.push(newSkill);
        }
      } catch (err) {
        this.logger.error('Failed to batch format skills with AI', err);
      }
    }

    let added = 0;
    for (const skill of knownSkillsList) {
      if (!skill) continue;
      const existing = await this.skillTagRepo.findOne({
        where: { candidateId, skillMetadataId: skill.id },
      });
      if (!existing) {
        await this.skillTagRepo.save(
          this.skillTagRepo.create({ candidateId, skillMetadataId: skill.id }),
        );
        await this.skillsMetadataService.incrementUseCount(skill.id);
        added++;
      }
    }
    return added;
  }

  private async fetchBase64Cv(
    url: string | null,
  ): Promise<{ base64: string; mimeType: string } | null> {
    if (!url || !url.startsWith('http')) return null;
    const supabaseUrl = this.configService.get<string>('SUPABASE_PROJECT_URL');
    if (supabaseUrl) {
      try {
        const urlHost = new URL(url).host;
        const supabaseHost = new URL(supabaseUrl).host;
        if (urlHost !== supabaseHost) return null;
      } catch {
        return null;
      }
    }
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024)
        return null;
      const mimeType = res.headers.get('content-type') || 'application/pdf';
      if (!mimeType.includes('pdf') && !mimeType.includes('image')) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      return { base64: buffer.toString('base64'), mimeType };
    } catch (e) {
      this.logger.error('Fetch CV failed: ' + url, e);
      return null;
    }
  }
}
