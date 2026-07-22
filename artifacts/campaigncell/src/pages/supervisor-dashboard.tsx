import { KPICard } from '@/components/KPICard';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SLACountdown } from '@/components/SLACountdown';
import {
  useGetDashboardKpis,
  useGetConversionTrend,
  useGetCampaignDistribution,
  useListCases,
  getGetConversionTrendQueryKey,
  getGetCampaignDistributionQueryKey,
  getListCasesQueryKey,
} from '@workspace/api-client-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'wouter';
import {
  Megaphone,
  CheckCircle,
  TrendingUp,
  Brain,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const COLORS = ['#2196F3', '#00BCD4', '#FFC107', '#4CAF50', '#F44336'];

export default function SupervisorDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useGetDashboardKpis();
  const { data: trendData } = useGetConversionTrend(
    { days: 30 },
    { query: { queryKey: getGetConversionTrendQueryKey({ days: 30 }) } }
  );
  const { data: distribution } = useGetCampaignDistribution({
    query: { queryKey: getGetCampaignDistributionQueryKey() },
  });
  const { data: criticalCases } = useListCases(
    { priority: 'CRITICAL', limit: 5 },
    { query: { queryKey: getListCasesQueryKey({ priority: 'CRITICAL', limit: 5 }) } }
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
        <h1 className="text-3xl font-bold">Intelligence Center</h1>
        <p className="text-muted-foreground mt-1">Comprehensive campaign analytics and oversight</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Campaigns"
          value={kpis?.totalCampaigns || 0}
          icon={Megaphone}
        />
        <KPICard
          title="Active Campaigns"
          value={kpis?.activeCampaigns || 0}
          icon={CheckCircle}
        />
        <KPICard
          title="Avg Conversion Rate"
          value={`${((kpis?.conversionRate || 0) * 100).toFixed(1)}%`}
          icon={TrendingUp}
        />
        <KPICard
          title="AI Accuracy"
          value={`${((kpis?.aiAccuracy || 0) * 100).toFixed(1)}%`}
          icon={Brain}
        />
        <KPICard
          title="SLA Compliance"
          value={`${((kpis?.slaCompliance || 0) * 100).toFixed(1)}%`}
          icon={Clock}
        />
        <KPICard
          title="Open Cases"
          value={kpis?.openCases || 0}
          icon={AlertCircle}
        />
        <KPICard
          title="Critical Cases"
          value={kpis?.criticalCases || 0}
          icon={AlertCircle}
        />
        <KPICard
          title="Avg Conv. Lift"
          value={`+${(kpis?.avgConversionLift || 0).toFixed(1)}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Conversion Trend (30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData?.data || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#2196F3" strokeWidth={2} name="Conversion Rate" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Campaign Distribution by Segment</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distribution?.bySegment || []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {(distribution?.bySegment || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Campaign Distribution by Type</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={distribution?.byType || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#00BCD4" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Critical Cases */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Critical Cases</h3>
          <Link href="/supervisor/cases">
            <button className="text-sm text-primary hover:underline" data-testid="link-view-all-cases">
              View All
            </button>
          </Link>
        </div>
        <div className="space-y-3">
          {criticalCases?.data && criticalCases.data.length > 0 ? (
            criticalCases.data.map((case_) => (
              <div
                key={case_.id}
                className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
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
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No critical cases</p>
          )}
        </div>
      </Card>
    </div>
  );
}
