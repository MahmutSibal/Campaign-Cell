import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service.js';
import { BadgesService } from '../badges/badges.service.js';

describe('PointsService (Idempotency & Level Calculation)', () => {
  let service: PointsService;
  let prisma: PrismaService;

  const mockPrisma = {
    pointsTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    level: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1, name: 'Bronz', minPoints: 0, maxPoints: 499 },
        { id: 2, name: 'Gümüş', minPoints: 500, maxPoints: 1499 },
        { id: 3, name: 'Altın', minPoints: 1500, maxPoints: 2999 },
        { id: 4, name: 'Platin', minPoints: 3000, maxPoints: null },
      ]),
    },
  };

  const mockRabbitMQ = {
    publishEvent: jest.fn().mockResolvedValue(true),
  };

  const mockBadgesService = {
    evaluateBadges: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RabbitMQService, useValue: mockRabbitMQ },
        { provide: BadgesService, useValue: mockBadgesService },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate correct level based on total points (Case §6.3)', async () => {
    const lvl1 = await service.determineLevel(250);
    expect(lvl1.currentLevel).toBe('Bronz');
    expect(lvl1.nextLevel).toBe('Gümüş');

    const lvl2 = await service.determineLevel(750);
    expect(lvl2.currentLevel).toBe('Gümüş');
    expect(lvl2.nextLevel).toBe('Altın');

    const lvl3 = await service.determineLevel(3500);
    expect(lvl3.currentLevel).toBe('Platin');
    expect(lvl3.nextLevel).toBeNull();
  });

  it('should prevent duplicate points when eventId is already processed (Idempotency)', async () => {
    const existingTx = {
      id: 'tx-123',
      expertId: 'expert-1',
      points: 10,
      reason: 'OPTIMIZATION_COMPLETED',
      eventId: 'evt-unique-101',
    };
    mockPrisma.pointsTransaction.findUnique.mockResolvedValue(existingTx);

    const result = await service.addPoints('expert-1', 10, 'OPTIMIZATION_COMPLETED', 'case-1', 'evt-unique-101');

    expect(result).toEqual(existingTx);
    expect(mockPrisma.pointsTransaction.create).not.toHaveBeenCalled();
  });

  it('should add points and publish points.awarded event when new event arrives', async () => {
    mockPrisma.pointsTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.pointsTransaction.create.mockResolvedValue({
      id: 'tx-new',
      expertId: 'expert-1',
      points: 10,
      reason: 'OPTIMIZATION_COMPLETED',
      eventId: 'evt-new-202',
    });
    mockPrisma.pointsTransaction.aggregate.mockResolvedValue({
      _sum: { points: 10 },
    });

    const result = await service.addPoints('expert-1', 10, 'OPTIMIZATION_COMPLETED', 'case-1', 'evt-new-202');

    expect(result).toBeDefined();
    expect(mockPrisma.pointsTransaction.create).toHaveBeenCalled();
    expect(mockRabbitMQ.publishEvent).toHaveBeenCalledWith('points.awarded', expect.objectContaining({
      expert_id: 'expert-1',
      points_added: 10,
      total_points: 10,
    }));
  });
});
