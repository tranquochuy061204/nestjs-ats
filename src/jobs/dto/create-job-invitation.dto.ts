import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const CreateJobInvitationSchema = z.object({
  jobId: z.coerce.number().int(),
  candidateId: z.coerce.number().int(),
  message: z.string().optional(),
});

export class CreateJobInvitationDto extends createZodDto(
  CreateJobInvitationSchema,
) {
  @ApiProperty({ description: 'ID của Job muốn mời ứng tuyển', example: 1 })
  jobId: number;

  @ApiProperty({ description: 'ID của Ứng viên muốn mời', example: 10 })
  candidateId: number;

  @ApiPropertyOptional({
    description: 'Lời nhắn gửi đến ứng viên',
    example: 'Chào bạn, chúng tôi thấy hồ sơ của bạn rất phù hợp...',
  })
  message?: string;
}
