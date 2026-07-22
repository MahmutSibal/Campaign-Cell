import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CampaignStatus, OptimizationCaseStatus, ExperimentStatus } from '@workspace/api-client-react';

type Status = CampaignStatus | OptimizationCaseStatus | ExperimentStatus | string;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  ACTIVE: { label: 'Active', variant: 'default', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  MANUAL_OPTIMIZATION_REQUIRED: { label: 'Needs Optimization', variant: 'destructive' },
  OPTIMIZING: { label: 'Optimizing', variant: 'default', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  AB_TESTING: { label: 'A/B Testing', variant: 'default', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  OPTIMIZED: { label: 'Optimized', variant: 'default', className: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100' },
  PUBLISHED: { label: 'Published', variant: 'default', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  ARCHIVED: { label: 'Archived', variant: 'outline' },
  CREATED: { label: 'Created', variant: 'secondary' },
  ASSIGNED: { label: 'Assigned', variant: 'default', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  RUNNING: { label: 'Running', variant: 'default', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  CONCLUDED: { label: 'Concluded', variant: 'outline' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
  PENDING: { label: 'Pending', variant: 'secondary' },
  ACCEPTED: { label: 'Accepted', variant: 'default', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  RATED: { label: 'Rated', variant: 'outline' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  
  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
      data-testid={`badge-status-${status.toLowerCase()}`}
    >
      {config.label}
    </Badge>
  );
}
