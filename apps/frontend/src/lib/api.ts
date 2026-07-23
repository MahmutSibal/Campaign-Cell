/**
 * CampaignCell Unified API Client
 * Connects to API Gateway (default: http://localhost:8080)
 * Handles Identity, Campaign, AI, and Gamification Service endpoints
 */

const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';

export interface ApiUser {
  id: string;
  email: string;
  gsmNumber?: string;
  role: 'SUBSCRIBER' | 'CAMPAIGN_EXPERT' | 'SUPERVISOR';
  firstName: string;
  lastName: string;
  token?: string;
}

export interface ApiCampaign {
  id: string;
  code: string;
  name: string;
  type: string;
  discountPercent: number;
  targetSegment: string;
  status: string;
  aiRecommendationScore?: number;
  aiConversionProbability?: number;
}

export interface ApiCase {
  id: string;
  caseCode: string;
  campaignName: string;
  campaignType: string;
  segment: string;
  priority: 'DUSUK' | 'ORTA' | 'YUKSEK' | 'KRITIK';
  status: string;
  aiScore: number;
  assignedExpert: string;
  isAiMisclassified: boolean;
  optimizationNote?: string;
  slaDeadline: string;
  slaBreached: boolean;
  discountPercent: number;
}

export interface ApiLeaderboard {
  rank: number;
  expertId: string;
  name: string;
  level: string;
  points: number;
  badges: string[];
}

export interface ApiAiMetrics {
  accuracy: number;
  totalPredictions: number;
  misclassifications: number;
  f1Score: number;
  categories: {
    name: string;
    accuracy: number;
    correct: number;
    total: number;
  }[];
}

class CampaignCellApiClient {
  private gatewayUrl: string;
  private token: string | null = null;

  constructor() {
    this.gatewayUrl = API_GATEWAY_URL;
  }

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // ===== IDENTITY SERVICE =====
  async login(identifier: string, passOrOtp: string, role: string) {
    const res = await fetch(`${this.gatewayUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ identifier, password: passOrOtp, role }),
    });
    if (!res.ok) {
      // Sahte token fallback KALDIRILDI — gerçek kimlik doğrulama başarısızsa hata yükselir.
      throw new Error('Giriş başarısız');
    }
    const data = await res.json();
    const tok = data.access_token || data.accessToken;
    if (tok) this.setToken(tok);
    return data;
  }

  // ===== CAMPAIGN SERVICE =====
  async getCampaigns(): Promise<ApiCampaign[]> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/campaigns?limit=20`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.items || [];
      }
    } catch {
      // Fallback
    }
    return [];
  }

  async getCases(): Promise<ApiCase[]> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/cases?limit=50`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.items || [];
      }
    } catch {
      // Servis erişilemez → sahte veri YOK, boş liste (UI empty state gösterir).
    }
    return [];
  }

  async createCampaign(data: { name: string; type: string; segment: string; discountPercent: number }) {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/campaigns`, {
        method: 'POST',
        headers: this.getHeaders(),
        // Backend DTO alanı `targetSegment` (segment değil) — doğru alan adıyla gönderilir.
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          targetSegment: data.segment,
          discountPercent: data.discountPercent,
        }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Sahte başarı yanıtı YOK.
    }
    return { success: false, error: 'Kampanya oluşturulamadı (servis erişilemez).' };
  }

  // Case §8.2: Aboneye özel, AI ile skorlanmış kişisel teklifler (skor >= 0.60).
  async getSubscriberOffers(subscriberId: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/subscribers/${subscriberId}/offers`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.offers) ? data.offers : [];
      }
    } catch {
      // Servis erişilemez → boş.
    }
    return [];
  }

  // Abonenin gerçek teklif geçmişi (kabul/ret + puanlar).
  async getSubscriberHistory(subscriberId: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/subscribers/${subscriberId}/history`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data?.items) ? data.items : [];
      }
    } catch {
      // boş
    }
    return [];
  }

  // Case §4.5/§4.6: Abone teklif yanıtı (ACCEPTED/REJECTED) ve/veya 1-5 yıldız puanı.
  async submitFeedback(payload: { campaignId: string; response: 'ACCEPTED' | 'REJECTED'; rejectionReason?: string; rating?: number }) {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/feedback`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) return await res.json();
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || err?.message || 'Geri bildirim gönderilemedi.' };
    } catch {
      return { success: false, error: 'Geri bildirim gönderilemedi (servis erişilemez).' };
    }
  }

  async transitionCaseStatus(caseId: string, targetStatus: string, note?: string) {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/cases/${caseId}/status`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ status: targetStatus, note }),
      });
      if (res.ok) return await res.json();
      if (res.status === 422) {
        throw new Error('HTTP 422: State Machine geçiş kuralı ihlali');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('422')) throw err;
    }
    return { success: false, error: 'Durum güncellenemedi (servis erişilemez).' };
  }

  async overrideSegment(caseId: string, newSegment: string, reason: string) {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/cases/${caseId}/segment`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ segment: newSegment, reason }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Sahte başarı yanıtı YOK.
    }
    return { success: false, error: 'Segment güncellenemedi (servis erişilemez).' };
  }

  // ===== GAMIFICATION SERVICE (Case §8.1: /api/v1/game) =====
  async getLeaderboard(): Promise<ApiLeaderboard[]> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/game/leaderboard?period=ALL_TIME`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.leaderboard || [];
        return rows.map((r: Record<string, unknown>, i: number) => ({
          rank: (r.rank as number) ?? i + 1,
          expertId: (r.expertId as string) || '',
          name: (r.expertName as string) || (r.name as string) || `Uzman ${String(r.expertId || '').slice(0, 8)}`,
          level: (r.level as string) || 'Bronz',
          points: (r.totalPoints as number) ?? (r.points as number) ?? 0,
          badges: (r.badges as string[]) || [],
        }));
      }
    } catch {
      // Sahte leaderboard YOK.
    }
    return [];
  }

  // ===== AI SERVICE =====
  async getAiMetrics(): Promise<ApiAiMetrics> {
    try {
      const res = await fetch(`${this.gatewayUrl}/api/v1/ai/accuracy`, {
        headers: this.getHeaders(),
      });
      if (res.ok) {
        const d = await res.json();
        const cb = d.category_breakdown || {};
        return {
          accuracy: d.accuracy_percentage ?? 0,
          totalPredictions: d.total_predictions ?? 0,
          misclassifications: d.misclassified_count ?? 0,
          f1Score: 0,
          categories: Object.keys(cb).map((k) => ({
            name: k,
            accuracy: cb[k].accuracy_pct ?? 0,
            correct: cb[k].correct ?? 0,
            total: cb[k].total ?? 0,
          })),
        };
      }
    } catch {
      // Sahte AI metriği YOK.
    }
    return {
      accuracy: 0,
      totalPredictions: 0,
      misclassifications: 0,
      f1Score: 0,
      categories: [],
    };
  }
}

export const api = new CampaignCellApiClient();
