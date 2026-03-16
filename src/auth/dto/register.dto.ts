import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.email('Email is invalid').nonempty('Email is required'),
  password: z
    .string({ error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
