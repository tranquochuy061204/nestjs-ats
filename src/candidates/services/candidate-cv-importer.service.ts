import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CandidateEntity } from '../entities/candidate.entity';
import { CandidateSkillTagEntity } from '../entities/candidate-skill-tag.entity';
import { WorkExperienceEntity } from '../entities/work-experience.entity';
import { EducationEntity } from '../entities/education.entity';
import { ProjectEntity } from '../entities/project.entity';
import { CertificateEntity } from '../entities/certificate.entity';
import { SkillsMetadataService } from '../../metadata/skills/skills-metadata.service';
import { SkillMetadataEntity } from '../../metadata/skills/skill-metadata.entity';
import { CvFullParseResult } from '../interfaces/cv-full-parse.interface';
import { ParsedWorkExperience } from '../interfaces/parsed-work-experience.interface';
import { ParsedEducation } from '../interfaces/parsed-education.interface';
import { ParsedProject } from '../interfaces/parsed-project.interface';
import { Degree } from '../../common/enums/degree.enum';
import { MAX_SKILLS_PER_CANDIDATE } from './candidate-skills.service';
import { toSlug } from '../../common/utils/string.util';
import { ParseAndApplyResult } from '../interfaces/cv-parser.interface';

@Injectable()
export class CandidateCvImporterService {
  private readonly logger = new Logger(CandidateCvImporterService.name);

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
  ) {}

  async importToDatabase(
    candidate: CandidateEntity,
    parsed: CvFullParseResult,
  ): Promise<ParseAndApplyResult['summary']> {
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

    return {
      profileFieldsUpdated,
      workExperiencesAdded,
      educationsAdded,
      projectsAdded,
      certificatesAdded,
      skillsAdded,
    };
  }

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

  private async upsertWorkExperiences(
    candidateId: number,
    items: ParsedWorkExperience[],
  ): Promise<number> {
    if (!items.length) return 0;

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

  private async upsertSkills(
    candidateId: number,
    skillNames: string[],
  ): Promise<number> {
    if (!skillNames.length) return 0;

    const uniqueNames = [
      ...new Set(skillNames.map((s) => s.trim()).filter(Boolean)),
    ];

    const knownSkills =
      await this.skillsMetadataService.findManyByFuzzy(uniqueNames);
    const knownSlugs = new Set(knownSkills.map((s) => s.slug));

    const unknownNames = uniqueNames.filter(
      (raw) => !knownSlugs.has(toSlug(raw)),
    );
    const newlyResolved = await this.resolveUnknownSkills(unknownNames);

    const allSkills = [...knownSkills, ...newlyResolved];
    return this.linkSkillsToCandidate(candidateId, allSkills);
  }

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

  private async linkSkillsToCandidate(
    candidateId: number,
    skills: SkillMetadataEntity[],
  ): Promise<number> {
    const currentCount = await this.skillTagRepo.count({
      where: { candidateId },
    });

    let added = 0;

    for (const skill of skills) {
      if (!skill) continue;
      if (currentCount + added >= MAX_SKILLS_PER_CANDIDATE) {
        this.logger.warn(
          `Candidate #${candidateId} reached max skills limit (${MAX_SKILLS_PER_CANDIDATE}). Skipping remaining parsed skills.`,
        );
        break;
      }

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
}
