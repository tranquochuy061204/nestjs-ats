import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SkillMetadataEntity, SkillType } from './skill-metadata.entity';
import { SKILL_STANDARDIZER_PROMPT } from './skills-metadata.constants';
import { toSlug } from '../../common/utils/string.util';

@Injectable()
export class SkillsMetadataService {
  private readonly logger = new Logger(SkillsMetadataService.name);
  private genAI: GoogleGenerativeAI;

  constructor(
    @InjectRepository(SkillMetadataEntity)
    private readonly skillMetadataRepository: Repository<SkillMetadataEntity>,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  /**
   * Search skills — exact match trước, fuzzy sau.
   * Dùng cho autocomplete (Phase 1).
   */
  async search(query: string, limit = 10) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    return this.skillMetadataRepository
      .createQueryBuilder('skill')
      .where('LOWER(skill.canonical_name) LIKE :q', { q: `%${trimmed}%` })
      .orWhere('skill.aliases::text ILIKE :q2', { q2: `%${trimmed}%` })
      .orderBy(
        `CASE WHEN LOWER(skill.canonical_name) = :exact THEN 0
              WHEN LOWER(skill.canonical_name) LIKE :startsWith THEN 1
              ELSE 2 END`,
      )
      .setParameters({ exact: trimmed, startsWith: `${trimmed}%` })
      .addOrderBy('skill.use_count', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Tìm skill bằng slug (exact match).
   */
  async findBySlug(slug: string) {
    return this.skillMetadataRepository.findOne({ where: { slug } });
  }

  /**
   * Fuzzy search cho 1 raw skill name.
   * Tìm trong canonical_name + aliases.
   */
  async findByFuzzy(rawName: string) {
    const slug = toSlug(rawName);

    // Exact slug match trước
    const exact = await this.findBySlug(slug);
    if (exact) return exact;

    // Fuzzy: search trong aliases
    return this.skillMetadataRepository
      .createQueryBuilder('skill')
      .where('skill.aliases::text ILIKE :q', {
        q: `%${rawName.trim()}%`,
      })
      .getOne();
  }

  /**
   * Batch gọi AI Gemini để format + phân loại nhiều skills.
   */
  async formatWithAI(
    rawSkills: string[],
  ): Promise<{ name: string; type: SkillType }[]> {
    if (!this.genAI || rawSkills.length === 0) {
      // Fallback nếu không có API key: trim + title case
      return rawSkills.map((s) => ({
        name: s.trim(),
        type: SkillType.HARD,
      }));
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      const prompt = SKILL_STANDARDIZER_PROMPT(rawSkills);

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      this.logger.log(`AI Response: ${text}`);

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn('AI response is not valid JSON, using fallback');
        return rawSkills.map((s) => ({
          name: s.trim(),
          type: SkillType.HARD,
        }));
      }

      return JSON.parse(jsonMatch[0]) as { name: string; type: SkillType }[];
    } catch (error) {
      this.logger.error('AI formatting failed, using fallback', error);
      return rawSkills.map((s) => ({
        name: s.trim(),
        type: SkillType.HARD,
      }));
    }
  }

  /**
   * Upsert skill vào metadata.
   * Dùng ON CONFLICT (slug) DO UPDATE để xử lý race condition.
   */
  async upsertSkill(
    name: string,
    type: SkillType,
    alias?: string,
  ): Promise<SkillMetadataEntity> {
    const slug = toSlug(name);
    this.logger.log(
      `Upserting skill: ${name} (slug: ${slug}, alias: ${alias})`,
    );

    // Kiểm tra xem đã tồn tại chưa
    let skill = await this.findBySlug(slug);

    if (skill) {
      // Đã có → tăng use_count và thêm alias
      skill.useCount += 1;
      if (alias && !skill.aliases.includes(alias)) {
        skill.aliases = [...skill.aliases, alias];
      }
      await this.skillMetadataRepository.save(skill);
    } else {
      // Chưa có → Insert mới
      try {
        skill = this.skillMetadataRepository.create({
          canonicalName: name,
          slug,
          type,
          aliases: alias ? [alias] : [],
          useCount: 1,
        });
        skill = await this.skillMetadataRepository.save(skill);
      } catch (e) {
        // Có thể do race condition, thử tìm lại
        skill = await this.findBySlug(slug);
        if (skill) return this.upsertSkill(name, type, alias);
        throw e;
      }
    }

    return skill;
  }

  /**
   * Tăng use_count cho skill đã biết.
   */
  async incrementUseCount(id: number) {
    await this.skillMetadataRepository.increment({ id }, 'useCount', 1);
  }

  /**
   * Find by ID.
   */
  async findById(id: number) {
    return this.skillMetadataRepository.findOne({ where: { id } });
  }

  /**
   * Find multiple by IDs.
   */
  async findByIds(ids: number[]) {
    if (!ids || ids.length === 0) return [];
    return this.skillMetadataRepository.find({ where: { id: In(ids) } });
  }

  /**
   * Tăng use_count cho nhiều skills.
   */
  async incrementUseCountBulk(ids: number[]) {
    if (!ids || ids.length === 0) return;
    await this.skillMetadataRepository.increment(
      { id: In(ids) },
      'useCount',
      1,
    );
  }
}
