import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RoleEnum } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmailOrGsm(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { gsmNumber: identifier }
        ]
      }
    });
  }

  async create(data: any) {
    return this.prisma.user.create({ data });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async update(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }

  // ===== ADMIN METHODS =====

  async findAll(role?: RoleEnum) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      select: {
        id: true,
        role: true,
        email: true,
        gsmNumber: true,
        firstName: true,
        lastName: true,
        expertiseTags: true,
        region: true,
        isLocked: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaffAccount(dto: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: RoleEnum;
    expertiseTags?: string[];
    region?: string;
  }) {
    // Validate password policy: min 8 chars, 1 uppercase, 1 digit, 1 special
    const pwdRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!pwdRegex.test(dto.password)) {
      throw new BadRequestException(
        'Şifre politikası ihlali: minimum 8 karakter, en az 1 büyük harf, 1 rakam ve 1 özel karakter (@#$! vb.) gereklidir.'
      );
    }

    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Bu e-posta adresi (${dto.email}) zaten kayıtlıdır.`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        role: dto.role,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        expertiseTags: dto.expertiseTags ?? [],
        region: dto.region,
      },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        expertiseTags: true,
        region: true,
        createdAt: true,
      },
    });
  }

  async updateRole(id: string, role: RoleEnum) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Kullanıcı bulunamadı (ID: ${id})`);

    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, role: true, email: true, firstName: true, lastName: true },
    });
  }

  async unlockAccount(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Kullanıcı bulunamadı (ID: ${id})`);

    return this.prisma.user.update({
      where: { id },
      data: { isLocked: false, lockedUntil: null },
      select: { id: true, isLocked: true, firstName: true, lastName: true },
    });
  }

  async getAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Servis-içi (internal) uzman listesi — AI Service akıllı atama için kullanır.
   * Yalnızca hassas olmayan alanlar döner (şifre/token yok).
   */
  async findExpertsForAssignment() {
    const experts = await this.prisma.user.findMany({
      where: { role: RoleEnum.CAMPAIGN_EXPERT, isLocked: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        expertiseTags: true,
        region: true,
      },
    });
    return experts.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      expertise_tags: e.expertiseTags ?? [],
      region: e.region,
    }));
  }
}
