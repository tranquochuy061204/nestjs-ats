import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CandidateSkillSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class CandidateSummaryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  fullName: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  position?: string;

  @ApiPropertyOptional()
  yearsOfExperience?: number;

  @ApiProperty({ type: [CandidateSkillSummaryDto] })
  skills: CandidateSkillSummaryDto[];

  @ApiPropertyOptional({ description: 'Điểm khớp kĩ năng (dành cho gợi ý)' })
  matchedSkillsCount?: number;

  @ApiPropertyOptional({
    description: 'Điểm thưởng chứng chỉ (dành cho gợi ý)',
  })
  certificateBonusCount?: number;
}
