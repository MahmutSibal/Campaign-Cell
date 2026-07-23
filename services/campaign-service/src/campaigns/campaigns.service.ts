import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { CreateCampaignDto } from './dto/create-campaign.dto.js';
import { UpdateCampaignDto } from './dto/update-campaign.dto.js';
import { QueryCampaignDto } from './dto/query-campaign.dto.js';
import { CampaignStatusEnum, TargetSegmentEnum, CasePriorityEnum, CaseStatusEnum, AssignedByEnum } from '@prisma/client';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIORITY_ORDER: Record<string, number> = { DUSUK: 1, ORTA: 2, YUKSEK: 3, KRITIK: 4 };

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
  ) {}

  private async generateUniqueCode(): Promise<string> {
    const year = new Date().getFullYear();
    // Case §4.1: benzersiz + okunabilir sıralı format (örn: CMP-2026-000123)
    for (let i = 0; i < 15; i++) {
      const count = await this.prisma.campaign.count();
      const seq = (count + 101 + i).toString().padStart(6, '0');
      const code = `CMP-${year}-${seq}`;
      const existing = await this.prisma.campaign.findUnique({ where: { code } });
      if (!existing) return code;
    }
    return `CMP-${year}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Segment → temsili abone profili (AI'ın kampanya-bağlamlı skorlaması için ipucu).
   */
  private buildProfileHint(segment?: string): Record<string, number> | undefined {
    switch (segment) {
      case 'RISKLI_KAYIP':
        return { monthly_data_usage_gb: 2, monthly_voice_min: 90, monthly_spend_try: 80,
          tenure_months: 30, past_accepted_count: 0, past_rejected_count: 3, complaint_count: 4, data_usage_trend_pct: -40 };
      case 'YUKSEK_DEGER':
        return { monthly_data_usage_gb: 45, monthly_voice_min: 1500, monthly_spend_try: 600,
          tenure_months: 48, past_accepted_count: 5, past_rejected_count: 0, complaint_count: 0, data_usage_trend_pct: 20 };
      case 'YENI_ABONE':
        return { monthly_data_usage_gb: 12, monthly_voice_min: 400, monthly_spend_try: 200,
          tenure_months: 2, past_accepted_count: 0, past_rejected_count: 0, complaint_count: 0, data_usage_trend_pct: 5 };
      case 'PASIF':
        return { monthly_data_usage_gb: 3, monthly_voice_min: 150, monthly_spend_try: 90,
          tenure_months: 20, past_accepted_count: 1, past_rejected_count: 2, complaint_count: 1, data_usage_trend_pct: -12 };
      default:
        return undefined;
    }
  }

  /**
   * Case §5.3: Uzmanların GERÇEK iş yükü ve performansını (ortalama conversion_lift) kendi DB'mizden
   * hesaplar ve AI'a taşır (database-per-service korunur — AI Campaign DB'ye erişmez).
   *  - active_workload : ATANDI/OPTIMIZE_EDILIYOR/TEST_EDILIYOR durumdaki aktif vaka sayısı
   *  - performance_rating : tamamlanmış vakaların ortalama conversionLift değeri
   */
  private async computeExpertStats(): Promise<
    Array<{ expert_id: string; active_workload: number; performance_rating: number | null }>
  > {
    const activeStatuses: CaseStatusEnum[] = [
      CaseStatusEnum.ATANDI,
      CaseStatusEnum.OPTIMIZE_EDILIYOR,
      CaseStatusEnum.TEST_EDILIYOR,
    ];

    const [workloadGroups, perfGroups] = await Promise.all([
      this.prisma.optimizationCase.groupBy({
        by: ['assignedExpertId'],
        where: { assignedExpertId: { not: null }, status: { in: activeStatuses } },
        _count: { _all: true },
      }),
      this.prisma.optimizationCase.groupBy({
        by: ['assignedExpertId'],
        where: { assignedExpertId: { not: null }, completedAt: { not: null } },
        _avg: { conversionLift: true },
      }),
    ]);

    const workloadMap = new Map<string, number>();
    for (const g of workloadGroups) {
      if (g.assignedExpertId) workloadMap.set(g.assignedExpertId, g._count._all);
    }
    const perfMap = new Map<string, number | null>();
    for (const g of perfGroups) {
      if (g.assignedExpertId) {
        const avg = (g as any)._avg?.conversionLift;
        perfMap.set(g.assignedExpertId, avg != null ? Number(avg) : null);
      }
    }

    const expertIds = new Set<string>([...workloadMap.keys(), ...perfMap.keys()]);
    return [...expertIds].map((id) => ({
      expert_id: id,
      active_workload: workloadMap.get(id) ?? 0,
      performance_rating: perfMap.get(id) ?? null,
    }));
  }

  /**
   * AI Service'e SENKRON öneri çağrısı (Case §4.1). 5 sn timeout.
   * Erişilemezse null döner → çağıran taraf degradation moduna geçer.
   */
  private async requestAiPrediction(input: {
    code: string;
    type: string;
    requestedSegment?: string;
    subscriberId?: string;
    profileOverride?: Record<string, number>;
    expertStats?: Array<{ expert_id: string; active_workload: number; performance_rating: number | null }>;
  }): Promise<any | null> {
    const base = process.env.AI_SERVICE_URL || 'http://ai-service:8000';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${base}/api/v1/ai/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriber_id: input.subscriberId || `campaign-preview-${input.code}`,
          campaign_type: input.type,
          profile_override: input.profileOverride ?? this.buildProfileHint(input.requestedSegment),
          expert_stats: input.expertStats,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`AI Service HTTP ${res.status} döndü — degradation moduna geçiliyor.`);
        return null;
      }
      return await res.json();
    } catch (e) {
      this.logger.warn(`AI Service erişilemedi (degradation): ${(e as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Öncelik türetme (Case §4.3): RISKLI_KAYIP minimum YUKSEK; BELIRSIZ → ORTA.
   */
  private derivePriority(segment: TargetSegmentEnum, aiPriority?: string): CasePriorityEnum {
    if (segment === TargetSegmentEnum.BELIRSIZ) return CasePriorityEnum.ORTA;

    let p: CasePriorityEnum =
      aiPriority && (CasePriorityEnum as any)[aiPriority]
        ? (aiPriority as CasePriorityEnum)
        : CasePriorityEnum.ORTA;

    // RISKLI_KAYIP churn riski → minimum YUKSEK
    if (segment === TargetSegmentEnum.RISKLI_KAYIP && PRIORITY_ORDER[p] < PRIORITY_ORDER.YUKSEK) {
      p = CasePriorityEnum.YUKSEK;
    }
    if (segment === TargetSegmentEnum.YUKSEK_DEGER && PRIORITY_ORDER[p] < PRIORITY_ORDER.YUKSEK) {
      p = CasePriorityEnum.YUKSEK;
    }
    return p;
  }

  private calculateSlaDeadline(priority: CasePriorityEnum): Date {
    const now = new Date();
    let hoursToAdd = 24; // ORTA varsayılan (Case §4.4)
    if (priority === CasePriorityEnum.KRITIK) hoursToAdd = 2;
    else if (priority === CasePriorityEnum.YUKSEK) hoursToAdd = 8;
    else if (priority === CasePriorityEnum.ORTA) hoursToAdd = 24;
    else if (priority === CasePriorityEnum.DUSUK) hoursToAdd = 72;

    return new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
  }

  async create(dto: CreateCampaignDto, userId: string) {
    const code = await this.generateUniqueCode();

    // Case §4.1: Kampanya segmente hedeflendiğinde AI Service'e SENKRON gönderilir.
    // Case §5.3: uzmanların gerçek iş yükü/performansı da AI'a taşınır (akıllı atama için).
    const expertStats = await this.computeExpertStats();
    const ai = await this.requestAiPrediction({
      code,
      type: dto.type,
      requestedSegment: dto.targetSegment,
      expertStats,
    });
    const aiAvailable = !!ai;

    let targetSegment: TargetSegmentEnum;
    let priority: CasePriorityEnum;
    let status: CampaignStatusEnum;
    let aiScore: number;
    let aiConversionProb: number;
    let aiReasoning: string;
    let recommendedExpertId: string | null = null;
    let assignmentScore: number | null = null;

    if (!aiAvailable) {
      // Case §2.2 & §4.1 BAĞIMSIZLIK: AI erişilemez → her durumda BELIRSIZ + ORTA + manuel kuyruk.
      targetSegment = TargetSegmentEnum.BELIRSIZ;
      priority = CasePriorityEnum.ORTA;
      status = CampaignStatusEnum.MANUAL_OPTIMIZATION_REQUIRED;
      aiScore = 0;
      aiConversionProb = 0;
      aiReasoning =
        'AI Service erişilemedi. Vaka BELIRSIZ olarak işaretlendi ve ORTA öncelikle manuel optimizasyon kuyruğuna alındı (servis bağımsızlığı).';
    } else {
      // Kullanıcı segment verdiyse onu koru, yoksa AI'ın atadığı segmenti kullan.
      targetSegment =
        (dto.targetSegment as TargetSegmentEnum) ||
        (ai.predicted_segment as TargetSegmentEnum) ||
        TargetSegmentEnum.BELIRSIZ;
      priority = this.derivePriority(targetSegment, ai.predicted_priority);
      status =
        targetSegment === TargetSegmentEnum.BELIRSIZ
          ? CampaignStatusEnum.MANUAL_OPTIMIZATION_REQUIRED
          : CampaignStatusEnum.ACTIVE;
      aiScore = typeof ai.recommendation_score === 'number' ? ai.recommendation_score : 0.5;
      aiConversionProb = typeof ai.conversion_probability === 'number' ? ai.conversion_probability : 0.4;
      aiReasoning = ai.reasoning || 'AI analizi tamamlandı.';
      if (ai.recommended_expert?.expert_id && UUID_RE.test(ai.recommended_expert.expert_id)) {
        recommendedExpertId = ai.recommended_expert.expert_id;
        assignmentScore =
          typeof ai.recommended_expert.assignment_score === 'number'
            ? ai.recommended_expert.assignment_score
            : 0.8;
      }
    }

    // Akıllı otomatik atama: AI bir uzman önerdiyse ve segment belirliyse → ATANDI
    const autoAssign = !!recommendedExpertId && targetSegment !== TargetSegmentEnum.BELIRSIZ;
    const caseStatus = autoAssign ? CaseStatusEnum.ATANDI : CaseStatusEnum.YENI;

    const { campaign, optCase } = await this.prisma.$transaction(async (tx) => {
      const createdCampaign = await tx.campaign.create({
        data: {
          code,
          name: dto.name,
          description: dto.description,
          type: dto.type,
          discountPercent: dto.discountPercent,
          targetSegment,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          status,
          aiRecommendationScore: aiScore,
          aiConversionProbability: aiConversionProb,
          createdBy: userId,
        },
      });

      // SLA vaka oluşturma anından itibaren sayılır (Case §4.4)
      const slaDeadline = this.calculateSlaDeadline(priority);
      const created = await tx.optimizationCase.create({
        data: {
          caseCode: code,
          campaignId: createdCampaign.id,
          segment: targetSegment,
          priority,
          status: caseStatus,
          assignedExpertId: autoAssign ? recommendedExpertId : null,
          assignedAt: autoAssign ? new Date() : null,
          aiScore,
          aiConversionProb,
          aiReasoning,
          slaDeadline,
        },
      });

      if (autoAssign) {
        await tx.campaignAssignment.create({
          data: {
            caseId: created.id,
            expertId: recommendedExpertId as string,
            assignedBy: AssignedByEnum.AI,
            assignmentScore: assignmentScore ?? 0.8,
          },
        });
      }

      await tx.campaignHistory.create({
        data: {
          caseId: created.id,
          fromStatus: null,
          toStatus: caseStatus,
          changedBy: userId,
          note: autoAssign
            ? `Kampanya oluşturuldu; AI vakayı ${recommendedExpertId} uzmanına otomatik atadı.`
            : 'Kampanya oluşturuldu ve ilk vaka açıldı.',
        },
      });

      return { campaign: createdCampaign, optCase: created };
    });

    // Case §9: campaign.created event'i (case_id dahil)
    await this.rabbitmq.publishEvent('campaign.created', {
      campaign_id: campaign.id,
      case_id: optCase.id,
      code: campaign.code,
      name: campaign.name,
      type: campaign.type,
      target_segment: campaign.targetSegment,
      priority,
      status: campaign.status,
      ai_available: aiAvailable,
      created_by: userId,
      created_at: campaign.createdAt,
    });

    if (autoAssign) {
      await this.rabbitmq.publishEvent('campaign.assigned', {
        case_id: optCase.id,
        case_code: optCase.caseCode,
        campaign_id: campaign.id,
        expert_id: recommendedExpertId,
        assigned_by: AssignedByEnum.AI,
        assignment_score: assignmentScore,
        assigned_at: new Date().toISOString(),
      });
    }

    return { ...campaign, optimizationCaseId: optCase.id, aiAvailable };
  }

  /**
   * Case §8.2 & §5.1: Aboneye özel teklifler — GET /api/v1/subscribers/:id/offers.
   * Aktif kampanyalar, abonenin GERÇEK profiline göre AI ile skorlanır; skor >= 0.60 olanlar
   * gösterilir, > 0.80 olanlar öncelikli işaretlenir. AI erişilemezse degradation modunda
   * kampanyalar skorsuz döner (servis bağımsızlığı — Case §2.2).
   */
  async getOffersForSubscriber(subscriberId: string) {
    // Aktif kampanyaları çek (aboneye yayınlanabilir olanlar). Aşırı AI çağrısını önlemek için son 20.
    const campaigns = await this.prisma.campaign.findMany({
      where: { status: CampaignStatusEnum.ACTIVE },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const offers: any[] = [];
    let aiAvailable = true;

    for (const c of campaigns) {
      const ai = await this.requestAiPrediction({
        code: c.code,
        type: c.type,
        subscriberId, // abonenin GERÇEK profili AI DB'sinden okunur → kişiye özel skor
      });

      if (!ai) {
        aiAvailable = false;
        // Degradation: skorsuz temel teklif (bağımsızlık). Eşik filtrelenemediği için gösterilir.
        offers.push({
          campaignId: c.id,
          code: c.code,
          name: c.name,
          type: c.type,
          discountPercent: c.discountPercent,
          recommendationScore: null,
          conversionProbability: null,
          priorityDisplay: false,
          reasoning: 'AI Service erişilemedi — teklif skorsuz gösteriliyor (degradation).',
        });
        continue;
      }

      // Case §5.1: skor < 0.60 ise aboneye GÖSTERİLMEZ.
      if (!ai.show_to_subscriber) continue;

      offers.push({
        campaignId: c.id,
        code: c.code,
        name: c.name,
        type: c.type,
        discountPercent: c.discountPercent,
        recommendationScore: ai.recommendation_score,
        conversionProbability: ai.conversion_probability,
        predictedSegment: ai.predicted_segment,
        priorityDisplay: ai.priority_display, // skor > 0.80 → öncelikli
        reasoning: ai.reasoning,
      });
    }

    // Skor sırasına göre (öncelikliler üstte). Skorsuz (degradation) sona.
    offers.sort((a, b) => (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1));

    return {
      subscriberId,
      aiAvailable,
      total: offers.length,
      offers,
    };
  }

  /**
   * Abonenin GERÇEK teklif geçmişi (verdiği kabul/ret + puanlar). GET /subscribers/:id/history.
   */
  async getSubscriberHistory(subscriberId: string) {
    const feedbacks = await this.prisma.subscriberFeedback.findMany({
      where: { subscriberId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const campaignIds = [...new Set(feedbacks.map((f) => f.campaignId))];
    const campaigns = await this.prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: {
        id: true, code: true, name: true, type: true, description: true,
        discountPercent: true, aiRecommendationScore: true,
      },
    });
    const cMap = new Map(campaigns.map((c) => [c.id, c]));

    const items = feedbacks.map((f) => {
      const c = cMap.get(f.campaignId);
      return {
        id: f.id,
        campaignId: f.campaignId,
        code: c?.code ?? '-',
        name: c?.name ?? 'Kampanya',
        type: c?.type ?? '-',
        discountPercent: Number(c?.discountPercent ?? 0),
        aiScore: Number(c?.aiRecommendationScore ?? 0),
        status: f.response,
        userRating: f.rating ?? null,
        rejectionReason: f.rejectionReason ?? null,
        reasoning: c?.description ?? '',
        date: f.createdAt.toISOString(),
      };
    });

    return { subscriberId, total: items.length, items };
  }

  async findAll(query: QueryCampaignDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.type) where.type = query.type;
    if (query.targetSegment) where.targetSegment = query.targetSegment;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          optimizationCases: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        optimizationCases: {
          include: {
            assignments: true,
            histories: { orderBy: { createdAt: 'desc' } },
            abTests: true,
          },
        },
        subscriberFeedbacks: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Kampanya bulunamadı (ID: ${id})`);
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, userId: string) {
    await this.findOne(id);

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.discountPercent !== undefined) updateData.discountPercent = dto.discountPercent;
    if (dto.targetSegment !== undefined) updateData.targetSegment = dto.targetSegment;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.startDate !== undefined) updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) updateData.endDate = dto.endDate ? new Date(dto.endDate) : null;

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async remove(id: string, userId: string) {
    const campaign = await this.findOne(id);

    // Fiziksel silmek yerine statüsü ARSHIVED yaparız
    const archived = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatusEnum.ARCHIVED },
    });

    await this.rabbitmq.publishEvent('campaign.archived', {
      campaign_id: campaign.id,
      code: campaign.code,
      archived_by: userId,
      archived_at: new Date().toISOString(),
    });

    return archived;
  }
}
