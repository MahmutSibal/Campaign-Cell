import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import Landing from '@/pages/landing';
import Login from '@/pages/login';
import NotFound from '@/pages/not-found';

import SubscriberPortal from '@/pages/subscriber-portal';
import SubscriberProfile from '@/pages/subscriber-profile';

import ExpertDashboard from '@/pages/expert-dashboard';
import ExpertCampaigns from '@/pages/expert-campaigns';
import ExpertCases from '@/pages/expert-cases';
import ExpertCaseDetail from '@/pages/expert-case-detail';
import ExpertAIInsights from '@/pages/expert-ai-insights';
import ExpertExperiments from '@/pages/expert-experiments';
import ExpertCustomer360 from '@/pages/expert-customer360';
import ExpertLeaderboard from '@/pages/expert-leaderboard';
import ExpertAchievements from '@/pages/expert-achievements';

import SupervisorDashboard from '@/pages/supervisor-dashboard';
import SupervisorCases from '@/pages/supervisor-cases';
import SupervisorQueue from '@/pages/supervisor-queue';
import SupervisorPerformance from '@/pages/supervisor-performance';
import SupervisorAIAccuracy from '@/pages/supervisor-ai-accuracy';

import AdminDashboard from '@/pages/admin-dashboard';
import AdminUsers from '@/pages/admin-users';
import AdminAudit from '@/pages/admin-audit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />

      {/* Subscriber routes */}
      <Route path="/portal">
        <DashboardLayout>
          <SubscriberPortal />
        </DashboardLayout>
      </Route>
      <Route path="/portal/profile">
        <DashboardLayout>
          <SubscriberProfile />
        </DashboardLayout>
      </Route>

      {/* Campaign Expert routes */}
      <Route path="/expert">
        <DashboardLayout>
          <ExpertDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/expert/campaigns">
        <DashboardLayout>
          <ExpertCampaigns />
        </DashboardLayout>
      </Route>
      <Route path="/expert/cases">
        <DashboardLayout>
          <ExpertCases />
        </DashboardLayout>
      </Route>
      <Route path="/expert/cases/:id">
        <DashboardLayout>
          <ExpertCaseDetail />
        </DashboardLayout>
      </Route>
      <Route path="/expert/ai">
        <DashboardLayout>
          <ExpertAIInsights />
        </DashboardLayout>
      </Route>
      <Route path="/expert/experiments">
        <DashboardLayout>
          <ExpertExperiments />
        </DashboardLayout>
      </Route>
      <Route path="/expert/customer360">
        <DashboardLayout>
          <ExpertCustomer360 />
        </DashboardLayout>
      </Route>
      <Route path="/expert/leaderboard">
        <DashboardLayout>
          <ExpertLeaderboard />
        </DashboardLayout>
      </Route>
      <Route path="/expert/achievements">
        <DashboardLayout>
          <ExpertAchievements />
        </DashboardLayout>
      </Route>

      {/* Supervisor routes */}
      <Route path="/supervisor">
        <DashboardLayout>
          <SupervisorDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/supervisor/cases">
        <DashboardLayout>
          <SupervisorCases />
        </DashboardLayout>
      </Route>
      <Route path="/supervisor/queue">
        <DashboardLayout>
          <SupervisorQueue />
        </DashboardLayout>
      </Route>
      <Route path="/supervisor/performance">
        <DashboardLayout>
          <SupervisorPerformance />
        </DashboardLayout>
      </Route>
      <Route path="/supervisor/ai-accuracy">
        <DashboardLayout>
          <SupervisorAIAccuracy />
        </DashboardLayout>
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <DashboardLayout>
          <AdminDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/admin/users">
        <DashboardLayout>
          <AdminUsers />
        </DashboardLayout>
      </Route>
      <Route path="/admin/audit">
        <DashboardLayout>
          <AdminAudit />
        </DashboardLayout>
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
