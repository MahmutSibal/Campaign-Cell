'use client';

import React, { Suspense, useEffect, useState } from 'react';
import DashboardShell from '../../../components/DashboardShell';
import {
  Trophy, Award, Star, Zap, Target, Shield, Medal, Flame,
  TrendingUp, CheckCircle2
} from 'lucide-react';

// Kullanıcıya özel, kimlik doğrulamalı sayfa → statik prerender kapalı.
export const dynamic = 'force-dynamic';

const API_GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';
const authHeaders = (): HeadersInit => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('cc_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// Rozet kodu → görsel (case §6.2). "earned" bilgisi CANLI backend'den gelir.
const BADGE_META: Record<string, { icon: React.ElementType; color: string }> = {
  ILK_KAMPANYA: { icon: Star, color: 'blue' },
  HIZ_USTASI: { icon: Zap, color: 'amber' },
  DONUSUM_KRALI: { icon: Target, color: 'emerald' },
  MARATONCU: { icon: Flame, color: 'orange' },
  CHURN_AVCISI: { icon: Shield, color: 'rose' },
  UZMAN: { icon: Medal, color: 'purple' },
};

// Puan işlem kodu → okunabilir etiket (case §6.1).
const REASON_LABELS: Record<string, string> = {
  OPTIMIZATION_COMPLETED: 'Optimizasyon tamamlandı',
  FAST_BONUS: 'Hızlı optimizasyon bonusu',
  CONVERSION_TARGET_EXCEEDED: 'Dönüşüm hedefi aşıldı',
  KRITIK_SLA_COMPLETED: 'KRİTİK vaka SLA içinde tamamlandı',
  SLA_EXCEEDED: 'SLA aşımı',
  HIGH_RATING: 'Abone yüksek puan verdi',
  LOW_RATING: 'Abone düşük puan verdi',
};

const LEVEL_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Platin: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  Altın: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  Gümüş: { bg: 'bg-slate-400/15', text: 'text-slate-300', border: 'border-slate-400/30' },
  Bronz: { bg: 'bg-amber-700/15', text: 'text-amber-600', border: 'border-amber-700/30' },
};

interface PointsData {
  totalPoints: number;
  currentLevel: string;
  nextLevel: string | null;
  nextLevelMinPoints: number | null;
  progressPercentage: number;
  recentTransactions: { id: string; points: number; reason: string; caseId?: string | null; createdAt: string }[];
}
interface BadgeItem { code: string; name: string; description: string; isEarned: boolean }

export default function ExpertProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#050810]" />}>
      <ExpertProfilePageInner />
    </Suspense>
  );
}

function ExpertProfilePageInner() {
  const [user, setUser] = useState<{ id?: string; firstName?: string; lastName?: string; email?: string; region?: string; expertiseTags?: string[] } | null>(null);
  const [points, setPoints] = useState<PointsData | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let id: string | undefined;
    try {
      const stored = localStorage.getItem('cc_user');
      if (stored) { const u = JSON.parse(stored); setUser(u); id = u?.id; }
    } catch {}
    if (!id) { setLoading(false); return; }

    Promise.all([
      fetch(`${API_GW}/api/v1/game/experts/${id}/points`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_GW}/api/v1/game/experts/${id}/badges`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([p, b]) => {
      if (p) setPoints(p);
      if (b?.badges) setBadges(b.badges);
    }).finally(() => setLoading(false));
  }, []);

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Kampanya Uzmanı' : 'Kampanya Uzmanı';
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'UZ';
  const level = points?.currentLevel || 'Bronz';
  const lc = LEVEL_CONFIG[level] || LEVEL_CONFIG.Bronz;
  const totalPoints = points?.totalPoints ?? 0;
  const progress = points?.progressPercentage ?? 0;
  const earnedCount = badges.filter(b => b.isEarned).length;
  const completedCount = points?.recentTransactions?.filter(t => t.reason === 'OPTIMIZATION_COMPLETED').length ?? 0;

  return (
    <DashboardShell role="expert" userName={name} userDetail={`${user?.email || ''} • ${level}`}>
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {loading && <div className="text-center text-xs text-slate-400 py-6">Profil verisi yükleniyor...</div>}

        {/* Profile Header */}
        <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-turkcell-yellow/5 rounded-full blur-[120px]" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-turkcell-yellow to-amber-500 flex items-center justify-center text-turkcell-navy text-2xl font-black shadow-2xl shadow-turkcell-yellow/30">
              {initials}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-black text-white">{name}</h1>
                <span className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${lc.bg} ${lc.text} ${lc.border}`}>
                  {level} Seviye
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {user?.email && <span>{user.email}</span>}
                {user?.region && <><span>•</span><span>{user.region}</span></>}
                {(user?.expertiseTags || []).length > 0 && <span>•</span>}
                <div className="flex gap-1.5 flex-wrap">
                  {(user?.expertiseTags || []).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-lg bg-slate-800/60 text-[10px] text-slate-300">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-black text-turkcell-yellow">{totalPoints.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">Toplam Puan</div>
              {points?.nextLevel && points?.nextLevelMinPoints != null && (
                <div className="text-[10px] text-slate-500">
                  <span className="text-turkcell-yellow font-bold">{Math.max(0, points.nextLevelMinPoints - totalPoints)}</span> puan → {points.nextLevel}
                </div>
              )}
            </div>
          </div>

          {/* Level Progress */}
          <div className="mt-6 max-w-xl">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold ${lc.text}`}>{level}</span>
              <span className="text-xs text-slate-500">{points?.nextLevel || '🏆 Maksimum Seviye'}</span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full progress-bar-animated rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* KPIs — CANLI gamification verisi */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Toplam Puan', value: totalPoints.toLocaleString(), icon: Trophy, color: 'amber' },
            { label: 'Seviye', value: level, icon: Medal, color: 'purple' },
            { label: 'Kazanılan Rozet', value: `${earnedCount}/${badges.length || 6}`, icon: Award, color: 'emerald' },
            { label: 'Tamamlanan (son 20)', value: completedCount.toString(), icon: CheckCircle2, color: 'blue' },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 text-${kpi.color}-400`} />
              </div>
              <div className="text-3xl font-black text-white">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-turkcell-yellow" />
              <h3 className="text-lg font-bold text-white">Rozetlerim</h3>
            </div>
            <span className="text-xs text-slate-500">{earnedCount}/{badges.length || 0} Kazanıldı</span>
          </div>
          {badges.length === 0 ? (
            <p className="text-xs text-slate-500">Henüz rozet verisi yok. Optimizasyon tamamladıkça rozetler burada görünür.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {badges.map((badge) => {
                const meta = BADGE_META[badge.code] || { icon: Star, color: 'slate' };
                const BadgeIcon = meta.icon;
                return (
                  <div
                    key={badge.code}
                    className={`p-4 rounded-xl border text-center space-y-2 transition-all ${
                      badge.isEarned ? `bg-${meta.color}-500/10 border-${meta.color}-500/20` : 'bg-slate-900/30 border-slate-800/40 opacity-40 grayscale'
                    }`}
                  >
                    <BadgeIcon className={`w-7 h-7 mx-auto ${badge.isEarned ? `text-${meta.color}-400` : 'text-slate-600'}`} />
                    <div>
                      <div className={`text-[11px] font-bold ${badge.isEarned ? 'text-white' : 'text-slate-600'}`}>{badge.name}</div>
                      <div className="text-[9px] text-slate-500">{badge.description}</div>
                    </div>
                    {badge.isEarned && (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[8px] font-bold">✓ Kazanıldı</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity — CANLI puan hareketleri */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-turkcell-yellow" />
            <h3 className="text-lg font-bold text-white">Son Puan Hareketleri</h3>
          </div>
          {(!points || points.recentTransactions.length === 0) ? (
            <p className="text-xs text-slate-500">Henüz puan hareketi yok.</p>
          ) : (
            <div className="space-y-2">
              {points.recentTransactions.map((act) => (
                <div key={act.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-white/[0.03]">
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      act.points >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {act.points >= 0 ? `+${act.points}` : act.points}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">{REASON_LABELS[act.reason] || act.reason}</div>
                      {act.caseId && <div className="text-[10px] text-slate-500 font-mono">{act.caseId}</div>}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{new Date(act.createdAt).toLocaleString('tr-TR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </DashboardShell>
  );
}
