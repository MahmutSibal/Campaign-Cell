import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { useListExperiments, getListExperimentsQueryKey } from '@workspace/api-client-react';
import { Loader2, Plus, TrendingUp } from 'lucide-react';

export default function ExpertExperiments() {
  const { data: experiments, isLoading } = useListExperiments(undefined, {
    query: { queryKey: getListExperimentsQueryKey(undefined) },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Experiments</h1>
          <p className="text-muted-foreground mt-1">Test campaign variants to optimize conversions</p>
        </div>
        <Button className="gap-2" data-testid="button-create-experiment">
          <Plus className="h-4 w-4" />
          New Experiment
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {experiments?.data && experiments.data.length > 0 ? (
            experiments.data.map((exp) => (
              <Card key={exp.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{exp.name}</h3>
                      <StatusBadge status={exp.status} />
                    </div>
                    {exp.description && (
                      <p className="text-sm text-muted-foreground">{exp.description}</p>
                    )}
                  </div>
                  {exp.winner && (
                    <Badge variant="default" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Winner: Variant {exp.winner}
                    </Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-3">{exp.variantAName || 'Variant A'}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium">{exp.variantADiscount ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Impressions</span>
                        <span className="font-medium">{exp.variantAImpressions ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conversions</span>
                        <span className="font-medium">{exp.variantAConversions ?? 0}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Conversion Rate</span>
                        <span className="font-bold text-primary">
                          {(((exp.variantAConversions ?? 0) / (exp.variantAImpressions || 1)) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-3">{exp.variantBName || 'Variant B'}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium">{exp.variantBDiscount ?? 0}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Impressions</span>
                        <span className="font-medium">{exp.variantBImpressions ?? 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Conversions</span>
                        <span className="font-medium">{exp.variantBConversions ?? 0}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Conversion Rate</span>
                        <span className="font-bold text-primary">
                          {(((exp.variantBConversions ?? 0) / (exp.variantBImpressions || 1)) * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {exp.conclusion && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium mb-1">Conclusion</div>
                    <p className="text-sm text-muted-foreground">{exp.conclusion}</p>
                  </div>
                )}

                <div className="mt-4 text-xs text-muted-foreground">
                  Created {new Date(exp.createdAt).toLocaleString()}
                  {exp.concludedAt && ` • Concluded ${new Date(exp.concludedAt).toLocaleString()}`}
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No experiments found. Create your first A/B test!</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
