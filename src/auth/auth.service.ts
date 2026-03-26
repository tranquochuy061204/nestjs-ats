import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { RegisterEmployerDto } from './dto/register-employer.dto';
import { CandidateEntity } from '../candidates/entities/candidate.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CandidateEntity)
    private readonly candidateRepository: Repository<CandidateEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName, phone, provinceId } =
      registerDto;

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    // Tạo user mới - role mặc định là candidate
    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.CANDIDATE,
    });
    const savedUser = await this.userRepository.save(user);

    const candidate = this.candidateRepository.create({
      userId: savedUser.id,
      fullName: `${lastName} ${firstName}`,
      phone,
      provinceId,
    });
    await this.candidateRepository.save(candidate);

    return {
      message: 'User registered successfully',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
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

    const user = this.userRepository.create({
      email,
      password,
      role: UserRole.EMPLOYER,
    });
    const savedUser = await this.userRepository.save(user);

    return {
      message: 'Tài khoản Employer được tạo thành công',
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
      },
    };
  }

  async validateUser({ email, password }: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['candidate'],
    });
    if (!user) {
      return null;
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }
    return user;
  }

  login(user: UserEntity) {
    const token = this.jwtService.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      ...(user.candidate ? { candidateId: user.candidate.id } : {}),
    });
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
