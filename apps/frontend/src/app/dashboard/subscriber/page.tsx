'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import {
  Sparkles, CheckCircle2, XCircle, Star,
  Gift, TrendingUp, Zap, Package, Smartphone,
  Heart, Info
} from 'lucide-react';

interface Offer {
  id: string;
  code: string;
  name: string;
  type: string;
  typeLabel: string;
  discountPercent: number;
  aiScore: number;
  conversionProbability: number;
  reasoning: string;
  segment: string;
  validUntil: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  userRating?: number;
  icon: React.ElementType;
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#10B981' : score >= 70 ? '#0057B8' : '#F43F5E';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="score-ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-slate-900 dark:text-white">{score}</span>
      </div>
    </div>
  );
}

function SubscriberDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'offers' | 'my_campaigns'>('offers');
  const [currentUser, setCurrentUser] = useState<{ id?: string; firstName?: string; lastName?: string; gsmNumber?: string } | null>(null);

  const typeLabelOf = (t: string) => t === 'EK_PAKET' ? 'Ek Paket' : t === 'TARIFE_YUKSELTME' ? 'Tarife Yükseltme' : t === 'CIHAZ_FIRSATI' ? 'Cihaz Fırsatı' : 'Sadakat';
  const iconOf = (t: string) => t === 'EK_PAKET' ? Package : t === 'TARIFE_YUKSELTME' ? Smartphone : Zap;

  useEffect(() => {
    if (tabParam && (tabParam === 'offers' || tabParam === 'my_campaigns')) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    let userId: string | undefined;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cc_user');
        if (stored) {
          const u = JSON.parse(stored);
          setCurrentUser(u);
          userId = u?.id;
        }
      } catch {}
    }

    if (!userId) { setLoading(false); return; }

    // Case §8.2: aboneye özel, AI ile skorlanmış kişisel teklifler (gerçek endpoint).
    import('../../../lib/api').then(({ api }) => {
      api.getSubscriberOffers(userId as string).then((raw: any[]) => {
        const mapped: Offer[] = (raw || []).map((o) => ({
          id: o.campaignId,
          code: o.code,
          name: o.name,
          type: o.type,
          typeLabel: typeLabelOf(o.type),
          discountPercent: Number(o.discountPercent) || 0,
          aiScore: o.recommendationScore != null ? Math.round(Number(o.recommendationScore) * 100) : 0,
          conversionProbability: o.conversionProbability != null ? Math.round(Number(o.conversionProbability) * 100) : 0,
          reasoning: o.reasoning || 'Kullanım profilinize göre AI tarafından skorlanmıştır.',
          segment: o.predictedSegment || o.segment || '-',
          validUntil: '-',
          status: 'PENDING',
          icon: iconOf(o.type),
        }));
        setOffers(mapped);
      }).catch(() => {}).finally(() => setLoading(false));
    });
  }, []);

  const handleRespond = async (id: string, response: 'ACCEPTED' | 'REJECTED') => {
    // Case §4.5: gerçek geri bildirim backend'e gönderilir (dönüşüm verisine + AI skoruna işlenir).
    const { api } = await import('../../../lib/api');
    const res = await api.submitFeedback({ campaignId: id, response });
    if (res && res.success === false) {
      alert(res.error || 'Geri bildirim gönderilemedi.');
      return;
    }
    setOffers(prev => prev.map(o => o.id === id ? { ...o, status: response } : o));
  };

  const handleRate = async (id: string, rating: number) => {
    // Case §4.6: 1-5 yıldız puan (tek seferlik) — kabul edilen teklif üzerinden gönderilir.
    const { api } = await import('../../../lib/api');
    const res = await api.submitFeedback({ campaignId: id, response: 'ACCEPTED', rating });
    if (res && res.success === false) {
      alert(res.error || 'Puanınız kaydedilemedi (zaten puanlamış olabilirsiniz).');
      return;
    }
    setOffers(prev => prev.map(o => o.id === id ? { ...o, userRating: rating } : o));
  };

  const pendingOffers = offers.filter(o => o.status === 'PENDING');
  const acceptedOffers = offers.filter(o => o.status === 'ACCEPTED');

  const displayName = currentUser
    ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Değerli Aboneniz'
    : 'Değerli Aboneniz';
  const gsmDisplay = currentUser?.gsmNumber || '—';

  return (
    <DashboardShell
      role="subscriber"
      userName={displayName}
      userDetail={`${gsmDisplay} • Turkcell Abonesi`}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6">
        {/* Header banner */}
        <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-turkcell-blue/10 dark:bg-turkcell-yellow/15 text-turkcell-blue dark:text-turkcell-yellow text-xs font-bold border border-turkcell-blue/20 dark:border-turkcell-yellow/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Turkcell Yapay Zeka Kişiselleştirme Motoru</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Hoş Geldiniz{currentUser?.firstName ? `, ${currentUser.firstName}` : ''} 👋
              </h1>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-2xl font-medium">
                Yapay zeka motorumuz kullanım alışkanlıklarınızı analiz ederek size özel <strong>{pendingOffers.length} yeni kampanya</strong> hazırladı.
              </p>
            </div>
            <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="text-right">
                <div className="text-xs text-slate-500 font-semibold">Kişisel Teklif Sayısı</div>
                <div className="text-sm font-extrabold text-turkcell-navy dark:text-turkcell-yellow">{pendingOffers.length} Aktif Fırsat</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-turkcell-blue/10 flex items-center justify-center text-turkcell-blue">
                <Smartphone className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'offers'
                ? 'bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Sana Özel Fırsatlar ({pendingOffers.length})
          </button>
          <button
            onClick={() => setActiveTab('my_campaigns')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
              activeTab === 'my_campaigns'
                ? 'bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Aktif Kampanyalarım ({acceptedOffers.length})
          </button>
        </div>

        {/* Offers tab */}
        {activeTab === 'offers' && (
          <div className="space-y-4">
            {loading ? (
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
                <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-turkcell-blue animate-spin mx-auto mb-3"></div>
                <p className="text-xs text-slate-500 font-medium">Size özel teklifler AI ile skorlanıyor...</p>
              </div>
            ) : pendingOffers.length === 0 ? (
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Şu an gösterilecek kişisel teklif yok</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">AI öneri skoru 0.60 ve üzeri kampanyalar burada listelenir. Yeni kampanya tanımlandığında bildirilirsiniz.</p>
              </div>
            ) : (
              pendingOffers.map(offer => {
                const Icon = offer.icon;
                return (
                  <div
                    key={offer.id}
                    className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm hover:border-turkcell-blue dark:hover:border-turkcell-yellow/40 transition-all space-y-6"
                  >
                    {/* Top line */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-turkcell-blue/10 dark:bg-turkcell-yellow/15 border border-turkcell-blue/20 dark:border-turkcell-yellow/20 flex items-center justify-center text-turkcell-blue dark:text-turkcell-yellow font-bold">
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {offer.typeLabel}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{offer.code}</span>
                          </div>
                          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                            {offer.name}
                          </h3>
                        </div>
                      </div>

                      {/* Score & Discount */}
                      <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-800">
                        <div className="text-center px-2">
                          <div className="text-[10px] font-bold text-slate-500 uppercase">İndirim</div>
                          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">%{offer.discountPercent}</div>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
                        <div className="flex items-center space-x-2">
                          <ScoreRing score={offer.aiScore} size={48} />
                          <div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase">AI Öneri Skoru</div>
                            <div className="text-xs font-extrabold text-turkcell-blue dark:text-turkcell-yellow">Mükemmel Uyum</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* XAI Reasoning Box */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-start space-x-3">
                      <Info className="w-4 h-4 text-turkcell-blue dark:text-turkcell-yellow shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block">Açıklanabilir AI (XAI) Öneri Gerekçesi</span>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                          {offer.reasoning}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <span className="text-xs text-slate-500 font-medium">Son Geçerlilik: {offer.validUntil}</span>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleRespond(offer.id, 'REJECTED')}
                          className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 text-xs font-bold transition-all"
                        >
                          İlgilenmiyorum
                        </button>
                        <button
                          onClick={() => handleRespond(offer.id, 'ACCEPTED')}
                          className="px-6 py-2.5 rounded-xl bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy text-xs font-black hover:opacity-90 shadow-md transition-all flex items-center space-x-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Hemen Katıl & Faydalan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Accepted campaigns tab */}
        {activeTab === 'my_campaigns' && (
          <div className="space-y-4">
            {acceptedOffers.length === 0 ? (
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
                <Gift className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Henüz katıldığınız bir kampanya bulunmuyor</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">"Sana Özel Fırsatlar" sekmesinden kampanyalara katılarak faydalanabilirsiniz.</p>
              </div>
            ) : (
              acceptedOffers.map(offer => (
                <div key={offer.id} className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✓ Aktif Kullanımda</span>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">{offer.name}</h3>
                    </div>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">%{offer.discountPercent} İndirim</span>
                  </div>

                  {/* Rating box */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Teklif Deneyiminizi Puanlayın</div>
                      <div className="text-[11px] text-slate-500">Geri bildiriminiz AI öneri kalitesini iyileştirir</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          onClick={() => handleRate(offer.id, star)}
                          className="p-1 hover:scale-125 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${
                            (offer.userRating || 0) >= star
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-300 dark:text-slate-700'
                          }`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function SubscriberDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#050810] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-turkcell-blue animate-spin"></div>
      </div>
    }>
      <SubscriberDashboardContent />
    </Suspense>
  );
}
