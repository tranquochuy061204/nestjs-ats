// Core & Config
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// Controllers
import { AuthController } from './auth.controller';

// Services
import { AuthService } from './auth.service';
import { AuthTokenService } from './services/auth-token.service';
import { AuthRegistrationService } from './services/auth-registration.service';
import { AuthVerificationService } from './services/auth-verification.service';
import { AuthPasswordService } from './services/auth-password.service';

// Strategies
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

// Entities
import { UserEntity } from '../users/entities/user.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';

// Modules
import { CandidatesModule } from '../candidates/candidates.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity]),
    forwardRef(() => CandidatesModule),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_TIME'),
        },
      }),
      inject: [ConfigService],
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    AuthRegistrationService,
    AuthVerificationService,
    AuthPasswordService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
  exports: [AuthService, AuthTokenService, AuthVerificationService, JwtModule],
})
export class AuthModule {}
