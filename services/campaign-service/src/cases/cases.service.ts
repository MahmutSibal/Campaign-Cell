import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { AssignExpertDto } from './dto/assign-expert.dto.js';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto.js';
import { OverrideSegmentDto } from './dto/override-segment.dto.js';
import { QueryCaseDto } from './dto/query-case.dto.js';
import { CaseStatusEnum, CampaignStatusEnum, CasePriorityEnum } from '@prisma/client';

const SLA_HOURS: Record<string, number> = { KRITIK: 2, YUKSEK: 8, ORTA: 24, DUSUK: 72 };
const PRIORITY_ORDER: Record<string, number> = { DUSUK: 1, ORTA: 2, YUKSEK: 3, KRITIK: 4 };

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  // State Machine Geçiş Matrisi
  private readonly validTransitions: Record<CaseStatusEnum, CaseStatusEnum[]> = {
    [CaseStatusEnum.YENI]: [CaseStatusEnum.ATANDI, CaseStatusEnum.ARSIVLENDI],
    [CaseStatusEnum.ATANDI]: [CaseStatusEnum.OPTIMIZE_EDILIYOR, CaseStatusEnum.ARSIVLENDI],
    [CaseStatusEnum.OPTIMIZE_EDILIYOR]: [CaseStatusEnum.TEST_EDILIYOR, CaseStatusEnum.TAMAMLANDI, CaseStatusEnum.ARSIVLENDI],
    [CaseStatusEnum.TEST_EDILIYOR]: [CaseStatusEnum.TAMAMLANDI, CaseStatusEnum.OPTIMIZE_EDILIYOR, CaseStatusEnum.ARSIVLENDI],
    [CaseStatusEnum.TAMAMLANDI]: [CaseStatusEnum.YAYINDA, CaseStatusEnum.ARSIVLENDI],
    [CaseStatusEnum.YAYINDA]: [CaseStatusEnum.ARSIVLENDI],
    [CaseStatusEnum.ARSIVLENDI]: [],
  };

  // Case §4.2 "Kim Yapabilir" matrisi — geçiş bazlı rol yetkisi
  private readonly transitionRoles: Record<string, string[]> = {
    'YENI->ATANDI': ['SUPERVISOR', 'ADMIN'], // Sistem(AI) veya Yönetici
    'ATANDI->OPTIMIZE_EDILIYOR': ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'],
    'OPTIMIZE_EDILIYOR->TEST_EDILIYOR': ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'],
    'TEST_EDILIYOR->OPTIMIZE_EDILIYOR': ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'], // A/B testi sonucu
    'OPTIMIZE_EDILIYOR->TAMAMLANDI': ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'],
    'TEST_EDILIYOR->TAMAMLANDI': ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'],
    'TAMAMLANDI->YAYINDA': ['SUPERVISOR', 'ADMIN'], // Yönetici onayı
  };

  /**
   * Kalan SLA bilgisini hesaplar (Case §4.4 — uzman ve yönetici ekranında görünür).
   */
  private withSla<T extends { slaDeadline: Date; slaBreached: boolean; completedAt?: Date | null; priority: string }>(c: T) {
    const now = Date.now();
    const deadline = new Date(c.slaDeadline).getTime();
    const remainingMs = c.completedAt ? 0 : deadline - now;
    const remainingHours = Math.round((remainingMs / 3600000) * 10) / 10;
    let slaStatus: 'OK' | 'WARNING' | 'BREACHED' | 'COMPLETED';
    if (c.completedAt) slaStatus = 'COMPLETED';
    else if (remainingMs <= 0 || c.slaBreached) slaStatus = 'BREACHED';
    else {
      const totalMs = (SLA_HOURS[c.priority] ?? 24) * 3600000;
      slaStatus = remainingMs <= totalMs * 0.2 ? 'WARNING' : 'OK';
    }
    return { ...c, slaRemainingMs: Math.max(0, remainingMs), slaRemainingHours: Math.max(0, remainingHours), slaStatus };
  }

  /**
   * Segmente göre öncelik türetir (Case §4.3): RISKLI_KAYIP/YUKSEK_DEGER minimum YUKSEK, BELIRSIZ → ORTA.
   */
  private derivePriority(segment: string, current?: string): CasePriorityEnum {
    if (segment === 'BELIRSIZ') return CasePriorityEnum.ORTA;
    let p: CasePriorityEnum =
      current && (CasePriorityEnum as any)[current] ? (current as CasePriorityEnum) : CasePriorityEnum.ORTA;
    if ((segment === 'RISKLI_KAYIP' || segment === 'YUKSEK_DEGER') && PRIORITY_ORDER[p] < PRIORITY_ORDER.YUKSEK) {
      p = CasePriorityEnum.YUKSEK;
    }
    return p;
  }

  async findAll(query: QueryCaseDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assignedExpertId) where.assignedExpertId = query.assignedExpertId;
    if (query.slaBreached !== undefined) where.slaBreached = query.slaBreached;

    const [items, total] = await Promise.all([
      this.prisma.optimizationCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: {
            select: { id: true, code: true, name: true, type: true, status: true },
          },
          histories: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      this.prisma.optimizationCase.count({ where }),
    ]);

    return {
      items: items.map((c) => this.withSla(c as any)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const optCase = await this.prisma.optimizationCase.findUnique({
      where: { id },
      include: {
        campaign: true,
        assignments: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
        abTests: { orderBy: { startedAt: 'desc' } },
      },
    });

    if (!optCase) {
      throw new NotFoundException(`Optimizasyon vakası bulunamadı (ID: ${id})`);
    }

    return this.withSla(optCase as any);
  }

  async assignExpert(caseId: string, dto: AssignExpertDto, userId: string) {
    const optCase = await this.findOne(caseId);

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Atama kaydı
      await tx.campaignAssignment.create({
        data: {
          caseId,
          expertId: dto.expertId,
          assignedBy: dto.assignedBy,
          assignmentScore: dto.assignmentScore || 0.85,
        },
      });

      // 2. Vaka güncelleme (Yeni ise ATANDI statüsüne geçir)
      const nextStatus = optCase.status === CaseStatusEnum.YENI ? CaseStatusEnum.ATANDI : optCase.status;

      const updatedCase = await tx.optimizationCase.update({
        where: { id: caseId },
        data: {
          assignedExpertId: dto.expertId,
          assignedAt: now,
          status: nextStatus,
        },
      });

      // 3. Geçmiş kaydı
      if (optCase.status !== nextStatus) {
        await tx.campaignHistory.create({
          data: {
            caseId,
            fromStatus: optCase.status,
            toStatus: nextStatus,
            changedBy: userId,
            note: `Uzman ataması yapıldı (${dto.assignedBy}): ${dto.expertId}`,
          },
        });
      }

      return updatedCase;
    });

    // 4. RabbitMQ Event
    await this.rabbitmq.publishEvent('campaign.assigned', {
      case_id: optCase.id,
      case_code: optCase.caseCode,
      campaign_id: optCase.campaignId,
      expert_id: dto.expertId,
      assigned_by: dto.assignedBy,
      assigned_at: now.toISOString(),
    });

    return updated;
  }

  async updateStatus(caseId: string, dto: UpdateCaseStatusDto, userId: string, role: string) {
    const optCase = await this.findOne(caseId);
    const currentStatus = optCase.status;
    const targetStatus = dto.status;

    if (currentStatus === targetStatus) {
      return optCase;
    }

    // State Machine Geçiş Doğrulaması (kural dışı → HTTP 422)
    const allowed = this.validTransitions[currentStatus as CaseStatusEnum] || [];
    if (!allowed.includes(targetStatus)) {
      throw new UnprocessableEntityException(
        `Geçersiz durum geçişi (HTTP 422): '${currentStatus}' durumundan '${targetStatus}' durumuna geçilemez. (İzin verilenler: ${allowed.join(', ') || 'Yok'})`,
      );
    }

    // Case §4.2 "Kim Yapabilir" — geçiş bazlı rol kontrolü (yetkisiz → 403)
    const key = `${currentStatus}->${targetStatus}`;
    const allowedRoles =
      targetStatus === CaseStatusEnum.ARSIVLENDI ? ['SUPERVISOR', 'ADMIN'] : this.transitionRoles[key];
    if (allowedRoles && !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Bu durum geçişini ('${key}') gerçekleştirme yetkiniz yok. İzinli roller: ${allowedRoles.join(', ')}.`,
      );
    }

    // İş Kuralları Doğrulamaları
    if (targetStatus === CaseStatusEnum.TAMAMLANDI) {
      const note = dto.note || optCase.optimizationNote;
      if (!note || note.trim().length === 0) {
        throw new BadRequestException("Vaka 'TAMAMLANDI' durumuna geçirilirken optimizasyon notu (optimizationNote) girilmesi zorunludur.");
      }
    }

    const now = new Date();
    const updateData: any = {
      status: targetStatus,
    };

    if (dto.note) {
      updateData.optimizationNote = dto.note;
    }
    if (dto.conversionLift !== undefined) {
      updateData.conversionLift = dto.conversionLift;
    }
    if (targetStatus === CaseStatusEnum.TAMAMLANDI) {
      updateData.completedAt = now;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.optimizationCase.update({
        where: { id: caseId },
        data: updateData,
      });

      // Geçmiş kaydı
      await tx.campaignHistory.create({
        data: {
          caseId,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          changedBy: userId,
          note: dto.note || `Durum '${currentStatus}' -> '${targetStatus}' olarak değiştirildi.`,
        },
      });

      // Eğer YAYINDA statüsüne geçtiyse bağlı kampanyayı ACTIVE yap
      if (targetStatus === CaseStatusEnum.YAYINDA) {
        await tx.campaign.update({
          where: { id: optCase.campaignId },
          data: { status: CampaignStatusEnum.ACTIVE },
        });
      }

      return result;
    });

    // RabbitMQ Events
    if (targetStatus === CaseStatusEnum.TAMAMLANDI) {
      const slaMet = !optCase.slaBreached && now <= optCase.slaDeadline;
      await this.rabbitmq.publishEvent('campaign.optimized', {
        case_id: optCase.id,
        case_code: optCase.caseCode,
        campaign_id: optCase.campaignId,
        expert_id: optCase.assignedExpertId,
        segment: optCase.segment,
        priority: optCase.priority,
        conversion_lift: dto.conversionLift || 0.15,
        created_at: optCase.createdAt.toISOString(),
        completed_at: now.toISOString(),
        sla_met: slaMet,
      });
    } else if (targetStatus === CaseStatusEnum.YAYINDA) {
      await this.rabbitmq.publishEvent('campaign.published', {
        case_id: optCase.id,
        campaign_id: optCase.campaignId,
        published_at: now.toISOString(),
      });
    }

    return updated;
  }

  async overrideSegment(caseId: string, dto: OverrideSegmentDto, userId: string) {
    const optCase = await this.findOne(caseId);
    const originalSegment = optCase.segment;
    const originalPriority = optCase.priority;

    const VALID_SEGMENTS = ['YUKSEK_DEGER', 'RISKLI_KAYIP', 'YENI_ABONE', 'PASIF', 'BELIRSIZ'];
    if (!VALID_SEGMENTS.includes(dto.segment)) {
      throw new BadRequestException(`Geçersiz segment. İzinli değerler: ${VALID_SEGMENTS.join(', ')}`);
    }

    if (originalSegment === dto.segment) {
      return optCase;
    }

    // Yeni segmente göre öncelik yeniden hesaplanır (RISKLI_KAYIP min YUKSEK).
    const newPriority = this.derivePriority(dto.segment, originalPriority);
    // SLA vaka oluşturma anından sayılır (Case §4.4) → deadline = createdAt + yeni öncelik süresi.
    const newDeadline = new Date(
      new Date(optCase.createdAt).getTime() + (SLA_HOURS[newPriority] ?? 24) * 3600000,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.optimizationCase.update({
        where: { id: caseId },
        data: {
          segment: dto.segment,
          priority: newPriority,
          slaDeadline: newDeadline,
          slaBreached: newDeadline.getTime() <= Date.now(),
          isAiMisclassified: true,
        },
      });

      // Case §4.3: kampanya hedef segmentini de senkronize et
      await tx.campaign.update({
        where: { id: optCase.campaignId },
        data: { targetSegment: dto.segment as any },
      });

      await tx.campaignHistory.create({
        data: {
          caseId,
          fromStatus: optCase.status,
          toStatus: optCase.status,
          changedBy: userId,
          note: `Segment manuel değiştirildi: '${originalSegment}' -> '${dto.segment}' (öncelik: ${originalPriority} -> ${newPriority}). Neden: ${dto.reason}`,
        },
      });

      return result;
    });

    // AI Service için segment.changed event'i (doğruluk metriği için)
    await this.rabbitmq.publishEvent('segment.changed', {
      case_id: optCase.id,
      campaign_id: optCase.campaignId,
      original_segment: originalSegment,
      corrected_segment: dto.segment,
      corrected_priority: newPriority,
      corrected_by: userId,
      reason: dto.reason,
      is_ai_misclassified: true,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }
}
