import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CampaignPriority } from '@workspace/api-client-react';

interface PriorityBadgeProps {
  // The generated client's CampaignPriority type only models the English
  // enum, but campaign-service actually returns the Turkish enum
  // (KRITIK/YUKSEK/ORTA/DUSUK) — accept both plus an unknown-safe string so
  // this never throws on a real backend value.
  priority: CampaignPriority | string;
  className?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  CRITICAL: { label: 'Kritik', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  KRITIK: { label: 'Kritik', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
  HIGH: { label: 'Yüksek', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  YUKSEK: { label: 'Yüksek', className: 'bg-orange-100 text-orange-700 hover:bg-orange-100' },
  MEDIUM: { label: 'Orta', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  ORTA: { label: 'Orta', className: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' },
  LOW: { label: 'Düşük', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  DUSUK: { label: 'Düşük', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority] ?? { label: priority, className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' };

  return (
    <Badge
      className={cn(config.className, className)}
      data-testid={`badge-priority-${String(priority).toLowerCase()}`}
    >
      {config.label}
    </Badge>
  );
}
