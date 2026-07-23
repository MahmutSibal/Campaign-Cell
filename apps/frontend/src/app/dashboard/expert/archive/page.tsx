'use client';

import React, { useState, useEffect, Suspense } from 'react';
import DashboardShell from '../../../components/DashboardShell';
import { Archive, Search } from 'lucide-react';

// Kullanıcıya özel, kimlik doğrulamalı sayfa → statik prerender kapalı.
export const dynamic = 'force-dynamic';

interface CampaignRow {
  id: string;
  code: string;
  name: string;
  type: string;
  segment: string;
  discountPercent: number;
  status: string;
  aiScore: number;
}

const TYPE_LABELS: Record<string, string> = {
  EK_PAKET: 'Ek Paket', CIHAZ_FIRSATI: 'Cihaz Fırsatı', TARIFE_YUKSELTME: 'Tarife Yükseltme', SADAKAT: 'Sadakat',
};
const TYPE_COLORS: Record<string, string> = {
  EK_PAKET: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  CIHAZ_FIRSATI: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  TARIFE_YUKSELTME: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  SADAKAT: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
};

export default function ExpertArchivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#050810]" />}>
      <ExpertArchivePageInner />
    </Suspense>
  );
}

function ExpertArchivePageInner() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expertName, setExpertName] = useState('Kampanya Uzmanı');
  const [expertEmail, setExpertEmail] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cc_user');
      if (stored) {
        const u = JSON.parse(stored);
        const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        if (n) setExpertName(n);
        if (u.email) setExpertEmail(u.email);
      }
    } catch {}

    import('../../../../lib/api').then(({ api }) => {
      api.getCampaigns().then((camps: any[]) => {
        setCampaigns((camps || []).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          type: c.type,
          segment: c.targetSegment || '-',
          discountPercent: Number(c.discountPercent) || 0,
          status: c.status || '-',
          aiScore: Number(c.aiRecommendationScore) || 0,
        })));
      }).catch(() => {}).finally(() => setLoading(false));
    });
  }, []);

  const filtered = campaigns
    .filter((c) => typeFilter === 'ALL' || c.type === typeFilter)
    .filter((c) => statusFilter === 'ALL' || c.status === statusFilter)
    .filter((c) => search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search));

  return (
    <DashboardShell role="expert" userName={expertName} userDetail={expertEmail ? `${expertEmail}` : 'Kampanya Uzmanı'}>
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white">Kampanya Arşivi</h1>
          <p className="text-sm text-slate-400 mt-1">Sistemdeki tüm kampanyaların gerçek durumu ve AI skoru</p>
        </div>

        {/* Summary KPIs — canlı sayımlar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Toplam Kampanya', value: campaigns.length.toString(), color: 'text-white' },
            { label: 'Aktif', value: campaigns.filter(c => c.status === 'ACTIVE').length.toString(), color: 'text-emerald-400' },
            { label: 'Arşivlenmiş', value: campaigns.filter(c => c.status === 'ARCHIVED').length.toString(), color: 'text-slate-400' },
            { label: 'Manuel Kuyruk', value: campaigns.filter(c => c.status === 'MANUAL_OPTIMIZATION_REQUIRED').length.toString(), color: 'text-amber-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card rounded-2xl p-5">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{kpi.label}</div>
              <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Kampanya ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/40 rounded-xl text-white text-sm outline-none focus:border-turkcell-yellow/40 transition-all"
            />
          </div>
          <div className="flex items-center space-x-2">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2.5 bg-slate-900/60 border border-slate-700/40 rounded-xl text-white text-xs outline-none">
              <option value="ALL">Tüm Türler</option>
              <option value="EK_PAKET">Ek Paket</option>
              <option value="CIHAZ_FIRSATI">Cihaz Fırsatı</option>
              <option value="TARIFE_YUKSELTME">Tarife Yükseltme</option>
              <option value="SADAKAT">Sadakat</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 bg-slate-900/60 border border-slate-700/40 rounded-xl text-white text-xs outline-none">
              <option value="ALL">Tüm Durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="ARCHIVED">Arşivlendi</option>
              <option value="MANUAL_OPTIMIZATION_REQUIRED">Manuel Kuyruk</option>
            </select>
          </div>
        </div>

        {/* Campaign list */}
        <div className="space-y-4">
          {loading && <div className="text-center py-10 text-slate-500 text-sm">Kampanyalar yükleniyor...</div>}
          {filtered.map((camp) => (
            <div key={camp.id} className="glass-card rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[10px] text-slate-500">{camp.code}</span>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${TYPE_COLORS[camp.type] || 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                  {TYPE_LABELS[camp.type] || camp.type}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-500/15 text-slate-300 text-[10px] font-bold border border-slate-500/20">{camp.status}</span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold border border-emerald-500/15">%{camp.discountPercent} İndirim</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800/60 text-[10px] text-slate-300">{camp.segment}</span>
              </div>
              <h3 className="text-lg font-bold text-white">{camp.name}</h3>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-lg font-black text-purple-400">%{Math.round(camp.aiScore * 100)}</div>
                  <div className="text-[9px] text-slate-500">AI Öneri Skoru</div>
                </div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Kampanya bulunamadı</p>
            </div>
          )}
        </div>
      </main>
    </DashboardShell>
  );
}
