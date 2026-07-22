import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGetAiAccuracy, useListPredictions, getGetAiAccuracyQueryKey, getListPredictionsQueryKey } from '@workspace/api-client-react';
import { Loader2, Brain, CheckCircle, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ExpertAIInsights() {
  const { data: accuracyResponse, isLoading: accuracyLoading } = useGetAiAccuracy({
    query: { queryKey: getGetAiAccuracyQueryKey() },
  });
  // ai-service nests the payload as `data.{overallAccuracy,...,bySegment}`,
  // not directly on the response root.
  const accuracy = (accuracyResponse as unknown as { data?: typeof accuracyResponse })?.data;
  
  const { data: predictions, isLoading: predictionsLoading } = useListPredictions(undefined, {
    query: { queryKey: getListPredictionsQueryKey(undefined) },
  });

  if (accuracyLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Insights</h1>
        <p className="text-muted-foreground mt-1">AI prediction accuracy and performance metrics</p>
      </div>

      {/* Overall Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Overall Accuracy</div>
              <div className="text-3xl font-bold">{((accuracy?.overallAccuracy || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Correct Predictions</div>
              <div className="text-3xl font-bold">{accuracy?.correctPredictions || 0}</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Misclassified</div>
              <div className="text-3xl font-bold">{accuracy?.misclassified || 0}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Accuracy by Segment */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Accuracy by Segment</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={accuracy?.bySegment || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="segment" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="accuracy" fill="#2196F3" name="Accuracy" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Predictions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Predictions</h3>
        {predictionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : predictions?.data && predictions.data.length > 0 ? (
          <div className="space-y-3">
            {predictions.data.slice(0, 10).map((pred) => (
              <div key={pred.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge>{pred.segment}</Badge>
                    <Badge variant="outline">{pred.priority}</Badge>
                    {pred.isAiMisclassified && (
                      <Badge variant="destructive">Misclassified</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{pred.reasoning}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Score</div>
                  <div className="text-lg font-bold">{((pred.recommendationScore ?? 0) * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">No predictions available</p>
        )}
      </Card>
    </div>
  );
}
