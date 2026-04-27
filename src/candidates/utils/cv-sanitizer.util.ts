import { ParsedWorkExperience } from '../interfaces/parsed-work-experience.interface';
import { ParsedEducation } from '../interfaces/parsed-education.interface';
import { ParsedProject } from '../interfaces/parsed-project.interface';
import { Degree } from '../../common/enums/degree.enum';

export function sanitizeString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

export function sanitizeNonNegativeInt(value: unknown): number | null {
  return typeof value === 'number' ? Math.max(0, Math.round(value)) : null;
}

export function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && !!item.trim())
    .map((item) => item.trim());
}

export function sanitizeWorkExperiences(
  value: unknown,
): ParsedWorkExperience[] {
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

export function sanitizeEducations(value: unknown): ParsedEducation[] {
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

export function sanitizeProjects(value: unknown): ParsedProject[] {
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
