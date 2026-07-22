import { Card } from '@/components/ui/card';
import { useGetExpertPerformance, getGetExpertPerformanceQueryKey } from '@workspace/api-client-react';
import { Loader2, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SupervisorPerformance() {
  const { data: performance, isLoading } = useGetExpertPerformance({
    query: { queryKey: getGetExpertPerformanceQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Expert Performance</h1>
        <p className="text-muted-foreground mt-1">Campaign expert metrics and analytics</p>
      </div>

      {/* Performance Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Completed Cases by Expert</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={performance?.data || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="completedCases" fill="#2196F3" name="Completed Cases" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Expert Details */}
      <div className="grid gap-4">
        {performance?.data && performance.data.length > 0 ? (
          performance.data.map((expert) => (
            <Card key={expert.expertId} className="p-6">
              <h3 className="font-semibold text-lg mb-4">{expert.name}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                    <div className="text-xl font-bold">{expert.completedCases}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Conv. Lift</div>
                    <div className="text-xl font-bold">+{(expert.avgConversionLift ?? 0).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">SLA Compliance</div>
                    <div className="text-xl font-bold">{((expert.slaComplianceRate ?? 0) * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Resolution</div>
                    <div className="text-xl font-bold">{(expert.avgResolutionHours ?? 0).toFixed(1)}h</div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No performance data available</p>
          </Card>
        )}
      </div>
    </div>
  );
}
