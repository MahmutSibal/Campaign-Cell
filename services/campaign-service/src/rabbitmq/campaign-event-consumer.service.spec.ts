import { Test, TestingModule } from '@nestjs/testing';
import { CampaignEventConsumerService } from './campaign-event-consumer.service.js';
import { RabbitMQService } from './rabbitmq.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CampaignStatusEnum, CaseStatusEnum } from '@prisma/client';

describe('CampaignEventConsumerService (AI Events & Recovery)', () => {
  let service: CampaignEventConsumerService;
  let prisma: PrismaService;
  let rabbitmq: RabbitMQService;

  const mockPrisma = {
    campaign: {
      update: jest.fn(),
      findMany: jest.fn(),
    },
    optimizationCase: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    campaignAssignment: {
      create: jest.fn(),
    },
  };

  const mockRabbitMQ = {
    registerMessageHandler: jest.fn(),
    publishEvent: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignEventConsumerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQService, useValue: mockRabbitMQ },
      ],
    }).compile();

    service = module.get<CampaignEventConsumerService>(CampaignEventConsumerService);
    prisma = module.get<PrismaService>(PrismaService);
    rabbitmq = module.get<RabbitMQService>(RabbitMQService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle ai.prediction.created event and update campaign & case scores', async () => {
    mockPrisma.optimizationCase.findUnique.mockResolvedValue({
      id: 'case-101',
      campaignId: 'camp-101',
      assignedExpertId: null,
    });

    const payload = {
      campaign_id: 'camp-101',
      case_id: 'case-101',
      recommendation_score: 0.95,
      conversion_probability: 0.82,
      predicted_segment: 'YUKSEK_DEGER',
      reasoning: 'Yüksek veri harcaması tespiti.',
      recommended_expert_id: 'expert-uuid-99',
    };

    await service.handleIncomingEvent('ai.prediction.created', {
      event_id: 'evt-ai-1',
      payload,
    });

    expect(mockPrisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'camp-101' },
      data: expect.objectContaining({
        aiRecommendationScore: 0.95,
        aiConversionProbability: 0.82,
        status: CampaignStatusEnum.ACTIVE,
      }),
    });

    expect(mockPrisma.optimizationCase.update).toHaveBeenCalledWith({
      where: { id: 'case-101' },
      data: expect.objectContaining({
        aiScore: 0.95,
        assignedExpertId: 'expert-uuid-99',
        status: CaseStatusEnum.ATANDI,
      }),
    });
  });

  it('should handle ai.service.recovered event and re-trigger pending campaigns', async () => {
    const pendingCampaigns = [
      {
        id: 'camp-pending-1',
        code: 'CMP-2026-000999',
        name: 'Manuel Bekleyen Kampanya',
        type: 'EK_PAKET',
        targetSegment: 'BELIRSIZ',
        status: CampaignStatusEnum.MANUAL_OPTIMIZATION_REQUIRED,
        optimizationCases: [{ id: 'case-pending-1' }],
      },
    ];

    mockPrisma.campaign.findMany.mockResolvedValue(pendingCampaigns);

    await service.handleIncomingEvent('ai.service.recovered', {
      event_id: 'evt-recovery-1',
      payload: {},
    });

    expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith({
      where: { status: CampaignStatusEnum.MANUAL_OPTIMIZATION_REQUIRED },
      include: { optimizationCases: true },
    });

    expect(mockRabbitMQ.publishEvent).toHaveBeenCalledWith('campaign.created', expect.objectContaining({
      campaign_id: 'camp-pending-1',
      recovered_reanalysis: true,
    }));
  });
});
