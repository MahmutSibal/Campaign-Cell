import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SLACountdown } from '@/components/SLACountdown';
import { useListCases, getListCasesQueryKey } from '@workspace/api-client-react';
import { Loader2, Search } from 'lucide-react';

export default function SupervisorCases() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: cases, isLoading } = useListCases(undefined, {
    query: { queryKey: getListCasesQueryKey(undefined) },
  });

  const filteredCases = cases?.data.filter((c) =>
    c.caseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.campaignName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">All Cases</h1>
        <p className="text-muted-foreground mt-1">Optimization case management and oversight</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-cases"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCases && filteredCases.length > 0 ? (
            filteredCases.map((case_) => (
              <Card key={case_.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{case_.caseCode}</h3>
                      <StatusBadge status={case_.status} />
                      <PriorityBadge priority={case_.priority} />
                    </div>
                    <p className="text-muted-foreground mb-2">{case_.campaignName}</p>
                    <div className="text-sm text-muted-foreground">
                      {case_.assignedExpertName ? `Assigned to: ${case_.assignedExpertName}` : 'Unassigned'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <SLACountdown deadline={case_.slaDeadline} breached={case_.slaBreached} priority={case_.priority} />
                    {case_.conversionProbability && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Conv. Prob.</div>
                        <div className="text-sm font-bold">
                          {(case_.conversionProbability * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No cases found.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
