import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useListSubscribers, getListSubscribersQueryKey } from '@workspace/api-client-react';
import { Loader2, Search, User } from 'lucide-react';

export default function ExpertCustomer360() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: subscribers, isLoading } = useListSubscribers(
    { search: searchQuery },
    { query: { queryKey: getListSubscribersQueryKey({ search: searchQuery }) } }
  );

  const segmentLabels: Record<string, string> = {
    YUKSEK_DEGER: 'High Value',
    RISKLI_KAYIP: 'At Risk',
    YENI_ABONE: 'New Subscriber',
    PASIF: 'Passive',
    BELIRSIZ: 'Undefined',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer 360</h1>
        <p className="text-muted-foreground mt-1">Complete subscriber profiles and insights</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or GSM number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-subscribers"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {subscribers?.data && subscribers.data.length > 0 ? (
            subscribers.data.map((subscriber) => (
              <Card key={subscriber.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{subscriber.name}</h3>
                      <Badge>{segmentLabels[subscriber.segment]}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">GSM</div>
                        <div className="font-medium">{subscriber.gsmNumber}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Tariff</div>
                        <div className="font-medium">{subscriber.tariff}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Monthly Spend</div>
                        <div className="font-medium">${subscriber.monthlySpend.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Data Usage</div>
                        <div className="font-medium">{subscriber.dataUsageGb} GB</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Churn Risk</div>
                        <div className={`font-medium ${subscriber.churnRisk > 0.6 ? 'text-destructive' : ''}`}>
                          {(subscriber.churnRisk * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Value Score</div>
                        <div className="font-medium">{(subscriber.valueScore * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Accepted</div>
                        <div className="font-medium">{subscriber.acceptedCampaigns || 0}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Rejected</div>
                        <div className="font-medium">{subscriber.rejectedCampaigns || 0}</div>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" data-testid={`button-view-${subscriber.id}`}>
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No subscribers found matching your search.' : 'Enter a search term to find subscribers.'}
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
