'use client';

import React, { Suspense, useEffect, useState } from 'react';
import DashboardShell from '../../../components/DashboardShell';
import { Phone, Mail, MapPin, Wifi, PhoneCall, CreditCard, TrendingUp, Zap, Package, Save } from 'lucide-react';

// Kullanıcıya özel, kimlik doğrulamalı sayfa → statik prerender kapalı.
export const dynamic = 'force-dynamic';

const API_GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';
const authHeaders = (): HeadersInit => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('cc_token') : null;
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

interface AiProfile {
  current_tariff: string | null;
  monthly_data_usage_gb: number;
  monthly_voice_min: number;
  monthly_spend_try: number;
  tenure_months: number;
  past_accepted_count: number;
  past_rejected_count: number;
  complaint_count: number;
  data_usage_trend_pct: number;
}

const EMPTY: AiProfile = {
  current_tariff: '', monthly_data_usage_gb: 0, monthly_voice_min: 0, monthly_spend_try: 0,
  tenure_months: 0, past_accepted_count: 0, past_rejected_count: 0, complaint_count: 0, data_usage_trend_pct: 0,
};

const FIELDS: { key: keyof AiProfile; label: string; suffix?: string }[] = [
  { key: 'monthly_data_usage_gb', label: 'Aylık Veri Kullanımı', suffix: 'GB' },
  { key: 'monthly_voice_min', label: 'Aylık Konuşma', suffix: 'dk' },
  { key: 'monthly_spend_try', label: 'Aylık Harcama (ARPU)', suffix: '₺' },
  { key: 'tenure_months', label: 'Abonelik Süresi', suffix: 'ay' },
  { key: 'past_accepted_count', label: 'Kabul Edilen Teklif' },
  { key: 'past_rejected_count', label: 'Reddedilen Teklif' },
  { key: 'complaint_count', label: 'Şikayet Sayısı' },
  { key: 'data_usage_trend_pct', label: 'Veri Kullanım Trendi', suffix: '%' },
];

export default function SubscriberProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#050810]" />}>
      <SubscriberProfilePageInner />
    </Suspense>
  );
}

function SubscriberProfilePageInner() {
  const [user, setUser] = useState<{ id?: string; firstName?: string; lastName?: string; gsmNumber?: string; email?: string; region?: string } | null>(null);
  const [profile, setProfile] = useState<AiProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let id: string | undefined;
    try {
      const stored = localStorage.getItem('cc_user');
      if (stored) { const u = JSON.parse(stored); setUser(u); id = u?.id; }
    } catch {}
    if (!id) { setLoading(false); return; }
    fetch(`${API_GW}/api/v1/ai/subscribers/${id}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then((p) => { if (p) setProfile({ ...EMPTY, ...p, current_tariff: p.current_tariff ?? '' }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`${API_GW}/api/v1/ai/subscribers/${user.id}`, {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(profile),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch {}
    setSaving(false);
  };

  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Değerli Aboneniz' : 'Değerli Aboneniz';
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'AB';
  const setNum = (k: keyof AiProfile, v: string) => setProfile(p => ({ ...p, [k]: Number(v) || 0 }));

  return (
    <DashboardShell role="subscriber" userName={name} userDetail={`${user?.gsmNumber || '—'} • Turkcell Abonesi`}>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {loading && <div className="text-center text-xs text-slate-400 py-6">Profil yükleniyor...</div>}

        {/* Header */}
        <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px]" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-turkcell-blue to-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-2xl shadow-turkcell-blue/30">
              {initials}
            </div>
            <div className="flex-1 space-y-2">
              <h1 className="text-3xl font-black text-white">{name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center space-x-1.5"><Phone className="w-3.5 h-3.5" /><span>{user?.gsmNumber || '—'}</span></span>
                {user?.email && <span className="flex items-center space-x-1.5"><Mail className="w-3.5 h-3.5" /><span>{user.email}</span></span>}
                {user?.region && <span className="flex items-center space-x-1.5"><MapPin className="w-3.5 h-3.5" /><span>{user.region}</span></span>}
              </div>
            </div>
          </div>
        </div>

        {/* Usage summary — canlı profil değerleri */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={CreditCard} label="Aylık Harcama" value={`₺${profile.monthly_spend_try}`} color="amber" />
          <SummaryCard icon={Wifi} label="Veri Kullanımı" value={`${profile.monthly_data_usage_gb} GB`} color="blue" />
          <SummaryCard icon={PhoneCall} label="Konuşma" value={`${profile.monthly_voice_min} dk`} color="emerald" />
          <SummaryCard icon={TrendingUp} label="Kullanım Trendi" value={`%${profile.data_usage_trend_pct}`} color="purple" />
        </div>

        {/* AI Profile Editor — gerçek veri girişi (kişisel teklif skoru bu profile göre hesaplanır) */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-bold text-white">AI Profil Bilgileri (Düzenlenebilir)</h3>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-turkcell-yellow text-turkcell-navy text-xs font-black flex items-center space-x-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Profili Kaydet'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bu değerler scikit-learn ML modeli tarafından kişisel kampanya öneri skorunuzu hesaplamak için kullanılır.
            Gerçek kullanım verilerinizi girip kaydedin — teklifleriniz buna göre yeniden skorlanır.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-900/50 border border-white/[0.04]">
                <div>
                  <span className="text-xs text-slate-300">{f.label}</span>
                  <span className="block text-[9px] font-mono text-slate-600">{f.key}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    value={profile[f.key] as number}
                    onChange={(e) => setNum(f.key, e.target.value)}
                    className="w-24 text-right px-2 py-1 bg-slate-800/70 border border-slate-700/50 rounded-lg text-sm font-bold text-white outline-none focus:border-turkcell-yellow/50"
                  />
                  {f.suffix && <span className="text-[10px] text-slate-500 w-6">{f.suffix}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign interaction (profilden) */}
        <div className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-turkcell-yellow" />
            <h3 className="text-lg font-bold text-white">Kampanya Etkileşimleri</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-center space-y-1">
              <div className="text-2xl font-black text-emerald-400">{profile.past_accepted_count}</div>
              <div className="text-[10px] text-slate-400">Kabul Edilen</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/15 text-center space-y-1">
              <div className="text-2xl font-black text-rose-400">{profile.past_rejected_count}</div>
              <div className="text-[10px] text-slate-400">Reddedilen</div>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/15 text-center space-y-1">
              <div className="text-2xl font-black text-blue-400">{profile.complaint_count}</div>
              <div className="text-[10px] text-slate-400">Şikayet</div>
            </div>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 text-${color}-400`} />
      </div>
      <div className="text-2xl font-black text-white">{value}</div>
    </div>
  );
}
