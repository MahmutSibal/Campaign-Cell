import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SLACountdown } from '@/components/SLACountdown';
import {
  useListCases,
  getListCasesQueryKey,
  useListUsers,
  getListUsersQueryKey,
  useAssignCase,
} from '@workspace/api-client-react';
import type { OptimizationCase, CaseAssignInput } from '@workspace/api-client-react';
import { Loader2, UserPlus, Zap, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

// Cases needing supervisor attention: brand new/unassigned cases (status
// CREATED, i.e. backend's YENI before an expert is assigned) plus any case
// whose segment couldn't be determined (BELIRSIZ) and is still unassigned.
const UNASSIGNED_PARAMS = { status: 'CREATED', limit: 100 } as const;
const ALL_PARAMS = { limit: 100 } as const;
const EXPERTS_PARAMS = { role: 'CAMPAIGN_EXPERT', limit: 100 } as const;

export default function SupervisorQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignTarget, setAssignTarget] = useState<OptimizationCase | null>(null);
  const [selectedExpertId, setSelectedExpertId] = useState('');
  const [autoAssigningId, setAutoAssigningId] = useState<string | null>(null);

  const {
    data: unassignedCases,
    isLoading: unassignedLoading,
    isError: unassignedError,
  } = useListCases(UNASSIGNED_PARAMS, {
    query: { queryKey: getListCasesQueryKey(UNASSIGNED_PARAMS) },
  });

  const {
    data: allCases,
    isLoading: allLoading,
    isError: allError,
  } = useListCases(ALL_PARAMS, {
    query: { queryKey: getListCasesQueryKey(ALL_PARAMS) },
  });

  const { data: experts, isLoading: expertsLoading } = useListUsers(EXPERTS_PARAMS, {
    query: { queryKey: getListUsersQueryKey(EXPERTS_PARAMS) },
  });

  const assignCase = useAssignCase();

  const isLoading = unassignedLoading || allLoading;
  const isError = unassignedError || allError;

  // Merge unassigned (CREATED) cases with any still-unassigned BELIRSIZ
  // (undetermined segment) cases, de-duplicated by id, oldest first.
  const queueMap = new Map<string, OptimizationCase>();
  (unassignedCases?.data ?? []).forEach((c) => queueMap.set(c.id, c));
  (allCases?.data ?? [])
    .filter((c) => c.segment === 'BELIRSIZ' && !c.assignedExpertId)
    .forEach((c) => queueMap.set(c.id, c));

  const queueCases = Array.from(queueMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const invalidateQueue = () => {
    queryClient.invalidateQueries({ queryKey: getListCasesQueryKey(UNASSIGNED_PARAMS) });
    queryClient.invalidateQueries({ queryKey: getListCasesQueryKey(ALL_PARAMS) });
  };

  const openAssignDialog = (case_: OptimizationCase) => {
    setAssignTarget(case_);
    setSelectedExpertId('');
  };

  const handleManualAssign = () => {
    if (!assignTarget || !selectedExpertId) return;

    assignCase.mutate(
      { id: assignTarget.id, data: { expertId: selectedExpertId } },
      {
        onSuccess: () => {
          toast({
            title: 'Case Assigned',
            description: `${assignTarget.caseCode} was assigned successfully.`,
          });
          invalidateQueue();
          setAssignTarget(null);
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to assign case.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleAutoAssign = (case_: OptimizationCase) => {
    setAutoAssigningId(case_.id);
    // NOTE: the generated CaseAssignInput type only models { expertId }, but
    // the backend also accepts { auto: true } to let the AI service pick the
    // best expert. Cast is needed because the client codegen hasn't caught
    // up with the backend's auto-assign support.
    assignCase.mutate(
      { id: case_.id, data: { auto: true } as unknown as CaseAssignInput },
      {
        onSuccess: () => {
          toast({
            title: 'Auto-Assigned',
            description: `${case_.caseCode} was assigned automatically.`,
          });
          invalidateQueue();
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Auto assignment failed — no expert capacity available.',
            variant: 'destructive',
          });
        },
        onSettled: () => setAutoAssigningId(null),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bekleyen Kuyruk</h1>
        <p className="text-muted-foreground mt-1">
          Segmenti belirsiz veya uzman kapasitesi bekleyen vakalar — manuel ya da otomatik atama yapın.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <Card className="p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-muted-foreground">Kuyruk yüklenirken bir hata oluştu.</p>
        </Card>
      ) : queueCases.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Bekleyen optimizasyon vakası yok.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vaka Kodu</TableHead>
                <TableHead>Kampanya</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Oluşturulma</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueCases.map((case_) => (
                <TableRow key={case_.id} data-testid={`row-queue-case-${case_.id}`}>
                  <TableCell className="font-medium">{case_.caseCode}</TableCell>
                  <TableCell className="text-muted-foreground">{case_.campaignName || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={case_.segment === 'BELIRSIZ' ? 'destructive' : 'outline'}>
                      {case_.segment}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={case_.priority} />
                  </TableCell>
                  <TableCell>
                    <SLACountdown
                      deadline={case_.slaDeadline}
                      breached={case_.slaBreached}
                      priority={case_.priority}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(case_.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => openAssignDialog(case_)}
                        data-testid={`button-assign-${case_.id}`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Ata
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={autoAssigningId === case_.id}
                        onClick={() => handleAutoAssign(case_)}
                        data-testid={`button-auto-assign-${case_.id}`}
                      >
                        {autoAssigningId === case_.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        Otomatik Ata
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!assignTarget} onOpenChange={(open) => !open && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uzman Ata</DialogTitle>
            <DialogDescription>
              {assignTarget?.caseCode} vakasını bir kampanya uzmanına manuel olarak atayın.
            </DialogDescription>
          </DialogHeader>

          <Select value={selectedExpertId} onValueChange={setSelectedExpertId}>
            <SelectTrigger data-testid="select-expert">
              <SelectValue placeholder={expertsLoading ? 'Uzmanlar yükleniyor...' : 'Uzman seçin'} />
            </SelectTrigger>
            <SelectContent>
              {(experts?.data ?? []).map((expert) => (
                <SelectItem key={expert.id} value={expert.id}>
                  {expert.name}
                  {expert.expertise ? ` — ${expert.expertise}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>
              İptal
            </Button>
            <Button
              onClick={handleManualAssign}
              disabled={!selectedExpertId || assignCase.isPending}
              data-testid="button-confirm-assign"
            >
              {assignCase.isPending ? 'Atanıyor...' : 'Ata'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
