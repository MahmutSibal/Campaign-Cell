import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Megaphone,
  FileCheck,
  Users,
  Brain,
  FlaskConical,
  Trophy,
  Award,
  User,
  BarChart3,
  Shield,
  Settings,
  FileText,
  UserPlus,
} from 'lucide-react';
import type { UserProfile } from '@workspace/api-client-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserProfile['role'][];
}

const navItems: NavItem[] = [
  // Subscriber
  {
    label: 'My Offers',
    href: '/portal',
    icon: LayoutDashboard,
    roles: ['SUBSCRIBER'],
  },
  {
    label: 'My Profile',
    href: '/portal/profile',
    icon: User,
    roles: ['SUBSCRIBER'],
  },
  
  // Campaign Expert
  {
    label: 'Dashboard',
    href: '/expert',
    icon: LayoutDashboard,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'Campaigns',
    href: '/expert/campaigns',
    icon: Megaphone,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'My Cases',
    href: '/expert/cases',
    icon: FileCheck,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'AI Insights',
    href: '/expert/ai',
    icon: Brain,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'Experiments',
    href: '/expert/experiments',
    icon: FlaskConical,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'Customer 360',
    href: '/expert/customer360',
    icon: Users,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'Leaderboard',
    href: '/expert/leaderboard',
    icon: Trophy,
    roles: ['CAMPAIGN_EXPERT'],
  },
  {
    label: 'Achievements',
    href: '/expert/achievements',
    icon: Award,
    roles: ['CAMPAIGN_EXPERT'],
  },

  // Supervisor
  {
    label: 'Intelligence Center',
    href: '/supervisor',
    icon: BarChart3,
    roles: ['SUPERVISOR'],
  },
  {
    label: 'All Cases',
    href: '/supervisor/cases',
    icon: FileCheck,
    roles: ['SUPERVISOR'],
  },
  {
    label: 'Bekleyen Kuyruk',
    href: '/supervisor/queue',
    icon: UserPlus,
    roles: ['SUPERVISOR'],
  },
  {
    label: 'Expert Performance',
    href: '/supervisor/performance',
    icon: Users,
    roles: ['SUPERVISOR'],
  },
  {
    label: 'AI Accuracy',
    href: '/supervisor/ai-accuracy',
    icon: Brain,
    roles: ['SUPERVISOR'],
  },

  // Admin
  {
    label: 'Admin Panel',
    href: '/admin',
    icon: Shield,
    roles: ['ADMIN'],
  },
  {
    label: 'User Management',
    href: '/admin/users',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    label: 'Audit Log',
    href: '/admin/audit',
    icon: FileText,
    roles: ['ADMIN'],
  },
];

interface SidebarProps {
  role: UserProfile['role'];
}

export function Sidebar({ role }: SidebarProps) {
  const [location] = useLocation();
  
  const filteredItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-64 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
          <span className="text-sidebar-primary-foreground font-bold">CC</span>
        </div>
        <div>
          <div className="font-semibold text-base">CampaignCell</div>
          <div className="text-xs text-sidebar-foreground/70">Campaign Intelligence</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 p-4">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              data-testid={`link-nav-${item.href.replace(/\//g, '-')}`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
