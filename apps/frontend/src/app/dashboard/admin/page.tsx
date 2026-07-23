'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardShell from '../../components/DashboardShell';
import {
  Users, UserPlus, ShieldCheck, Lock, Unlock, Activity,
  ChevronDown, Check, X, Eye, EyeOff, AlertTriangle,
  Crown, Cpu, BarChart3, UserCheck, Search, Filter,
  ClipboardList, TrendingUp, Database, Server
} from 'lucide-react';

const API_GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';

type Role = 'SUBSCRIBER' | 'CAMPAIGN_EXPERT' | 'SUPERVISOR' | 'ADMIN';

interface User {
  id: string;
  role: Role;
  email?: string;
  gsmNumber?: string;
  firstName: string;
  lastName: string;
  expertiseTags: string[];
  region?: string;
  isLocked: boolean;
  lockedUntil?: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resourceId?: string;
  ipAddress?: string;
  result: string;
  detail?: Record<string, unknown>;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  experts: number;
  supervisors: number;
  admins: number;
  subscribers: number;
  lockedAccounts: number;
}

const ROLE_META: Record<Role, { label: string; color: string; icon: React.ElementType }> = {
  ADMIN: { label: 'Admin', color: 'text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20', icon: Crown },
  SUPERVISOR: { label: 'Süpervizör', color: 'text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/20', icon: BarChart3 },
  CAMPAIGN_EXPERT: { label: 'Uzman', color: 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Cpu },
  SUBSCRIBER: { label: 'Abone', color: 'text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-500/20', icon: UserCheck },
};

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'users' | 'create' | 'audit' | 'system'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');

  // Canlı mikroservis sağlık durumu (uydurma metrik yok — gerçek ping + ölçülen gecikme).
  const [health, setHealth] = useState<Record<string, { up: boolean; latency: number | null }>>({});
  const [healthChecking, setHealthChecking] = useState(false);

  useEffect(() => {
    if (tabParam && ['users', 'create', 'audit', 'system'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [tabParam]);

  // Create form
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'CAMPAIGN_EXPERT' as Role,
    expertiseTags: [] as string[],
    region: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('cc_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, statsRes, logsRes] = await Promise.all([
        fetch(`${API_GW}/api/v1/admin/users`, { headers }),
        fetch(`${API_GW}/api/v1/admin/stats`, { headers }),
        fetch(`${API_GW}/api/v1/admin/audit-logs?limit=50`, { headers }),
      ]);

      if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.data || d); }
      if (statsRes.ok) { const d = await statsRes.json(); setStats(d.data || d); }
      if (logsRes.ok) { const d = await logsRes.json(); setAuditLogs(d.data || []); }
    } catch {
      // Sahte mock fallback YOK — servis erişilemezse liste boş kalır (dürüst durum).
      setUsers([]);
      setStats(null);
      setAuditLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Her servis için gateway üzerinden gerçek bir uç noktayı yoklar; 5xx/ağ hatası → DOWN.
  const SERVICES: { key: string; name: string; port: string; db: string; url: string }[] = [
    { key: 'gateway', name: 'API Gateway', port: '8080', db: '—', url: `${API_GW}/api/v1/health` },
    { key: 'identity', name: 'Identity Service', port: '3001', db: 'identity-db (5433)', url: `${API_GW}/api/v1/admin/stats` },
    { key: 'campaign', name: 'Campaign Service', port: '3002', db: 'campaign-db (5434)', url: `${API_GW}/api/v1/campaigns?limit=1` },
    { key: 'ai', name: 'AI Machine Learning', port: '8000', db: 'ai-db (5435)', url: `${API_GW}/api/v1/ai/health` },
    { key: 'gamification', name: 'Gamification Service', port: '3003', db: 'gamification-db (5436)', url: `${API_GW}/api/v1/game/leaderboard?period=ALL_TIME` },
  ];

  const checkHealth = async () => {
    setHealthChecking(true);
    const results: Record<string, { up: boolean; latency: number | null }> = {};
    await Promise.all(SERVICES.map(async (s) => {
      const t0 = performance.now();
      try {
        const res = await fetch(s.url, { headers });
        const latency = Math.round(performance.now() - t0);
        // 503 = gateway hedefe ulaşamadı (servis down). Diğer tüm yanıtlar (200/401/403) servis ayakta demek.
        results[s.key] = { up: res.status !== 503 && res.status < 500, latency };
      } catch {
        results[s.key] = { up: false, latency: null };
      }
    }));
    setHealth(results);
    setHealthChecking(false);
  };

  useEffect(() => { if (activeTab === 'system') checkHealth(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [activeTab]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const res = await fetch(`${API_GW}/api/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setCreateSuccess(`✓ ${form.role} hesabı (${form.email}) başarıyla oluşturuldu.`);
        setForm({ firstName: '', lastName: '', email: '', password: '', role: 'CAMPAIGN_EXPERT', expertiseTags: [], region: '' });
        loadData();
      } else {
        setCreateError(data?.error?.message || data.message || 'Hesap oluşturulurken hata oluştu.');
      }
    } catch {
      // Sahte başarı mesajı YOK.
      setCreateError('Sunucuya ulaşılamadı. Hesap oluşturulamadı.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUnlock = async (userId: string) => {
    try {
      await fetch(`${API_GW}/api/v1/admin/users/${userId}/unlock`, { method: 'PATCH', headers });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isLocked: false } : u));
    } catch { /* demo */ }
  };

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      await fetch(`${API_GW}/api/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ role: newRole }),
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch { /* demo */ }
  };

  const filteredUsers = users.filter(u => {
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchSearch = searchQuery === '' ||
      `${u.firstName} ${u.lastName} ${u.email || ''} ${u.gsmNumber || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchSearch;
  });

  const expertiseTags = ['CHURN_PREVENTION', 'RISKLI_KAYIP', 'YUKSEK_DEGER', 'YENI_ABONE', 'TARIFE_YUKSELTME', 'EK_PAKET', 'CIHAZ_FIRSATI', 'SADAKAT'];

  return (
    <DashboardShell
      role="ADMIN"
      userName="Sistem Yöneticisi"
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Turkcell Sistem Yönetim Paneli</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Kullanıcı yönetimi, personel tanımlama ve güvenlik audit kayıtları</p>
          </div>
          <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
            <Crown className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-xs text-red-700 dark:text-red-400 font-bold uppercase tracking-wider">Turkcell Admin</span>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Toplam Kullanıcı', value: stats.totalUsers, icon: Users, color: 'text-slate-900 dark:text-white' },
              { label: 'Uzman', value: stats.experts, icon: Cpu, color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Süpervizör', value: stats.supervisors, icon: BarChart3, color: 'text-purple-600 dark:text-purple-400' },
              { label: 'Admin', value: stats.admins, icon: Crown, color: 'text-red-600 dark:text-red-400' },
              { label: 'Abone', value: stats.subscribers, icon: UserCheck, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Kilitli Hesap', value: stats.lockedAccounts, icon: Lock, color: stats.lockedAccounts > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400' },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
                <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-1 bg-slate-200/60 dark:bg-slate-900/60 p-1 rounded-xl w-fit border border-slate-300/40 dark:border-slate-800">
          {[
            { key: 'users', label: 'Kullanıcı Listesi', icon: Users },
            { key: 'create', label: 'Personel Ekle', icon: UserPlus },
            { key: 'audit', label: 'Audit Loglar', icon: ClipboardList },
            { key: 'system', label: 'Sistem Performansı', icon: Activity },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as typeof activeTab);
                window.history.pushState(null, '', `?tab=${tab.key}`);
              }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-turkcell-navy text-white dark:bg-turkcell-yellow dark:text-turkcell-navy shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="İsim, e-posta veya GSM ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow"
                />
              </div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as typeof roleFilter)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="ALL">Tüm Roller</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPERVISOR">Süpervizör</option>
                <option value="CAMPAIGN_EXPERT">Uzman</option>
                <option value="SUBSCRIBER">Abone</option>
              </select>
              <span className="text-xs text-slate-500 font-medium ml-auto">{filteredUsers.length} kullanıcı bulundu</span>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Yükleniyor...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-left bg-slate-50/50 dark:bg-slate-900/30">
                      {['Ad Soyad', 'Rol', 'İletişim', 'Bölge / Uzmanlık', 'Durum', 'Kayıt Tarihi', 'İşlem'].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredUsers.map(user => {
                      const meta = ROLE_META[user.role];
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border ${meta.color}`}>
                                {user.firstName[0]}{user.lastName[0]}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{user.firstName} {user.lastName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <select
                              value={user.role}
                              onChange={e => handleRoleChange(user.id, e.target.value as Role)}
                              className={`text-xs px-2.5 py-1 rounded-full border font-bold bg-transparent ${meta.color} cursor-pointer focus:outline-none`}
                            >
                              {Object.entries(ROLE_META).map(([k, v]) => (
                                <option key={k} value={k} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{v.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-medium">
                            {user.email || user.gsmNumber || '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {user.region && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                                  {user.region}
                                </span>
                              )}
                              {user.expertiseTags?.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200/40 dark:border-blue-900/40">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            {user.isLocked ? (
                              <span className="inline-flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-semibold">
                                <Lock className="w-3 h-3" />
                                <span>Kilitli</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <Check className="w-3 h-3" />
                                <span>Aktif</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 font-medium">
                            {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                          </td>
                          <td className="px-4 py-3.5">
                            {user.isLocked && (
                              <button
                                onClick={() => handleUnlock(user.id)}
                                className="flex items-center space-x-1 text-xs text-emerald-600 hover:text-emerald-700 font-bold transition-colors"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Kilidi Aç</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Create User Tab */}
        {activeTab === 'create' && (
          <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-2xl shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-turkcell-blue/10 dark:bg-turkcell-yellow/10 border border-turkcell-blue/20 dark:border-turkcell-yellow/20 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-turkcell-blue dark:text-turkcell-yellow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Yeni Personel Hesabı Oluştur</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Turkcell Kurumsal şifre politikasına uygun Uzman veya Süpervizör ekleyin</p>
              </div>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center space-x-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}
            {createSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-center space-x-2 font-medium">
                <Check className="w-4 h-4 shrink-0" />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Ad</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow"
                    placeholder="Ahmet"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Soyad</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow"
                    placeholder="Yılmaz"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">E-Posta Adresi</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow"
                  placeholder="uzman@turkcell.com.tr"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">
                  Parola <span className="text-slate-400 font-normal">(Min 8 kar, 1 büyük harf, 1 rakam, 1 özel karakter)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-turkcell-blue dark:focus:border-turkcell-yellow"
                    placeholder="Turkcell2026!"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Rol</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(p => ({ ...p, role: e.target.value as Role }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none"
                  >
                    <option value="CAMPAIGN_EXPERT">Kampanya Uzmanı</option>
                    <option value="SUPERVISOR">Süpervizör</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Bölge</label>
                  <select
                    value={form.region}
                    onChange={e => setForm(p => ({ ...p, region: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none"
                  >
                    <option value="">Seçiniz...</option>
                    {['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.role === 'CAMPAIGN_EXPERT' && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1.5">Uzmanlık Alanları</label>
                  <div className="flex flex-wrap gap-1.5">
                    {expertiseTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setForm(p => ({
                          ...p,
                          expertiseTags: p.expertiseTags.includes(tag)
                            ? p.expertiseTags.filter(t => t !== tag)
                            : [...p.expertiseTags, tag]
                        }))}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                          form.expertiseTags.includes(tag)
                            ? 'bg-turkcell-blue text-white border-turkcell-blue dark:bg-turkcell-yellow dark:text-turkcell-navy dark:border-turkcell-yellow'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {form.expertiseTags.includes(tag) && <Check className="w-3 h-3 inline mr-1" />}
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating}
                className="w-full py-3 mt-4 rounded-xl bg-turkcell-navy text-white dark:bg-gradient-to-r dark:from-turkcell-yellow dark:to-amber-400 dark:text-turkcell-navy font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center space-x-2 shadow-md disabled:opacity-60"
              >
                {isCreating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Hesabı Oluştur ve Kaydet</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Son 50 Güvenlik & İşlem Kaydı (Audit Log)</h2>
              <p className="text-xs text-slate-500 mt-0.5">Giriş denemeleri, rol değişiklikleri, 403 yetkisiz erişimler ve hesap kilitlemeleri</p>
            </div>
            {auditLogs.length === 0 ? (
              <div className="p-10 text-center">
                <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">Henüz kayıtlı audit log bulunmuyor.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                      {['Zaman', 'İşlem', 'Kaynak ID', 'IP Adresi', 'Sonuç'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-slate-500 font-bold uppercase tracking-wider text-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-300 font-mono font-medium">{log.action}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-mono">{log.resourceId || '—'}</td>
                        <td className="px-4 py-2.5 text-slate-500">{log.ipAddress || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.result === 'SUCCESS'
                              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                          }`}>
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* System Performance Tab — CANLI health check (uydurma metrik yok) */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {(() => {
              const upCount = SERVICES.filter(s => health[s.key]?.up).length;
              const checked = Object.keys(health).length > 0;
              const gwLatency = health['gateway']?.latency;
              const kpis = [
                { label: 'Aktif Servis', val: checked ? `${upCount}/${SERVICES.length}` : '—', desc: 'Gateway üzerinden canlı yoklama', icon: ShieldCheck, color: upCount === SERVICES.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400' },
                { label: 'Gateway Gecikmesi', val: gwLatency != null ? `${gwLatency} ms` : '—', desc: 'Ölçülen gerçek yanıt süresi', icon: Server, color: 'text-turkcell-blue dark:text-turkcell-yellow' },
                { label: 'Veritabanı Mimarisi', val: '4× PostgreSQL', desc: 'Database-per-service', icon: Database, color: 'text-purple-600 dark:text-purple-400' },
                { label: 'Son Kontrol', val: checked ? 'Canlı' : '—', desc: healthChecking ? 'Yoklanıyor...' : 'Yenile ile güncelle', icon: Activity, color: 'text-red-600 dark:text-red-400' },
              ];
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {kpis.map((kpi, i) => (
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
              );
            })()}

            <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Mikroservis Sağlık Durumu (Canlı Health Check)</h3>
                <button onClick={checkHealth} disabled={healthChecking} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 disabled:opacity-60">
                  {healthChecking ? 'Yoklanıyor...' : 'Yenile'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {SERVICES.map((s) => {
                  const h = health[s.key];
                  const up = h?.up;
                  return (
                    <div key={s.key} className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white">{s.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                          up === undefined ? 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            : up ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'
                        }`}>
                          {up === undefined ? '—' : up ? 'UP' : 'DOWN'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">Port: <span className="font-mono text-slate-900 dark:text-white">{s.port}</span></div>
                      <div className="text-[11px] text-slate-500">DB: <span className="font-mono text-slate-900 dark:text-white">{s.db}</span></div>
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        {h?.latency != null ? `${h.latency} ms` : up === false ? 'Yanıt yok' : '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-[#050810] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin"></div>
      </div>
    }>
      <AdminDashboardContent />
    </Suspense>
  );
}
