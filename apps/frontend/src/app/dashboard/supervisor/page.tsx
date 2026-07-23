'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import {
  BarChart3, Cpu, Award, Trophy, Activity,
  CheckCircle2, Star, TrendingUp, AlertTriangle, Timer,
  Zap, Target, Shield, Medal, Flame, Users, Brain, Check, RefreshCw, Sparkles
} from 'lucide-react';

const API_GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';

interface LeaderboardEntry {
  rank: number;
  name: string;
  level: string;
  points: number;
  badgesCount: number;
}

interface SlaEntry {
  caseCode: string;
  campaignName: string;
  priority: string;
  status: string;
  segment: string;
  slaHours: number;
  remainingHours: number;
  expert: string;
  breached: boolean;
}

interface FeatureImportance {
  feature: string;
  label: string;
  importance_weight: number;
  percentage: number;
}

interface BenchmarkResult {
  model_name: string;
  cv_accuracy_pct: number;
  f1_score: number;
  cv_std_pct: number;
}

interface LiveAccuracy {
  accuracy_percentage: number;
  total_predictions: number;
  misclassified_count: number;
  corrected_predictions_count: number;
  active_model_version: string;
  categories: { name: string; total: number; correct: number; accuracy_pct: number }[];
}

const SEGMENT_LABELS: Record<string, string> = {
  YUKSEK_DEGER: 'YÜKSEK DEĞER',
  RISKLI_KAYIP: 'RİSKLİ KAYIP',
  YENI_ABONE: 'YENİ ABONE',
  PASIF: 'PASİF ABONE',
};

const authHeaders = (): HeadersInit => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('cc_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const BADGE_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  ILK_KAMPANYA: { icon: Star, color: 'text-blue-600 dark:text-blue-400', label: 'İlk Kampanya' },
  HIZ_USTASI: { icon: Zap, color: 'text-amber-600 dark:text-amber-400', label: 'Hız Ustası' },
  DONUSUM_KRALI: { icon: Target, color: 'text-emerald-600 dark:text-emerald-400', label: 'Dönüşüm Kralı' },
  MARATONCU: { icon: Flame, color: 'text-orange-600 dark:text-orange-400', label: 'Maratoncu' },
  CHURN_AVCISI: { icon: Shield, color: 'text-rose-600 dark:text-rose-400', label: 'Churn Avcısı' },
  UZMAN: { icon: Medal, color: 'text-purple-600 dark:text-purple-400', label: 'Uzman' },
};

const LEVEL_CONFIG: Record<string, { bg: string; text: string; border: string; min: number; max: number }> = {
  Platin: { bg: 'bg-purple-100 dark:bg-purple-500/15', text: 'text-purple-700 dark:text-purple-300 font-bold', border: 'border-purple-200 dark:border-purple-500/30', min: 3000, max: 5000 },
  Altın: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-800 dark:text-amber-300 font-bold', border: 'border-amber-200 dark:border-amber-500/30', min: 1500, max: 2999 },
  Gümüş: { bg: 'bg-slate-100 dark:bg-slate-400/15', text: 'text-slate-700 dark:text-slate-300 font-bold', border: 'border-slate-200 dark:border-slate-400/30', min: 500, max: 1499 },
  Bronz: { bg: 'bg-orange-100 dark:bg-amber-700/15', text: 'text-orange-800 dark:text-amber-600 font-bold', border: 'border-orange-200 dark:border-amber-700/30', min: 0, max: 499 },
};

function SupervisorDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'ai_accuracy' | 'sla'>('overview');
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkResult[]>([]);
  const [featuresData, setFeaturesData] = useState<FeatureImportance[]>([]);
  const [liveAccuracy, setLiveAccuracy] = useState<LiveAccuracy | null>(null);
  const [supervisorName, setSupervisorName] = useState('Süpervizör Yönetici');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [demoSimulating, setDemoSimulating] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Sync tab with URL parameter using Next.js App Router hooks
  useEffect(() => {
    if (tabParam && ['overview', 'leaderboard', 'ai_accuracy', 'sla'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [tabParam]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [slaCases, setSlaCases] = useState<SlaEntry[]>([]);

  const loadAiAnalytics = async () => {
    setIsAiLoading(true);
    try {
      const [bmRes, featRes, accRes] = await Promise.all([
        fetch(`${API_GW}/api/v1/ai/benchmark`),
        fetch(`${API_GW}/api/v1/ai/feature-importance`),
        fetch(`${API_GW}/api/v1/ai/accuracy`, { headers: authHeaders() }),
      ]);
      if (bmRes.ok) {
        const d = await bmRes.json();
        if (d.benchmark_results && d.benchmark_results.length > 0) {
          setBenchmarkData(d.benchmark_results);
        }
      }
      if (featRes.ok) {
        const d = await featRes.json();
        if (d.feature_importances && d.feature_importances.length > 0) {
          setFeaturesData(d.feature_importances);
        }
      }
      if (accRes.ok) {
        const d = await accRes.json();
        const cb = d.category_breakdown || {};
        setLiveAccuracy({
          accuracy_percentage: d.accuracy_percentage ?? 0,
          total_predictions: d.total_predictions ?? 0,
          misclassified_count: d.misclassified_count ?? 0,
          corrected_predictions_count: d.corrected_predictions_count ?? 0,
          active_model_version: d.active_model_version ?? '-',
          categories: Object.keys(cb).map((k) => ({
            name: SEGMENT_LABELS[k] || k,
            total: cb[k].total ?? 0,
            correct: cb[k].correct ?? 0,
            accuracy_pct: cb[k].accuracy_pct ?? 0,
          })),
        });
      }
    } catch {
      // Fallback
    } finally {
      setIsAiLoading(false);
    }
  };

  // Gerçek liderlik tablosu ve SLA verisini (canlı backend/PostgreSQL) yükler
  const loadOperationalData = async () => {
    try {
      const [lbRes, usersRes, casesRes] = await Promise.all([
        fetch(`${API_GW}/api/v1/game/leaderboard?period=ALL_TIME`, { headers: authHeaders() }),
        fetch(`${API_GW}/api/v1/admin/users`, { headers: authHeaders() }),
        fetch(`${API_GW}/api/v1/cases?limit=50`, { headers: authHeaders() }),
      ]);

      let userMap: Record<string, string> = {};
      if (usersRes.ok) {
        const uData = await usersRes.json();
        const uList = Array.isArray(uData) ? uData : uData.data || [];
        uList.forEach((u: any) => {
          if (u.id) userMap[u.id] = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
        });
      }

      if (lbRes.ok) {
        const d = await lbRes.json();
        const rows = Array.isArray(d) ? d : d.leaderboard || [];
        if (rows.length > 0) {
          setLeaderboard(
            rows.map((r: Record<string, unknown>, i: number) => {
              const expId = String(r.expertId || '');
              return {
                rank: (r.rank as number) ?? i + 1,
                name: (r.expertName as string) || userMap[expId] || `Uzman ${expId.slice(0, 8)}`,
                level: (r.level as string) || 'Bronz',
                points: (r.totalPoints as number) ?? (r.points as number) ?? 0,
                badgesCount: (r.earnedBadgesCount as number) ?? 0,
              };
            }),
          );
          setIsLive(true);
        }
      }

      if (casesRes.ok) {
        const d = await casesRes.json();
        const items = Array.isArray(d) ? d : d.items || [];
        const mapped: SlaEntry[] = items.map((c: Record<string, any>) => {
          const deadline = c.slaDeadline ? new Date(c.slaDeadline).getTime() : Date.now() + 6 * 3600 * 1000;
          const remMs = deadline - Date.now();
          const remHours = Math.max(0, Math.round((remMs / (1000 * 60 * 60)) * 10) / 10);
          const expId = c.assignedExpertId ? String(c.assignedExpertId) : '';
          return {
            caseCode: c.caseCode || c.campaign?.code || '-',
            campaignName: c.campaign?.name || c.campaignName || 'Optimizasyon Vakası',
            priority: c.priority || 'ORTA',
            status: c.status || 'YENI',
            segment: c.segment || 'BELIRSIZ',
            slaHours: c.priority === 'KRITIK' ? 2 : c.priority === 'YUKSEK' ? 8 : 24,
            remainingHours: remHours,
            expert: userMap[expId] || (expId ? `Uzman ${expId.slice(0, 8)}` : 'Atanmadı'),
            breached: Boolean(c.slaBreached || remMs <= 0),
          };
        });
        if (mapped.length > 0) {
          setSlaCases(mapped);
          setIsLive(true);
        }
      }
    } catch {
      // live operational data fetch handled gracefully
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cc_user');
        if (stored) {
          const u = JSON.parse(stored);
          const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          if (n) setSupervisorName(n);
        }
      } catch {}
    }
    loadAiAnalytics();
    loadOperationalData();
  }, []);

  // Overview KPI'ları CANLI veriden türetilir (sahte sabit yok). Veri yoksa '—' gösterilir.
  const activeCaseCount = slaCases.length;
  const optimizingCount = slaCases.filter(s => s.status === 'OPTIMIZE_EDILIYOR').length;
  const breachedCount = slaCases.filter(s => s.breached).length;
  const slaComplyPct = activeCaseCount > 0 ? Math.round(((activeCaseCount - breachedCount) / activeCaseCount) * 1000) / 10 : null;
  const segmentDistribution = ['YUKSEK_DEGER', 'RISKLI_KAYIP', 'YENI_ABONE', 'PASIF', 'BELIRSIZ']
    .map(seg => ({ seg, count: slaCases.filter(s => s.segment === seg).length }))
    .filter(x => x.count > 0);
  const segColors: Record<string, string> = {
    YUKSEK_DEGER: 'bg-emerald-500', RISKLI_KAYIP: 'bg-rose-500', YENI_ABONE: 'bg-blue-500', PASIF: 'bg-amber-500', BELIRSIZ: 'bg-slate-400',
  };

  const triggerDemoSimulation = async () => {
    setDemoSimulating(true);
    try {
      await fetch(`${API_GW}/api/v1/events/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SYSTEM_TEST',
          title: '🔔 Canlı SSE Bağlantı Testi',
          message: 'Süpervizör panelinden gerçek zamanlı SSE bildirim kanalı test edildi (bağlantı aktif).',
        }),
      });
    } catch { /* ignore */ }
    setTimeout(() => setDemoSimulating(false), 2000);
  };

  return (
    <DashboardShell
      role="supervisor"
      userName={supervisorName}
      userDetail="Pazarlama ve Operasyon Yöneticisi"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Süpervizör Operasyonel Görünürlük Ekranı</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Kampanya performansı, AI model isabet oranı, SLA takibi ve liderlik tablosu</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={triggerDemoSimulation}
              disabled={demoSimulating}
              className="px-4 py-2 bg-gradient-to-r from-turkcell-yellow via-amber-400 to-amber-500 text-turkcell-navy text-xs font-black rounded-xl shadow-md hover:scale-[1.02] transition-all flex items-center space-x-2 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              <span>{demoSimulating ? 'Simüle Ediliyor...' : 'Canlı Demo Event Fırlat (+2 Bonus SSE)'}</span>
            </button>
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${isLive ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-500/10 border-slate-500/20'}`}>
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${isLive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {isLive ? 'Canlı Backend Verisi' : 'Demo Verisi'}
              </span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-full">
              <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">Süpervizör Panel</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-200/60 dark:bg-slate-900/60 p-1 rounded-xl w-fit border border-slate-300/40 dark:border-slate-800">
          {[
            { key: 'overview', label: 'Genel Bakış', icon: Activity },
            { key: 'leaderboard', label: 'Liderlik Tablosu', icon: Trophy },
            { key: 'ai_accuracy', label: 'AI Analiz & Benchmark', icon: Brain },
            { key: 'sla', label: 'SLA Takibi', icon: Timer },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as typeof activeTab);
                window.history.pushState(null, '', `?tab=${tab.key}`);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Aktif Vakalar', val: `${activeCaseCount} Vaka`, desc: `${optimizingCount} Optimizasyonda`, icon: Activity, color: 'text-blue-600 dark:text-blue-400' },
                { label: 'SLA Uyum Oranı', val: slaComplyPct != null ? `%${slaComplyPct}` : '—', desc: `${breachedCount} İhlal`, icon: Timer, color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'AI Tahmin Doğruluğu', val: liveAccuracy ? `%${liveAccuracy.accuracy_percentage}` : '—', desc: liveAccuracy ? `${liveAccuracy.total_predictions} Tahmin` : 'Veri bekleniyor', icon: Brain, color: 'text-turkcell-blue dark:text-turkcell-yellow' },
                { label: 'Düzeltilen Tahmin', val: liveAccuracy ? `${liveAccuracy.corrected_predictions_count}` : '—', desc: 'AI doğruluk geri bildirimi', icon: TrendingUp, color: 'text-purple-600 dark:text-purple-400' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase">{kpi.label}</span>
                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                  </div>
                  <div className={`text-2xl font-black ${kpi.color}`}>{kpi.val}</div>
                  <div className="text-[11px] text-slate-500 font-medium">{kpi.desc}</div>
                </div>
              ))}
            </div>

            {/* Segment Breakdown — canlı vaka verisinden hesaplanır */}
            <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Segment Dağılımı (Aktif Vakalar)</h3>
              {segmentDistribution.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium">Henüz vaka yok. Kampanya oluşturuldukça segment dağılımı burada canlı görünür.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {segmentDistribution.map((seg) => (
                    <div key={seg.seg} className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${segColors[seg.seg] || 'bg-slate-400'}`} />
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{SEGMENT_LABELS[seg.seg] || seg.seg}</span>
                      </div>
                      <div className="text-lg font-black text-slate-900 dark:text-white">{seg.count} Vaka</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Uzman Puan & Rozet Sıralaması</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Tamamlanan vaka, SLA süresi ve dönüşüm başarısına göre puanlanan liderlik tablosu</p>
              </div>
            </div>
            {leaderboard.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 font-medium">
                Henüz puan kazanan uzman yok. Uzmanlar optimizasyon tamamladıkça liderlik tablosu canlı dolar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-left">
                      {['Sıra', 'Uzman', 'Seviye', 'Toplam Puan', 'Rozet Sayısı'].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] text-slate-500 font-bold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {leaderboard.map(entry => {
                      const levelMeta = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.Bronz;
                      return (
                        <tr key={entry.rank} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3.5 font-black text-slate-900 dark:text-white">#{entry.rank}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900 dark:text-white">{entry.name}</div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] border ${levelMeta.bg} ${levelMeta.text} ${levelMeta.border}`}>
                              {entry.level}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-black text-turkcell-navy dark:text-turkcell-yellow text-sm">{entry.points} Puan</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{entry.badgesCount} Rozet</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AI Accuracy & Benchmark Tab */}
        {activeTab === 'ai_accuracy' && (
          <div className="space-y-6">
            {/* Canlı AI Doğruluk Metrikleri (gerçek /accuracy endpoint) */}
            {liveAccuracy && (
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center space-x-2">
                      <Brain className="w-4 h-4 text-turkcell-blue dark:text-turkcell-yellow" />
                      <span>Canlı AI Doğruluk Metrikleri (Gerçek Zamanlı)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      AI Service `/accuracy` uç noktasından canlı çekilen üretim metrikleri · Model: {liveAccuracy.active_model_version}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    ● Canlı Veri
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Genel Doğruluk', val: `%${liveAccuracy.accuracy_percentage}`, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Toplam Tahmin', val: liveAccuracy.total_predictions, color: 'text-turkcell-blue dark:text-turkcell-yellow' },
                    { label: 'Yanlış Sınıflama', val: liveAccuracy.misclassified_count, color: 'text-rose-600 dark:text-rose-400' },
                    { label: 'Düzeltilen (Feedback)', val: liveAccuracy.corrected_predictions_count, color: 'text-purple-600 dark:text-purple-400' },
                  ].map((m, i) => (
                    <div key={i} className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{m.label}</div>
                      <div className={`text-xl font-black ${m.color}`}>{m.val}</div>
                    </div>
                  ))}
                </div>

                {/* Kategori bazlı doğruluk bar grafiği */}
                {liveAccuracy.categories.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Segment Bazlı Doğruluk Kırılımı</h4>
                    {liveAccuracy.categories.map((cat) => (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-slate-200">
                          <span>{cat.name}</span>
                          <span className="text-turkcell-blue dark:text-turkcell-yellow">%{cat.accuracy_pct} ({cat.correct}/{cat.total})</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700"
                            style={{ width: `${cat.accuracy_pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Jüri İçin Model Karşılaştırma & Benchmark (Cross-Validation)</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">RandomForest, GradientBoosting ve ExtraTrees algoritmalarının 5-Fold CV başarı oranları</p>
                </div>
                <button onClick={loadAiAnalytics} disabled={isAiLoading} className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>Yenile</span>
                </button>
              </div>

              {/* Model Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-left">
                      {['Algoritma', '5-Fold CV Doğruluğu', 'Weighted F1-Score', 'Standart Sapma', 'Durum'].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] text-slate-500 font-bold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {benchmarkData.map((bm, idx) => (
                      <tr key={bm.model_name} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                          <Brain className="w-4 h-4 text-turkcell-blue dark:text-turkcell-yellow" />
                          <span>{bm.model_name}</span>
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400 text-sm">%{bm.cv_accuracy_pct}</td>
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">{bm.f1_score}</td>
                        <td className="px-4 py-3 text-slate-500 font-medium">±%{bm.cv_std_pct}</td>
                        <td className="px-4 py-3">
                          {idx === 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              ★ Aktif Üretim Modeli
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Yedek Model
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Feature Importance Weights (SHAP / XAI) */}
            <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Açıklanabilir AI (XAI) Özellik Önem Ağırlıkları (Feature Importance)</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Modelin öneri ve segment kararını en çok etkileyen telko parametreleri</p>
              </div>

              <div className="space-y-3">
                {featuresData.map(feat => (
                  <div key={feat.feature} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-900 dark:text-slate-200">
                      <span>{feat.label}</span>
                      <span className="text-turkcell-blue dark:text-turkcell-yellow">%{feat.percentage} ({feat.importance_weight})</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-turkcell-blue to-turkcell-navy dark:from-turkcell-yellow dark:to-amber-500 rounded-full transition-all duration-700"
                        style={{ width: `${feat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SLA Tab */}
        {activeTab === 'sla' && (
          <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">SLA Süresi Yaklaşan & İhlal Edilmiş Vakalar</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">KRİTİK (2 Saat), YÜKSEK (8 Saat), ORTA (24 Saat) SLA kurallarına göre izleme</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-left">
                    {['Vaka Kodu', 'Kampanya Adı', 'Öncelik', 'Durum', 'Kalan Süre', 'Atanan Uzman'].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] text-slate-500 font-bold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {slaCases.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400 font-medium">Aktif SLA takibi yapılan vaka yok.</td></tr>
                  )}
                  {slaCases.map(s => (
                    <tr key={s.caseCode} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3.5 font-mono font-bold text-turkcell-blue dark:text-turkcell-yellow">{s.caseCode}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">{s.campaignName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.priority === 'KRİTİK' ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400'
                        }`}>
                          {s.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-700 dark:text-slate-300">{s.status}</td>
                      <td className="px-4 py-3.5">
                        {s.breached ? (
                          <span className="text-rose-600 dark:text-rose-400 font-black flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>SLA İHLAL EDİLDİ</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">{s.remainingHours} Saat Kaldı</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">{s.expert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function SupervisorDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#050810] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-turkcell-blue animate-spin"></div>
      </div>
    }>
      <SupervisorDashboardContent />
    </Suspense>
  );
}
