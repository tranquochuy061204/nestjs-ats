import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const CreateApplicationNoteSchema = z.object({
  content: z.string().min(1, 'Nội dung ghi chú không được để trống').max(2000),
});

export class CreateApplicationNoteDto extends createZodDto(
  CreateApplicationNoteSchema,
) {
  @ApiProperty({
    description: 'Nội dung ghi chú',
    minLength: 1,
    maxLength: 2000,
  })
  content: string;
}
