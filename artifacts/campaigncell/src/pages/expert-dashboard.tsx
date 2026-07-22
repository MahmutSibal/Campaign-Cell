import { KPICard } from '@/components/KPICard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SLACountdown } from '@/components/SLACountdown';
import { useAuth } from '@/contexts/AuthContext';
import { useGetExpertKpis, useListCases, getListCasesQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  FileCheck,
  AlertCircle,
  Clock,
  TrendingUp,
  CheckCircle2,
  Brain,
  Loader2,
} from 'lucide-react';

export default function ExpertDashboard() {
  const { user } = useAuth();
  
  const { data: kpis, isLoading: kpisLoading } = useGetExpertKpis();
  const { data: cases, isLoading: casesLoading } = useListCases(
    { assignedTo: user?.id, status: 'ASSIGNED', limit: 5 },
    { query: { queryKey: getListCasesQueryKey({ assignedTo: user?.id, status: 'ASSIGNED', limit: 5 }) } }
  );

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Your campaign optimization overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Assigned Cases"
          value={kpis?.assignedCases || 0}
          icon={FileCheck}
        />
        <KPICard
          title="Critical Cases"
          value={kpis?.criticalCases || 0}
          icon={AlertCircle}
        />
        <KPICard
          title="SLA At Risk"
          value={kpis?.slaAtRisk || 0}
          icon={Clock}
        />
        <KPICard
          title="Avg Conversion Lift"
          value={`+${(kpis?.avgConversionLift || 0).toFixed(1)}%`}
          icon={TrendingUp}
        />
        <KPICard
          title="Completed Cases"
          value={kpis?.completedCases || 0}
          icon={CheckCircle2}
        />
        <KPICard
          title="AI Accuracy"
          value={`${((kpis?.aiAccuracy || 0) * 100).toFixed(1)}%`}
          icon={Brain}
        />
      </div>

      {/* Recent Cases */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">My Active Cases</h2>
          <Link href="/expert/cases">
            <Button variant="outline" size="sm" data-testid="button-view-all-cases">
              View All
            </Button>
          </Link>
        </div>

        {casesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : cases?.data && cases.data.length > 0 ? (
          <div className="space-y-3">
            {cases.data.map((case_) => (
              <Link key={case_.id} href={`/expert/cases/${case_.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{case_.caseCode}</span>
                      <StatusBadge status={case_.status} />
                      <PriorityBadge priority={case_.priority} />
                    </div>
                    <p className="text-sm text-muted-foreground">{case_.campaignName}</p>
                  </div>
                  <SLACountdown deadline={case_.slaDeadline} breached={case_.slaBreached} priority={case_.priority} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No active cases assigned to you.
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-2">Create Campaign</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Launch a new campaign with AI-powered optimization
          </p>
          <Link href="/expert/campaigns">
            <Button data-testid="button-create-campaign">Create New Campaign</Button>
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-2">AI Insights</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Review AI predictions and accuracy metrics
          </p>
          <Link href="/expert/ai">
            <Button variant="outline" data-testid="button-view-ai-insights">View AI Insights</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
