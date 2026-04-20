import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CompanyRole {
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
}

const AddMemberSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  fullName: z.string().min(1, 'Họ tên không được để trống'),
  role: z.nativeEnum(CompanyRole),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').optional().or(z.literal('')),
});

export class AddMemberDto extends createZodDto(AddMemberSchema) {
  @ApiProperty({ example: 'new.member@company.com' })
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ enum: CompanyRole, example: CompanyRole.RECRUITER })
  role: CompanyRole;

  @ApiPropertyOptional({ example: 'Password123!' })
  password?: string;
}
