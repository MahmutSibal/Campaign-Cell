import { AppHeader } from '@/components/AppHeader';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useBadgeNotifications } from '@/hooks/use-badge-notifications';
import { useLocation } from 'wouter';
import { useEffect } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation('/login');
    }
  }, [user, setLocation]);

  // Badges/points are earned by campaign experts only; gating on role keeps
  // the stream from opening needlessly for subscribers/supervisors/admins.
  useBadgeNotifications(user?.role === 'CAMPAIGN_EXPERT' ? user.id : undefined);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} />
      <div className="pl-64">
        <AppHeader />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
