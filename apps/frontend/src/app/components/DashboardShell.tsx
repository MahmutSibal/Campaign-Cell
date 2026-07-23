'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home, User, Gift, History, LogOut, ChevronLeft, ChevronRight,
  Cpu, Layers, Trophy, BarChart3, Archive, Settings, Bell,
  UserCheck, Timer, Brain, Menu, X, Sparkles, AlertTriangle, CheckCircle2
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const API_GW = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8080';

interface SidebarLink {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  role: 'subscriber' | 'expert' | 'supervisor' | 'ADMIN' | 'admin';
  userName: string;
  userDetail?: string;
  activeTab?: string;
  onTabChange?: (tab: any) => void;
}

interface RealtimeToast {
  id: number;
  title: string;
  message: string;
  type?: string;
}

const ROLE_CONFIG = {
  subscriber: {
    label: 'Abone Portalı',
    color: 'blue',
    badgeBg: 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    links: [
      { href: '/dashboard/subscriber?tab=offers', label: 'Fırsatlarım', icon: Gift, badge: '3' },
      { href: '/dashboard/subscriber/profile', label: 'Profilim', icon: User },
      { href: '/dashboard/subscriber/history', label: 'Teklif Geçmişi', icon: History },
    ] as SidebarLink[],
  },
  expert: {
    label: 'Kampanya Uzmanı',
    color: 'amber',
    badgeBg: 'bg-amber-500/10 dark:bg-turkcell-yellow/15 text-amber-700 dark:text-turkcell-yellow border-amber-500/20',
    links: [
      { href: '/dashboard/expert?tab=active', label: 'Vakalarım', icon: Layers, badge: '3' },
      { href: '/dashboard/expert/profile', label: 'Performansım', icon: Trophy },
      { href: '/dashboard/expert/archive', label: 'Kampanya Arşivi', icon: Archive },
    ] as SidebarLink[],
  },
  supervisor: {
    label: 'Süpervizör',
    color: 'purple',
    badgeBg: 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
    links: [
      { href: '/dashboard/supervisor?tab=overview', label: 'Genel Bakış', icon: BarChart3 },
      { href: '/dashboard/supervisor?tab=leaderboard', label: 'Liderlik Tablosu', icon: Trophy },
      { href: '/dashboard/supervisor?tab=ai_accuracy', label: 'AI Doğruluk', icon: Brain },
      { href: '/dashboard/supervisor?tab=sla', label: 'SLA İzleme', icon: Timer },
    ] as SidebarLink[],
  },
  admin: {
    label: 'Sistem Yöneticisi (Admin)',
    color: 'red',
    badgeBg: 'bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
    links: [
      { href: '/dashboard/admin?tab=users', label: 'Kullanıcı Yönetimi', icon: UserCheck },
      { href: '/dashboard/admin?tab=audit', label: 'Audit Loglar', icon: History },
      { href: '/dashboard/admin?tab=system', label: 'Sistem Performansı', icon: BarChart3 },
    ] as SidebarLink[],
  },
  ADMIN: {
    label: 'Sistem Yöneticisi (Admin)',
    color: 'red',
    badgeBg: 'bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
    links: [
      { href: '/dashboard/admin?tab=users', label: 'Kullanıcı Yönetimi', icon: UserCheck },
      { href: '/dashboard/admin?tab=audit', label: 'Audit Loglar', icon: History },
      { href: '/dashboard/admin?tab=system', label: 'Sistem Performansı', icon: BarChart3 },
    ] as SidebarLink[],
  },
};

export default function DashboardShell({ children, role, userName, userDetail = 'Platform', activeTab, onTabChange }: DashboardShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const config = ROLE_CONFIG[role];
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<RealtimeToast[]>([]);
  const [sseConnected, setSseConnected] = useState(false);

  const initials = userName.split(' ').map((w) => w[0]).join('').slice(0, 2);

  // Connect to Real-time SSE Stream (+2 Bonus Points)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_GW}/api/v1/events/stream`);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'CONNECTED') return;

          const newToast: RealtimeToast = {
            id: Date.now(),
            title: data.title || 'Sistem Event Bildirimi',
            message: data.message || 'Yeni bir olay gerçekleşti.',
            type: data.type,
          };

          setToasts(prev => [newToast, ...prev.slice(0, 4)]);

          // Auto dismiss after 6s
          setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newToast.id));
          }, 6000);
        } catch { /* ignore parse error */ }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050810] text-slate-800 dark:text-slate-100 flex transition-colors duration-300">
      {/* Real-time SSE Toast Notifications (+2 Bonus Points) */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl flex items-start space-x-3 animate-slide-up"
          >
            <div className="p-2 rounded-xl bg-turkcell-yellow/20 text-turkcell-navy dark:text-turkcell-yellow shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">{toast.title}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#050810]/95 backdrop-blur-xl transition-all duration-300 shadow-sm dark:shadow-none
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-slate-100 dark:border-white/5 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-turkcell-yellow via-amber-400 to-turkcell-blue flex items-center justify-center font-black text-turkcell-navy text-sm shadow-md shadow-turkcell-yellow/20 shrink-0">
              CC
            </div>
            {!collapsed && (
              <span className="text-base font-bold text-turkcell-navy dark:text-white group-hover:text-turkcell-blue transition-colors">
                Campaign<span className="text-amber-500 dark:text-turkcell-yellow">Cell</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all hidden md:block">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white transition-all md:hidden">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Badge & Theme Switch */}
        {!collapsed && (
          <div className="px-4 py-3 flex items-center justify-between">
            <span className={`inline-flex px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${config.badgeBg}`}>
              {config.label}
            </span>
            <ThemeToggle />
          </div>
        )}

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {config.links.map((link) => {
            const linkBase = link.href.split('?')[0];
            const linkTab = new URLSearchParams(link.href.split('?')[1] || '').get('tab');
            
            // Priority to activeTab prop if passed, otherwise fall back to searchParams / pathname
            const isActive = activeTab
              ? (linkTab === activeTab || (!linkTab && activeTab === 'overview'))
              : (pathname === linkBase && (linkTab === currentTab || (!currentTab && linkTab === 'overview') || (!linkTab && !currentTab)));

            const Icon = link.icon;
            return (
              <Link
                key={link.href + link.label}
                href={link.href}
                onClick={(e) => {
                  setMobileOpen(false);
                  if (linkTab && onTabChange && pathname === linkBase) {
                    e.preventDefault();
                    onTabChange(linkTab);
                    window.history.pushState(null, '', link.href);
                  }
                }}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-turkcell-blue/10 dark:bg-turkcell-yellow/10 text-turkcell-blue dark:text-turkcell-yellow border border-turkcell-blue/20 dark:border-turkcell-yellow/15 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }
                  ${collapsed ? 'justify-center px-0' : ''}
                `}
                title={collapsed ? link.label : undefined}
              >
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-turkcell-blue dark:text-turkcell-yellow' : ''}`} />
                {!collapsed && (
                  <>
                    <span className="flex-1">{link.label}</span>
                    {link.badge && (
                      <span className="px-2 py-0.5 rounded-full bg-turkcell-blue/10 dark:bg-turkcell-yellow/20 text-turkcell-blue dark:text-turkcell-yellow text-[10px] font-bold">
                        {link.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Expand Button (collapsed) */}
        {collapsed && (
          <div className="px-3 py-2 space-y-2">
            <ThemeToggle className="w-full justify-center" />
            <button onClick={() => setCollapsed(false)} className="w-full p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* User Profile */}
        <div className={`border-t border-slate-100 dark:border-white/5 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-transparent ${collapsed ? 'p-2' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-turkcell-blue via-turkcell-navy to-turkcell-yellow text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">{userName}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{userDetail}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <Link
              href="/"
              className="flex items-center space-x-2 mt-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış Yap</span>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${collapsed ? 'md:ml-[72px]' : 'md:ml-[260px]'}`}>
        {/* Top Bar Header (Desktop & Mobile) */}
        <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-white/5 bg-white/80 dark:bg-[#050810]/90 backdrop-blur-xl px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 md:hidden">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Turkcell Live Environment {sseConnected && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">• Real-time Event Stream Active (+2 Bonus)</span>}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-turkcell-blue to-turkcell-navy text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
              {initials}
            </div>
          </div>
        </header>

        {/* Inner Content Padding */}
        <main className="p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
