import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useListAuditLogs, getListAuditLogsQueryKey } from '@workspace/api-client-react';
import { Loader2, Search } from 'lucide-react';

export default function AdminAudit() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: logs, isLoading } = useListAuditLogs(undefined, {
    query: { queryKey: getListAuditLogsQueryKey(undefined) },
  });

  const filteredLogs = logs?.data.filter(
    (log) =>
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground mt-1">System activity and user actions</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-audit"
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs && filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.action}</span>
                      <Badge variant={log.result === 'SUCCESS' ? 'default' : 'destructive'}>
                        {log.result}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>User: {log.userName}</div>
                      <div>Resource: {log.resource} {log.resourceId ? `(${log.resourceId})` : ''}</div>
                      <div>IP: {log.ipAddress}</div>
                      {log.details && <div>Details: {log.details}</div>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No audit logs found</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
