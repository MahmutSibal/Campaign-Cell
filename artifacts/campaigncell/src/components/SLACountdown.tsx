import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface SLACountdownProps {
  deadline: string;
  breached?: boolean;
  /**
   * Case priority, used to color the badge when the SLA is breached or
   * close to breaching. Accepts both the generated client's English enum
   * (CRITICAL/HIGH/MEDIUM/LOW) and the backend's Turkish enum
   * (KRITIK/YUKSEK/ORTA/DUSUK) since the two are currently out of sync.
   */
  priority?: string | null;
}

// KRITIK/CRITICAL -> red, YUKSEK/HIGH -> orange, ORTA/MEDIUM -> amber,
// DUSUK/LOW -> a milder yellow warning.
const PRIORITY_WARNING_CLASS: Record<string, string> = {
  KRITIK: 'bg-red-100 text-red-700 hover:bg-red-100',
  CRITICAL: 'bg-red-100 text-red-700 hover:bg-red-100',
  YUKSEK: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  HIGH: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  ORTA: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  MEDIUM: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  DUSUK: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  LOW: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
};

export function SLACountdown({ deadline, breached, priority }: SLACountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const target = new Date(deadline);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Overdue');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours < 24) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline]);

  const isUrgent = timeLeft.includes('h') && !timeLeft.includes('d');
  const priorityClassName = priority ? PRIORITY_WARNING_CLASS[priority] : undefined;

  if (breached) {
    return (
      <Badge
        variant={priorityClassName ? undefined : 'destructive'}
        className={cn('gap-1', priorityClassName)}
        data-testid="badge-sla-breached"
      >
        <Clock className="h-3 w-3" />
        SLA BREACHED
      </Badge>
    );
  }

  return (
    <Badge
      variant={isUrgent && !priorityClassName ? 'destructive' : 'secondary'}
      className={cn('gap-1', isUrgent ? priorityClassName : undefined)}
      data-testid="badge-sla-countdown"
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </Badge>
  );
}
