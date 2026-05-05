// Core & Config
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Entities
import { UserEntity, UserRole } from '../users/entities/user.entity';

// DTOs
import { LoginDto } from './dto/login.dto';

// Services
import { AuthTokenService } from './services/auth-token.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async validateUser({ email, password }: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['candidate'],
    });
    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    return user;
  }

  async login(user: UserEntity) {
    const jti = crypto.randomUUID();
    const tokens = await this.authTokenService.generateTokenPair(user, jti);
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      jti,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async loginAdmin(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Tài khoản không có quyền quản trị');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mật khẩu không chính xác');
    }

    return this.login(user);
  }
}
