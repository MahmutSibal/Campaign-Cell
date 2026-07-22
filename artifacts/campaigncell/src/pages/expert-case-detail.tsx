import { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { SLACountdown } from '@/components/SLACountdown';
import { Badge } from '@/components/ui/badge';
import {
  useGetCase,
  useCompleteCase,
  useAddCaseNote,
  getGetCaseQueryKey,
} from '@workspace/api-client-react';
import { Loader2, CheckCircle, MessageSquare, Brain, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export default function ExpertCaseDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const caseId = params.id || '';
  const { data: case_, isLoading } = useGetCase(caseId, {
    query: { enabled: !!caseId, queryKey: getGetCaseQueryKey(caseId) },
  });

  const completeCase = useCompleteCase();
  const addNote = useAddCaseNote();

  const [optimizationNote, setOptimizationNote] = useState('');
  const [newNote, setNewNote] = useState('');

  const handleComplete = () => {
    if (!optimizationNote) {
      toast({ title: 'Error', description: 'Please provide optimization notes', variant: 'destructive' });
      return;
    }

    completeCase.mutate(
      { id: caseId, data: { optimizationNote } },
      {
        onSuccess: () => {
          toast({ title: 'Case Completed', description: 'Optimization case marked as complete' });
          queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
          setLocation('/expert/cases');
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to complete case', variant: 'destructive' });
        },
      }
    );
  };

  const handleAddNote = () => {
    if (!newNote) return;

    addNote.mutate(
      { id: caseId, data: { content: newNote } },
      {
        onSuccess: () => {
          toast({ title: 'Note Added', description: 'Your note has been added' });
          queryClient.invalidateQueries({ queryKey: getGetCaseQueryKey(caseId) });
          setNewNote('');
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!case_) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Case not found</p>
      </Card>
    );
  }

  const statusSteps = ['CREATED', 'ASSIGNED', 'OPTIMIZING', 'AB_TESTING', 'OPTIMIZED', 'PUBLISHED'];
  const currentIndex = statusSteps.indexOf(case_.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{case_.caseCode}</h1>
          <p className="text-muted-foreground mt-1">{case_.campaignName}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={case_.status} />
          <PriorityBadge priority={case_.priority} />
          <SLACountdown deadline={case_.slaDeadline} breached={case_.slaBreached} />
        </div>
      </div>

      {/* Status Timeline */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Optimization Timeline</h3>
        <div className="flex items-center justify-between">
          {statusSteps.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    index <= currentIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {index < currentIndex ? <CheckCircle className="h-5 w-5" /> : index + 1}
                </div>
                <span className="text-xs mt-2 text-center">{step.replace(/_/g, ' ')}</span>
              </div>
              {index < statusSteps.length - 1 && (
                <div
                  className={`h-1 flex-1 ${index < currentIndex ? 'bg-primary' : 'bg-muted'}`}
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* AI Insights */}
        {case_.aiReasoning && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Insights</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{case_.aiReasoning}</p>
            <div className="grid grid-cols-2 gap-4">
              {case_.aiScore && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">AI Score</div>
                  <div className="text-2xl font-bold">{(case_.aiScore * 100).toFixed(1)}%</div>
                </div>
              )}
              {case_.conversionProbability && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Conv. Probability</div>
                  <div className="text-2xl font-bold">{(case_.conversionProbability * 100).toFixed(1)}%</div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Case Details */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Case Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Segment</span>
              <Badge>{case_.segment}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(case_.createdAt).toLocaleString()}</span>
            </div>
            {case_.updatedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="font-medium">{new Date(case_.updatedAt).toLocaleString()}</span>
              </div>
            )}
            {case_.assignedExpertName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="font-medium">{case_.assignedExpertName}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Complete Case */}
      {case_.status !== 'OPTIMIZED' && case_.status !== 'PUBLISHED' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Complete Optimization</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="optimization-note">Optimization Notes *</Label>
              <Textarea
                id="optimization-note"
                value={optimizationNote}
                onChange={(e) => setOptimizationNote(e.target.value)}
                placeholder="Describe the optimizations you made..."
                rows={4}
                data-testid="textarea-optimization-note"
              />
            </div>
            <Button
              onClick={handleComplete}
              disabled={completeCase.isPending || !optimizationNote}
              className="gap-2"
              data-testid="button-complete-case"
            >
              <CheckCircle className="h-4 w-4" />
              {completeCase.isPending ? 'Completing...' : 'Complete Case'}
            </Button>
          </div>
        </Card>
      )}

      {/* Notes */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Notes</h3>
        </div>

        <div className="space-y-4 mb-4">
          {case_.notes && case_.notes.length > 0 ? (
            case_.notes.map((note) => (
              <div key={note.id} className="border-l-2 border-primary pl-4 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{note.authorName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(note.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{note.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            data-testid="textarea-new-note"
          />
          <Button
            onClick={handleAddNote}
            disabled={addNote.isPending || !newNote}
            size="sm"
            data-testid="button-add-note"
          >
            {addNote.isPending ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
