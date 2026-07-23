'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Phone, ArrowRight, ShieldCheck, UserCheck, Cpu, BarChart3, Eye, EyeOff, MessageSquare, Crown } from 'lucide-react';
import { api } from '../../lib/api';
import ThemeToggle from '../components/ThemeToggle';

const API_GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<'SUBSCRIBER' | 'CAMPAIGN_EXPERT' | 'SUPERVISOR' | 'ADMIN'>('CAMPAIGN_EXPERT');
  const [identifier, setIdentifier] = useState('uzman@turkcell.com.tr');
  const [password, setPassword] = useState('Turkcell2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP flow states
  const [otpStep, setOtpStep] = useState<'phone' | 'otp'>('phone');
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);

  const handleSendOtp = async () => {
    setOtpSending(true);
    setError('');
    try {
      const res = await fetch(`${API_GW}/api/v1/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gsmNumber: identifier.replace(/\s/g, '') }),
      });
      if (res.ok) {
        setOtpStep('otp');
      } else {
        setError('OTP gönderilemedi. Numarayı kontrol edin.');
      }
    } catch {
      // Fallback: go straight to OTP step in simulation
      setOtpStep('otp');
    } finally {
      setOtpSending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (role === 'SUBSCRIBER') {
        // OTP verify
        const res = await fetch(`${API_GW}/api/v1/auth/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gsmNumber: identifier.replace(/\s/g, ''), otpCode }),
        });
        const data = await res.json();
        if (res.ok && (data.access_token || data.accessToken)) {
          const tok = data.access_token || data.accessToken;
          api.setToken(tok);
          localStorage.setItem('cc_token', tok);
          localStorage.setItem('cc_user', JSON.stringify(data.user));
          router.push('/dashboard/subscriber');
          return;
        } else {
          setError(data.message || 'Geçersiz OTP kodu.');
          setIsLoading(false);
          return;
        }
      } else {
        // Email + password login
        const res = await fetch(`${API_GW}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json();
        if (res.ok && (data.access_token || data.accessToken)) {
          const tok = data.access_token || data.accessToken;
          api.setToken(tok);
          localStorage.setItem('cc_token', tok);
          localStorage.setItem('cc_user', JSON.stringify(data.user));
          if (role === 'SUPERVISOR') {
            router.push('/dashboard/supervisor');
          } else if (role === 'ADMIN') {
            router.push('/dashboard/admin');
          } else {
            router.push('/dashboard/expert');
          }
          return;
        } else {
          setError(data.message || 'E-posta veya parola hatalı.');
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Demo navigation
      if (role === 'SUBSCRIBER') router.push('/dashboard/subscriber');
      else if (role === 'SUPERVISOR') router.push('/dashboard/supervisor');
      else if (role === 'ADMIN') router.push('/dashboard/admin');
      else router.push('/dashboard/expert');
    }
  };

  const roles = [
    {
      key: 'SUBSCRIBER' as const,
      label: 'Abone',
      icon: UserCheck,
      desc: 'GSM + OTP',
      defaultId: '05551112233',
    },
    {
      key: 'CAMPAIGN_EXPERT' as const,
      label: 'Uzman',
      icon: Cpu,
      desc: 'E-Posta + Şifre',
      defaultId: 'uzman@turkcell.com.tr',
    },
    {
      key: 'SUPERVISOR' as const,
      label: 'Süpervizör',
      icon: BarChart3,
      desc: 'E-Posta + Şifre',
      defaultId: 'supervisor@turkcell.com.tr',
    },
    {
      key: 'ADMIN' as const,
      label: 'Admin',
      icon: Crown,
      desc: 'Sistem Yöneticisi',
      defaultId: 'admin@turkcell.com.tr',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050810] flex flex-col justify-between px-4 py-8 transition-colors duration-300">
      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <Link href="/" className="inline-flex items-center space-x-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-turkcell-yellow via-amber-400 to-turkcell-blue flex items-center justify-center font-black text-turkcell-navy text-base shadow-md shadow-turkcell-yellow/20">
            CC
          </div>
          <span className="text-xl font-extrabold text-turkcell-navy dark:text-white">
            Campaign<span className="text-amber-500 dark:text-turkcell-yellow">Cell</span>
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/50 dark:shadow-none">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Turkcell Platform Girişi</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Devam etmek için giriş rolünüzü ve bilgilerinizi giriniz</p>
          </div>

          {/* Role Selector */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold mb-2.5">
              Giriş Rolü Seçin
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {roles.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    setRole(r.key);
                    setIdentifier(r.defaultId);
                    setOtpStep('phone');
                    setOtpCode('');
                    setError('');
                  }}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    role === r.key
                      ? 'bg-turkcell-navy text-white border-turkcell-navy dark:bg-turkcell-yellow dark:text-turkcell-navy dark:border-turkcell-yellow shadow-md scale-[1.02]'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <r.icon className="w-4 h-4 mx-auto mb-1.5 opacity-90" />
                  <div className="text-xs font-extrabold">{r.label}</div>
                  <div className="text-[9px] opacity-75 font-medium">{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {role === 'SUBSCRIBER' ? 'GSM Numarası' : 'E-Posta Adresi'}
              </label>
              <div className="relative">
                {role === 'SUBSCRIBER' ? (
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                ) : (
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                )}
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={role === 'SUBSCRIBER' && otpStep === 'otp'}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow font-medium placeholder:text-slate-400 disabled:opacity-50"
                  placeholder={role === 'SUBSCRIBER' ? '05551112233' : 'email@turkcell.com.tr'}
                  required
                />
              </div>
            </div>

            {/* Subscriber OTP Flow */}
            {role === 'SUBSCRIBER' ? (
              otpStep === 'phone' ? (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending}
                  className="w-full py-3 rounded-xl border border-blue-200 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center space-x-2 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-all disabled:opacity-60"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{otpSending ? 'SMS Gönderiliyor...' : 'SMS OTP Kodu Gönder'}</span>
                </button>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    OTP Kodu <span className="text-amber-600 dark:text-turkcell-yellow font-medium">(Simülasyon: 1234)</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={4}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow tracking-[0.5em] text-center font-mono placeholder:text-slate-400 placeholder:tracking-normal font-bold"
                      placeholder="1234"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOtpStep('phone'); setOtpCode(''); }}
                    className="mt-2 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium transition-colors"
                  >
                    ← Numarayı değiştir
                  </button>
                </div>
              )
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Parola</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow font-medium placeholder:text-slate-400"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Submit Button */}
            {(role !== 'SUBSCRIBER' || otpStep === 'otp') && (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-xl bg-turkcell-navy text-white dark:bg-gradient-to-r dark:from-turkcell-yellow dark:via-amber-400 dark:to-turkcell-gold dark:text-turkcell-navy font-black text-xs hover:opacity-90 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-turkcell-navy/10 dark:shadow-turkcell-yellow/20 disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 dark:border-turkcell-navy/30 border-t-white dark:border-t-turkcell-navy rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {role === 'SUBSCRIBER'
                        ? 'Abone Portalına Giriş Yap'
                        : role === 'SUPERVISOR'
                        ? 'Süpervizör Paneline Giriş Yap'
                        : role === 'ADMIN'
                        ? 'Admin Paneline Giriş Yap'
                        : 'Uzman Paneline Giriş Yap'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </form>

          {/* Security Banner */}
          <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl flex items-start space-x-3">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs text-blue-900 dark:text-blue-300 font-bold">Turkcell Güvenli Giriş & Token Rotation</p>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                JWT Access (15dk) + Refresh Token Rotation (7 gün). 5 hatalı girişte 15dk hesap kilidi.
              </p>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Hesabınız yok mu? </span>
            <Link href="/register" className="text-xs text-turkcell-blue dark:text-turkcell-yellow font-extrabold hover:underline">
              Hemen Abone Kaydı Oluşturun
            </Link>
          </div>
        </div>
      </div>

      {/* Footer Link */}
      <div className="text-center">
        <Link href="/" className="text-xs text-slate-500 hover:text-turkcell-navy dark:hover:text-turkcell-yellow font-medium transition-colors">
          ← Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
