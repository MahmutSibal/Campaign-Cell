import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGetSubscriber, getGetSubscriberQueryKey } from '@workspace/api-client-react';
import { Loader2, User, Phone, CreditCard, Database, TrendingDown, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/StatusBadge';

export default function SubscriberProfile() {
  const { user } = useAuth();
  
  const { data, isLoading } = useGetSubscriber(user?.id || '', {
    query: { enabled: !!user?.id, queryKey: getGetSubscriberQueryKey(user?.id || '') },
  });

  // API returns { subscriber: {...}, campaigns: [...] }
  const subscriber = data?.subscriber;
  const campaigns = data?.campaigns || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscriber) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Profile not found. Please log in with a registered subscriber GSM number.</p>
      </Card>
    );
  }

  const segmentLabels: Record<string, string> = {
    YUKSEK_DEGER: 'High Value',
    RISKLI_KAYIP: 'At Risk',
    YENI_ABONE: 'New Subscriber',
    PASIF: 'Passive',
    BELIRSIZ: 'Undefined',
  };

  const segmentColors: Record<string, string> = {
    YUKSEK_DEGER: 'bg-green-100 text-green-800',
    RISKLI_KAYIP: 'bg-red-100 text-red-800',
    YENI_ABONE: 'bg-blue-100 text-blue-800',
    PASIF: 'bg-gray-100 text-gray-800',
    BELIRSIZ: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Profile</h1>
        <p className="text-muted-foreground mt-1">Your account information and usage statistics</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{subscriber.name}</h2>
              <p className="text-sm text-muted-foreground">GSM: {subscriber.gsmNumber}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">GSM Number</div>
                <div className="font-medium">{subscriber.gsmNumber}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Current Tariff</div>
                <div className="font-medium">{subscriber.tariff}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Segment</div>
                <Badge className={`mt-1 ${segmentColors[subscriber.segment] || ''}`}>
                  {segmentLabels[subscriber.segment] || subscriber.segment}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Usage Stats */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Monthly Spend</span>
                <span className="font-bold text-lg">₺{subscriber.monthlySpend.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Data Usage</span>
                <span className="font-medium">{subscriber.dataUsageGb} GB</span>
              </div>
              <Progress value={Math.min(100, (subscriber.dataUsageGb / 50) * 100)} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Voice Minutes</span>
                <span className="font-medium">{subscriber.voiceMinutes} min</span>
              </div>
              <Progress value={Math.min(100, (subscriber.voiceMinutes / 1000) * 100)} className="h-2" />
            </div>
          </div>
        </Card>

        {/* AI Risk Scores */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">AI Analysis</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-sm text-muted-foreground">Churn Risk</span>
              </div>
              <div className={`text-2xl font-bold ${subscriber.churnRisk > 0.6 ? 'text-destructive' : subscriber.churnRisk > 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>
                {(subscriber.churnRisk * 100).toFixed(1)}%
              </div>
              <Progress value={subscriber.churnRisk * 100} className="h-1 mt-2" />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Value Score</span>
              </div>
              <div className={`text-2xl font-bold ${subscriber.valueScore > 0.7 ? 'text-green-600' : subscriber.valueScore > 0.4 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                {(subscriber.valueScore * 100).toFixed(1)}%
              </div>
              <Progress value={subscriber.valueScore * 100} className="h-1 mt-2" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Accepted Offers</span>
              <div className="font-bold text-green-600">{subscriber.acceptedCampaigns ?? 0}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Rejected Offers</span>
              <div className="font-bold text-destructive">{subscriber.rejectedCampaigns ?? 0}</div>
            </div>
          </div>
        </Card>

        {/* Offer History */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Offer History ({campaigns.length})</h3>
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No campaign offers yet.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.discount}% off</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
