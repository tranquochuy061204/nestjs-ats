import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

const AddSkillsSchema = z.object({
  skills: z
    .array(z.union([z.number().int(), z.string()]))
    .nonempty('Phải có ít nhất 1 skill'),
});

export class AddSkillsDto extends createZodDto(AddSkillsSchema) {
  @ApiProperty({
    description:
      'Mảng hỗn hợp: số (ID skill đã chọn từ gợi ý) hoặc chuỗi (skill user tự gõ, sẽ được AI format)',
    example: [1, 2, 'Typescrist'],
    type: [Object],
  })
  skills: (number | string)[];
}
