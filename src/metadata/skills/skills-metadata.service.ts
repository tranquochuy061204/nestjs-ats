import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SkillMetadataEntity, SkillType } from './skill-metadata.entity';
import { SKILL_STANDARDIZER_PROMPT } from './prompts/skill-standardizer.prompt';
import { toSlug } from '../../common/utils/string.util';
import { AiProviderService } from '../../common/ai/ai-provider.service';

@Injectable()
export class SkillsMetadataService {
  private readonly logger = new Logger(SkillsMetadataService.name);

  constructor(
    @InjectRepository(SkillMetadataEntity)
    private readonly skillMetadataRepository: Repository<SkillMetadataEntity>,
    private readonly configService: ConfigService,
    private readonly aiProvider: AiProviderService,
  ) {}

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
    const results = await this.findManyByFuzzy([rawName]);
    return results[0] || null;
  }

  /**
   * Batch fuzzy search cho nhiều raw skill names.
   * Giúp tránh lỗi N+1 query khi parse CV.
   */
  async findManyByFuzzy(rawNames: string[]): Promise<SkillMetadataEntity[]> {
    if (!rawNames.length) return [];
    const trimmedNames = rawNames.map((n) => n.trim()).filter((n) => n);
    if (!trimmedNames.length) return [];

    const slugs = trimmedNames.map((n) => toSlug(n));

    // 1. Tìm chính xác theo slug (Batch)
    const exactMatches = await this.skillMetadataRepository.find({
      where: { slug: In(slugs) },
    });

    const foundSlugs = new Set(exactMatches.map((m) => m.slug));
    const remainingNames = trimmedNames.filter(
      (n) => !foundSlugs.has(toSlug(n)),
    );

    if (remainingNames.length === 0) return exactMatches;

    // 2. Tìm fuzzy trong aliases (Sử dụng 1 query duy nhất với ANY)
    const fuzzyResults = await this.skillMetadataRepository
      .createQueryBuilder('skill')
      .where('skill.aliases::text ILIKE ANY(:queries)', {
        queries: remainingNames.map((n) => `%${n}%`),
      })
      .getMany();

    // Gộp kết quả và trả về (unique by ID)
    const allResults = [...exactMatches, ...fuzzyResults];
    const uniqueMap = new Map(allResults.map((r) => [r.id, r]));

    return Array.from(uniqueMap.values());
  }

  /**
   * Batch gọi AI để format + phân loại nhiều skills.
   * Primary: Gemini, Fallback: GLM-4.5-Air (qua AiProviderService)
   */
  async formatWithAI(
    rawSkills: string[],
  ): Promise<{ name: string; type: SkillType }[]> {
    if (rawSkills.length === 0) {
      return [];
    }

    try {
      const prompt = SKILL_STANDARDIZER_PROMPT(rawSkills);
      const text = await this.aiProvider.generateText(prompt);

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
   * Sử dụng ON CONFLICT (slug) để đảm bảo tính nhất quán (Atomicity).
   */
  async upsertSkill(
    name: string,
    type: SkillType,
    alias?: string,
  ): Promise<SkillMetadataEntity> {
    const slug = toSlug(name);
    const cleanAlias = alias?.trim();

    // Dùng QueryBuilder để thực hiện UPSERT (ON CONFLICT DO UPDATE)
    await this.skillMetadataRepository
      .createQueryBuilder()
      .insert()
      .into(SkillMetadataEntity)
      .values({
        canonicalName: name,
        slug,
        type,
        aliases: cleanAlias ? [cleanAlias] : [],
        useCount: 1,
      })
      .onConflict(
        `("slug") DO UPDATE SET 
         "use_count" = "skill_metadata"."use_count" + 1,
         "aliases" = CASE 
           WHEN NOT ("skill_metadata"."aliases" ? :alias) AND :alias IS NOT NULL 
           THEN "skill_metadata"."aliases" || jsonb_build_array(:alias)
           ELSE "skill_metadata"."aliases"
         END`,
      )
      .setParameter('alias', cleanAlias)
      .execute();

    return this.findBySlug(slug) as Promise<SkillMetadataEntity>;
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
