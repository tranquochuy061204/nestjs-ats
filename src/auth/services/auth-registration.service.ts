import {
  Injectable,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserEntity, UserRole } from '../../users/entities/user.entity';
import { RegisterDto } from '../dto/register.dto';
import { RegisterEmployerDto } from '../dto/register-employer.dto';
import { CandidateProfileService } from '../../candidates/services/candidate-profile.service';
import { MailService } from '../../mail/mail.service';
import { generateVerificationToken } from '../../common/utils/crypto.util';

@Injectable()
export class AuthRegistrationService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(forwardRef(() => CandidateProfileService))
    private readonly candidateProfileService: CandidateProfileService,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, provinceId } =
      registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const verificationToken = generateVerificationToken();

    const { savedUser, candidate } = await this.dataSource.transaction(
      async (manager) => {
        const user = manager.create(UserEntity, {
          email,
          password,
          role: UserRole.CANDIDATE,
          emailVerificationToken: verificationToken,
          isEmailVerified: false,
        });
        const savedUser = await manager.save(UserEntity, user);

        const candidate = await this.candidateProfileService.createCoreProfile(
          { userId: savedUser.id, firstName, lastName, phone, provinceId },
          manager,
        );

        return { savedUser, candidate };
      },
    );

    void this.mailService.sendVerificationEmail(
      email,
      candidate.fullName,
      verificationToken,
    );

    return {
      message:
        'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isEmailVerified: false,
        fullName: candidate.fullName,
        phone: candidate.phone,
        provinceId: candidate.provinceId,
      },
    };
  }

  async registerEmployer(dto: RegisterEmployerDto) {
    const { email, password } = dto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const verificationToken = generateVerificationToken();

    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.EMPLOYER,
      emailVerificationToken: verificationToken,
      isEmailVerified: false,
    });
    const savedUser = await this.userRepository.save(user);

    void this.mailService.sendVerificationEmail(
      email,
      email,
      verificationToken,
    );

    return {
      message:
        'Tài khoản Employer được tạo thành công. Vui lòng kiểm tra email để xác thực tài khoản.',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        isEmailVerified: false,
      },
    };
  }
}
