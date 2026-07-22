import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface BadgeEarnedPayload {
  userId: string;
  badgeId: string;
  badgeName: string;
  badgeDescription: string;
  earnedAt: string;
}

/**
 * Subscribes to the gamification service's SSE event stream and shows a
 * toast the moment a `badge.earned` event arrives for the current user.
 *
 * Opens a native `EventSource` connection to
 * `/api/v1/game/events?userId=<userId>` whenever `userId` is available, and
 * tears it down on unmount or when `userId` changes. Reconnection on drop is
 * handled automatically by the browser's `EventSource` implementation, so no
 * extra retry logic is needed here.
 */
export function useBadgeNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const source = new EventSource(`/api/v1/game/events?userId=${encodeURIComponent(userId)}`);

    const handleBadgeEarned = (event: MessageEvent) => {
      try {
        const badge: BadgeEarnedPayload = JSON.parse(event.data);
        toast({
          title: `🏆 Yeni Rozet: ${badge.badgeName}`,
          description: badge.badgeDescription,
        });
      } catch (err) {
        console.warn('Failed to parse badge.earned event payload', err);
      }
    };

    source.addEventListener('badge.earned', handleBadgeEarned);

    source.onerror = (err) => {
      // EventSource auto-reconnects on transient network errors; just log.
      console.warn('Badge notification stream error', err);
    };

    return () => {
      source.removeEventListener('badge.earned', handleBadgeEarned);
      source.close();
    };
  }, [userId]);
}
