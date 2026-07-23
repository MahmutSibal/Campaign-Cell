'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles, Cpu, Award, Zap, ShieldCheck, ArrowRight,
  UserCheck, BarChart3, Database, Radio, GitBranch,
  Lock, Brain, Trophy, Target, Layers, Clock, Shield
} from 'lucide-react';
import ThemeToggle from './components/ThemeToggle';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050810] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      {/* ===== HEADER ===== */}
      <header className="border-b border-slate-200 dark:border-white/5 backdrop-blur-xl sticky top-0 z-50 bg-white/80 dark:bg-[#050810]/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-turkcell-yellow via-amber-400 to-turkcell-blue flex items-center justify-center font-black text-turkcell-navy text-lg shadow-md shadow-turkcell-yellow/20">
              CC
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-turkcell-navy dark:text-white">
                Campaign<span className="text-amber-500 dark:text-turkcell-yellow">Cell</span>
              </span>
              <span className="block text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                Turkcell CodeNight 2026 Final
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700/60 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-turkcell-blue dark:hover:border-turkcell-yellow transition-all duration-300"
            >
              Giriş Yap
            </Link>
            <Link
              href="/dashboard/expert"
              className="px-5 py-2.5 rounded-xl bg-turkcell-navy dark:bg-gradient-to-r dark:from-turkcell-blue dark:to-blue-600 text-white text-xs font-black shadow-md hover:scale-[1.02] transition-all duration-300 flex items-center space-x-2"
            >
              <span>Platforma Git</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 pt-16 pb-16">
          <div className="text-center max-w-4xl mx-auto mb-16 space-y-6">
            <div className="inline-flex items-center space-x-2 px-5 py-2 rounded-full bg-turkcell-blue/10 dark:bg-turkcell-yellow/15 border border-turkcell-blue/20 dark:border-turkcell-yellow/20 text-turkcell-blue dark:text-turkcell-yellow text-xs font-extrabold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Doğru Teklif • Doğru Müşteri • Doğru Zaman</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.15] text-slate-900 dark:text-white">
              Yapay Zeka Destekli<br />
              <span className="text-turkcell-blue dark:text-turkcell-yellow">Turkcell Kişiselleştirilmiş</span> Kampanya Platformu
            </h1>

            <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto font-medium">
              4 bağımsız mikroservis, scikit-learn ML motoru, event-driven oyunlaştırma ve
              katı SLA takibi ile Turkcell abonelerine en doğru fırsatı sunun.
            </p>

            <div className="flex items-center justify-center space-x-4 pt-2">
              <Link
                href="/login"
                className="px-8 py-3.5 rounded-2xl bg-turkcell-navy text-white dark:bg-gradient-to-r dark:from-turkcell-yellow dark:via-amber-400 dark:to-turkcell-gold dark:text-turkcell-navy font-black text-sm shadow-lg hover:scale-[1.02] transition-all duration-300 flex items-center space-x-3"
              >
                <span>Platforma Giriş Yap</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* ===== ROLE PORTALS ===== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {/* Subscriber */}
            <Link href="/dashboard/subscriber" className="group">
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 h-full flex flex-col justify-between shadow-sm hover:shadow-md hover:border-turkcell-blue transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-all">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1.5">Abone Portalı</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-medium">
                      AI tarafından kişiselleştirilmiş kampanyaları inceleyin, teklifleri kabul/ret edin,
                      XAI açıklamalarını görün ve 1-5 yıldız ile değerlendirin.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-500/15">AI Önerileri</span>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-500/15">XAI Açıklama</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center space-x-2 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                  <span>Abone Ekranına Git</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Expert */}
            <Link href="/dashboard/expert" className="group">
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 h-full flex flex-col justify-between shadow-sm hover:shadow-md hover:border-amber-400 transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-turkcell-yellow/20 border border-amber-200 dark:border-turkcell-yellow/20 flex items-center justify-center text-amber-600 dark:text-turkcell-yellow group-hover:scale-105 transition-all">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1.5">Kampanya Uzmanı</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-medium">
                      Atanan vakaları optimize edin, state machine adımlarını ilerletin, A/B testi uygulayın, AI segmentini override edin ve rozetler kazanın.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-500/15">State Machine</span>
                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-500/15">SLA Takibi</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center space-x-2 text-xs font-bold text-amber-600 dark:text-turkcell-yellow group-hover:translate-x-1 transition-transform">
                  <span>Uzman Paneline Git</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Supervisor */}
            <Link href="/dashboard/supervisor" className="group">
              <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 h-full flex flex-col justify-between shadow-sm hover:shadow-md hover:border-purple-400 transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-all">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1.5">Süpervizör Paneli</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-medium">
                      Kampanya segment dağılımı, dönüşüm oranları, AI model isabet yüzdesi, SLA ihlal uyarısı ve liderlik sıralamasını izleyin.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-bold border border-purple-200 dark:border-purple-500/15">Liderlik Tablosu</span>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-[10px] font-bold border border-purple-200 dark:border-purple-500/15">AI Metrikleri</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center space-x-2 text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform">
                  <span>Süpervizör Paneline Git</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-slate-200 dark:border-white/5 py-8 bg-white dark:bg-[#050810]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-turkcell-navy dark:text-white">CampaignCell</span>
            <span>— Turkcell CodeNight 2026 Final Ekosistemi</span>
          </div>
          <div>4 Bağımsız Mikroservis • Database-per-service • Event-driven RabbitMQ</div>
        </div>
      </footer>
    </div>
  );
}
