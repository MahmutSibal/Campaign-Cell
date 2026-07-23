'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import {
  Plus, AlertTriangle, CheckCircle2, Clock,
  Layers, ChevronRight, XCircle, Timer, RefreshCw, Eye, Sparkles
} from 'lucide-react';

interface CaseItem {
  id: string;
  caseCode: string;
  campaignName: string;
  campaignType: string;
  segment: string;
  priority: 'DUSUK' | 'ORTA' | 'YUKSEK' | 'KRITIK';
  status: 'YENI' | 'ATANDI' | 'OPTIMIZE_EDILIYOR' | 'TEST_EDILIYOR' | 'TAMAMLANDI' | 'YAYINDA' | 'ARSIVLENDI';
  aiScore: number;
  assignedExpert: string;
  isAiMisclassified: boolean;
  optimizationNote?: string;
  slaDeadline: string;
  slaBreached: boolean;
  discountPercent: number;
  createdAt: string;
}

const STATE_FLOW = ['YENI', 'ATANDI', 'OPTIMIZE_EDILIYOR', 'TEST_EDILIYOR', 'TAMAMLANDI', 'YAYINDA', 'ARSIVLENDI'];

const VALID_TRANSITIONS: Record<string, string[]> = {
  YENI: ['ATANDI'],
  ATANDI: ['OPTIMIZE_EDILIYOR'],
  OPTIMIZE_EDILIYOR: ['TEST_EDILIYOR'],
  TEST_EDILIYOR: ['TAMAMLANDI'],
  TAMAMLANDI: ['YAYINDA'],
  YAYINDA: ['ARSIVLENDI'],
  ARSIVLENDI: [],
};

const priorityConfig: Record<string, { bg: string; text: string }> = {
  KRITIK: { bg: 'bg-rose-100 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30', text: 'text-rose-700 dark:text-rose-400 font-bold' },
  YUKSEK: { bg: 'bg-orange-100 dark:bg-orange-500/15 border-orange-200 dark:border-orange-500/30', text: 'text-orange-700 dark:text-orange-400 font-bold' },
  ORTA: { bg: 'bg-amber-100 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30', text: 'text-amber-800 dark:text-amber-400 font-bold' },
  DUSUK: { bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', text: 'text-slate-700 dark:text-slate-400 font-medium' },
};

function ExpertDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('active');
  const [optNote, setOptNote] = useState('');
  const [expertName, setExpertName] = useState('Kampanya Uzmanı');

  // Backend optimizasyon vakası → UI CaseItem eşlemesi (canlı veri).
  const mapCase = (c: any): CaseItem => ({
    id: c.id,
    caseCode: c.caseCode || c.campaign?.code || '',
    campaignName: c.campaign?.name || c.campaignName || 'Optimizasyon Vakası',
    campaignType: c.campaign?.type || c.campaignType || '',
    segment: c.segment || 'BELIRSIZ',
    priority: c.priority || 'ORTA',
    status: c.status || 'YENI',
    aiScore: Number(c.aiScore) || 0,
    assignedExpert: c.assignedExpertId || '',
    isAiMisclassified: Boolean(c.isAiMisclassified),
    optimizationNote: c.optimizationNote || undefined,
    slaDeadline: c.slaDeadline || new Date().toISOString(),
    slaBreached: Boolean(c.slaBreached),
    discountPercent: Number(c.campaign?.discountPercent ?? c.discountPercent) || 0,
    createdAt: c.createdAt || new Date().toISOString(),
  });

  const reloadCases = React.useCallback(async () => {
    const { api } = await import('../../../lib/api');
    const data = await api.getCases();
    const mapped = (data || []).map(mapCase);
    setCases(mapped);
    setSelectedCase(prev => {
      if (prev) {
        const still = mapped.find(m => m.id === prev.id);
        if (still) return still;
      }
      return mapped[0] || null;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tabParam && ['all', 'active', 'completed'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cc_user');
        if (stored) {
          const u = JSON.parse(stored);
          const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          if (n) setExpertName(n);
        }
      } catch {}
    }
    reloadCases().catch(() => setLoading(false));
  }, [tabParam, reloadCases]);
  const [newSeg, setNewSeg] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Create campaign modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '', type: 'EK_PAKET', segment: 'YUKSEK_DEGER', discountPercent: 20,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Case §4.1: gerçek kampanya oluşturma — AI skorlama + otomatik vaka backend'de tetiklenir.
    const { api } = await import('../../../lib/api');
    const res = await api.createCampaign({
      name: newCampaign.name,
      type: newCampaign.type,
      segment: newCampaign.segment,
      discountPercent: newCampaign.discountPercent,
    });
    setSubmitting(false);
    if (res && res.success === false) {
      alert(res.error || 'Kampanya oluşturulamadı.');
      return;
    }
    setShowCreateModal(false);
    setNewCampaign({ name: '', type: 'EK_PAKET', segment: 'YUKSEK_DEGER', discountPercent: 20 });
    await reloadCases();
  };

  const handleStatusTransition = async (caseId: string, nextStatus: CaseItem['status']) => {
    // Case §4.2: gerçek state machine geçişi (kural dışıysa backend 422 döner).
    const { api } = await import('../../../lib/api');
    try {
      const res = await api.transitionCaseStatus(caseId, nextStatus, optNote || undefined);
      if (res && res.success === false) {
        alert(res.error || 'Durum güncellenemedi.');
        return;
      }
      setOptNote('');
      await reloadCases();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Geçiş başarısız (state machine kuralı).');
    }
  };

  const handleSegmentOverride = async (caseId: string) => {
    if (!newSeg) return;
    // Case §4.3: gerçek segment override → AI doğruluk metriğine 'yanlış sınıflandırma' işlenir.
    const { api } = await import('../../../lib/api');
    const res = await api.overrideSegment(caseId, newSeg, overrideReason || 'Uzman düzeltmesi');
    if (res && res.success === false) {
      alert(res.error || 'Segment güncellenemedi.');
      return;
    }
    setNewSeg('');
    setOverrideReason('');
    await reloadCases();
  };

  return (
    <DashboardShell
      role="expert"
      userName={expertName}
      userDetail="Kampanya Uzmanı"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Kampanya Optimizasyon Vakaları</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">AI destekli segmentasyon ve state machine vaka yönetimi</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy font-extrabold text-xs shadow-md hover:opacity-90 transition-all flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Yeni Kampanya Oluştur</span>
          </button>
        </div>

        {/* Case List & Detail layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Case List Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Atanan Vakalarım</span>
                <span className="text-xs font-extrabold text-turkcell-blue dark:text-turkcell-yellow">{cases.length} Vaka</span>
              </div>
              <div className="space-y-2">
                {loading && <div className="p-6 text-center text-xs text-slate-400">Vakalar yükleniyor...</div>}
                {!loading && cases.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">Henüz atanmış vaka yok. Yeni kampanya oluşturunca AI vaka üretir.</div>
                )}
                {cases.map(c => {
                  const pConfig = priorityConfig[c.priority];
                  const isSelected = selectedCase?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-slate-900 border-turkcell-blue dark:border-turkcell-yellow/60 shadow-md'
                          : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-turkcell-blue dark:text-turkcell-yellow">{c.caseCode}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${pConfig.bg} ${pConfig.text}`}>
                          {c.priority}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-2 line-clamp-1">{c.campaignName}</h4>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold">{c.segment}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">{c.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Case Detail Column */}
          <div className="lg:col-span-7">
            {selectedCase ? (
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-turkcell-blue dark:text-turkcell-yellow">{selectedCase.caseCode}</span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{selectedCase.campaignName}</h2>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full border ${priorityConfig[selectedCase.priority].bg} ${priorityConfig[selectedCase.priority].text}`}>
                    {selectedCase.priority} Öncelik
                  </span>
                </div>

                {/* State Machine Visualization */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">State Machine Akışı</label>
                  <div className="flex items-center space-x-1 overflow-x-auto pb-2">
                    {STATE_FLOW.map((st, idx) => {
                      const isCurrent = selectedCase.status === st;
                      return (
                        <React.Fragment key={st}>
                          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all ${
                            isCurrent
                              ? 'bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy border-turkcell-navy dark:border-turkcell-yellow shadow-sm'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}>
                            {st}
                          </span>
                          {idx < STATE_FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300 dark:text-slate-700 shrink-0" />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Status Transition Action Box */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white">Durum Geçişi İlerleme</label>
                  <textarea
                    rows={2}
                    value={optNote}
                    onChange={e => setOptNote(e.target.value)}
                    placeholder="Optimizasyon çalışma notu giriniz..."
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow font-medium"
                  />
                  <div className="flex flex-wrap gap-2">
                    {(VALID_TRANSITIONS[selectedCase.status] || []).map(nextSt => (
                      <button
                        key={nextSt}
                        onClick={() => handleStatusTransition(selectedCase.id, nextSt as CaseItem['status'])}
                        className="px-4 py-2 bg-turkcell-blue text-white dark:bg-turkcell-yellow dark:text-turkcell-navy text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-sm flex items-center space-x-1"
                      >
                        <span>İlerlet → {nextSt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Segment Override Box */}
                <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300">AI Segment Override (Düzeltme)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={newSeg}
                      onChange={e => setNewSeg(e.target.value)}
                      className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">Yeni Segment Seç...</option>
                      <option value="RISKLI_KAYIP">RISKLI_KAYIP</option>
                      <option value="YUKSEK_DEGER">YUKSEK_DEGER</option>
                      <option value="YENI_ABONE">YENI_ABONE</option>
                      <option value="PASIF">PASIF</option>
                    </select>
                    <button
                      onClick={() => handleSegmentOverride(selectedCase.id)}
                      disabled={!newSeg}
                      className="px-3 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-all"
                    >
                      Segmenti Güncelle
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">Vaka seçiniz</div>
            )}
          </div>
        </div>
      </div>

      {/* Modal for Create Campaign */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Yeni Kampanya Oluştur</h3>
            <form onSubmit={handleCreateCampaign} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kampanya Adı</label>
                <input
                  type="text"
                  required
                  value={newCampaign.name}
                  onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                  placeholder="örn: Platinum Ek 10GB Paketi"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tip</label>
                  <select
                    value={newCampaign.type}
                    onChange={e => setNewCampaign(p => ({ ...p, type: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="EK_PAKET">Ek Paket</option>
                    <option value="TARIFE_YUKSELTME">Tarife Yükseltme</option>
                    <option value="CIHAZ_FIRSATI">Cihaz Fırsatı</option>
                    <option value="SADAKAT">Sadakat</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hedef Segment</label>
                  <select
                    value={newCampaign.segment}
                    onChange={e => setNewCampaign(p => ({ ...p, segment: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="YUKSEK_DEGER">YUKSEK_DEGER</option>
                    <option value="RISKLI_KAYIP">RISKLI_KAYIP</option>
                    <option value="YENI_ABONE">YENI_ABONE</option>
                    <option value="PASIF">PASIF</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy font-bold rounded-xl disabled:opacity-60"
                >
                  {submitting ? 'Oluşturuluyor...' : 'Oluştur & AI Analizine Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default function ExpertDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#050810] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-amber-500 animate-spin"></div>
      </div>
    }>
      <ExpertDashboardContent />
    </Suspense>
  );
}
