import { Test, TestingModule } from '@nestjs/testing';
import { CasesService } from './cases.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { CaseStatusEnum, CasePriorityEnum } from '@prisma/client';
import { BadRequestException, NotFoundException, UnprocessableEntityException, ForbiddenException } from '@nestjs/common';

describe('CasesService (State Machine & Rules)', () => {
  let service: CasesService;
  let prisma: PrismaService;
  let rabbitmq: RabbitMQService;

  const mockPrisma = {
    optimizationCase: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    campaignAssignment: {
      create: jest.fn(),
    },
    campaignHistory: {
      create: jest.fn(),
    },
    campaign: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockRabbitMQ = {
    publishEvent: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQService, useValue: mockRabbitMQ },
      ],
    }).compile();

    service = module.get<CasesService>(CasesService);
    prisma = module.get<PrismaService>(PrismaService);
    rabbitmq = module.get<RabbitMQService>(RabbitMQService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('State Machine Transitions', () => {
    it('should throw UnprocessableEntityException (422) if transition is invalid (e.g. YENI -> TAMAMLANDI)', async () => {
      mockPrisma.optimizationCase.findUnique.mockResolvedValue({
        id: 'case-1',
        caseCode: 'CMP-2026-000001',
        status: CaseStatusEnum.YENI,
        priority: CasePriorityEnum.ORTA,
        campaignId: 'camp-1',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 86400000),
        slaBreached: false,
      });

      await expect(
        service.updateStatus('case-1', { status: CaseStatusEnum.TAMAMLANDI, note: 'Tamamlandı' }, 'user-1', 'ADMIN'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw BadRequestException if TAMAMLANDI transition has no optimization note', async () => {
      mockPrisma.optimizationCase.findUnique.mockResolvedValue({
        id: 'case-1',
        caseCode: 'CMP-2026-000001',
        status: CaseStatusEnum.OPTIMIZE_EDILIYOR,
        priority: CasePriorityEnum.ORTA,
        campaignId: 'camp-1',
        optimizationNote: null,
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 86400000),
        slaBreached: false,
      });

      await expect(
        service.updateStatus('case-1', { status: CaseStatusEnum.TAMAMLANDI, note: '' }, 'user-1', 'CAMPAIGN_EXPERT'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully transition OPTIMIZE_EDILIYOR -> TAMAMLANDI when note is provided', async () => {
      const mockCase = {
        id: 'case-1',
        caseCode: 'CMP-2026-000001',
        status: CaseStatusEnum.OPTIMIZE_EDILIYOR,
        priority: CasePriorityEnum.ORTA,
        campaignId: 'camp-1',
        assignedExpertId: 'expert-1',
        segment: 'YUKSEK_DEGER',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 86400000),
        slaBreached: false,
      };

      mockPrisma.optimizationCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.optimizationCase.update.mockResolvedValue({
        ...mockCase,
        status: CaseStatusEnum.TAMAMLANDI,
        optimizationNote: 'Detaylı indirim optimizasyonu tamamlandı.',
      });

      const result = await service.updateStatus(
        'case-1',
        { status: CaseStatusEnum.TAMAMLANDI, note: 'Detaylı indirim optimizasyonu tamamlandı.', conversionLift: 0.20 },
        'user-1',
        'CAMPAIGN_EXPERT',
      );

      expect(result.status).toBe(CaseStatusEnum.TAMAMLANDI);
      expect(mockRabbitMQ.publishEvent).toHaveBeenCalledWith('campaign.optimized', expect.anything());
    });

    it('should throw ForbiddenException (403) if a CAMPAIGN_EXPERT tries TAMAMLANDI -> YAYINDA (manager-only)', async () => {
      mockPrisma.optimizationCase.findUnique.mockResolvedValue({
        id: 'case-1',
        caseCode: 'CMP-2026-000001',
        status: CaseStatusEnum.TAMAMLANDI,
        priority: CasePriorityEnum.ORTA,
        campaignId: 'camp-1',
        optimizationNote: 'ok',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 86400000),
        slaBreached: false,
      });

      await expect(
        service.updateStatus('case-1', { status: CaseStatusEnum.YAYINDA }, 'user-1', 'CAMPAIGN_EXPERT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set isAiMisclassified=true and emit segment.changed event when segment is overridden', async () => {
      const mockCase = {
        id: 'case-1',
        caseCode: 'CMP-2026-000001',
        segment: 'BELIRSIZ',
        status: CaseStatusEnum.ATANDI,
        priority: CasePriorityEnum.ORTA,
        campaignId: 'camp-1',
        createdAt: new Date(),
        slaDeadline: new Date(Date.now() + 86400000),
        slaBreached: false,
      };

      mockPrisma.optimizationCase.findUnique.mockResolvedValue(mockCase);
      mockPrisma.optimizationCase.update.mockResolvedValue({
        ...mockCase,
        segment: 'RISKLI_KAYIP',
        isAiMisclassified: true,
      });

      const result = await service.overrideSegment(
        'case-1',
        { segment: 'RISKLI_KAYIP', reason: 'Müşteri taahhüt iptal araması yaptı' },
        'user-1',
      );

      expect(result.isAiMisclassified).toBe(true);
      expect(mockRabbitMQ.publishEvent).toHaveBeenCalledWith('segment.changed', expect.objectContaining({
        original_segment: 'BELIRSIZ',
        corrected_segment: 'RISKLI_KAYIP',
        is_ai_misclassified: true,
      }));
    });
  });
});
