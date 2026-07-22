import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CampaignPriority } from '@workspace/api-client-react';

interface PriorityBadgeProps {
  priority: CampaignPriority;
  className?: string;
}

const priorityConfig: Record<CampaignPriority, { label: string; className: string }> = {
  CRITICAL: { label: 'Critical', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  HIGH: { label: 'High', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  MEDIUM: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <Badge
      className={cn(config.className, className)}
      data-testid={`badge-priority-${priority.toLowerCase()}`}
    >
      {config.label}
    </Badge>
  );
}
