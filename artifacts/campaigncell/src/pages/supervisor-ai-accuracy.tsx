import { Card } from '@/components/ui/card';
import { useGetAiAccuracy, getGetAiAccuracyQueryKey } from '@workspace/api-client-react';
import { Loader2, Brain, CheckCircle, XCircle, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SupervisorAIAccuracy() {
  const { data: accuracy, isLoading } = useGetAiAccuracy({
    query: { queryKey: getGetAiAccuracyQueryKey() },
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
        <h1 className="text-3xl font-bold">AI Accuracy Deep-Dive</h1>
        <p className="text-muted-foreground mt-1">Comprehensive AI prediction performance analysis</p>
      </div>

      {/* Overall Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Brain className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Overall Accuracy</h3>
          </div>
          <div className="text-3xl font-bold text-primary">
            {((accuracy?.overallAccuracy || 0) * 100).toFixed(1)}%
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Total Predictions</h3>
          </div>
          <div className="text-3xl font-bold">{accuracy?.totalPredictions || 0}</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold">Correct</h3>
          </div>
          <div className="text-3xl font-bold text-green-600">{accuracy?.correctPredictions || 0}</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold">Misclassified</h3>
          </div>
          <div className="text-3xl font-bold text-destructive">{accuracy?.misclassified || 0}</div>
        </Card>
      </div>

      {/* Accuracy by Segment */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Accuracy by Segment</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={accuracy?.bySegment || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="segment" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="accuracy" fill="#2196F3" name="Accuracy %" />
            <Bar dataKey="total" fill="#00BCD4" name="Total Predictions" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Segment Details */}
      <div className="grid md:grid-cols-2 gap-4">
        {accuracy?.bySegment.map((seg) => (
          <Card key={seg.segment} className="p-6">
            <h3 className="font-semibold text-lg mb-4">{seg.segment}</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="text-xl font-bold text-primary">{(seg.accuracy * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Predictions</span>
                <span className="font-medium">{seg.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Correct</span>
                <span className="font-medium text-green-600">{seg.correct}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Incorrect</span>
                <span className="font-medium text-destructive">{seg.total - seg.correct}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
