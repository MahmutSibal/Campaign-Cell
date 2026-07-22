import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

interface SLACountdownProps {
  deadline: string;
  breached?: boolean;
}

export function SLACountdown({ deadline, breached }: SLACountdownProps) {
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

  if (breached) {
    return (
      <Badge variant="destructive" className="gap-1" data-testid="badge-sla-breached">
        <Clock className="h-3 w-3" />
        SLA BREACHED
      </Badge>
    );
  }

  const isUrgent = timeLeft.includes('h') && !timeLeft.includes('d');

  return (
    <Badge
      variant={isUrgent ? 'destructive' : 'secondary'}
      className="gap-1"
      data-testid="badge-sla-countdown"
    >
      <Clock className="h-3 w-3" />
      {timeLeft}
    </Badge>
  );
}
