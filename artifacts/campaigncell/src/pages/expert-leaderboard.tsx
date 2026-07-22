import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useGetLeaderboard, getGetLeaderboardQueryKey } from '@workspace/api-client-react';
import { Loader2, Trophy, Medal } from 'lucide-react';

// gamification-service returns the Turkish level names it actually computes
// (see services/gamification-service/src/lib/levelCalculator.ts) — the
// English keys the generated client's type suggests don't occur at runtime.
const levelColors: Record<string, string> = {
  BRONZ: 'bg-orange-100 text-orange-700',
  'GÜMÜŞ': 'bg-gray-100 text-gray-700',
  ALTIN: 'bg-yellow-100 text-yellow-700',
  PLATIN: 'bg-purple-100 text-purple-700',
};

export default function ExpertLeaderboard() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'all_time'>('daily');

  const { data: leaderboardResponse, isLoading } = useGetLeaderboard(
    { period },
    { query: { queryKey: getGetLeaderboardQueryKey({ period }) } }
  );
  // gamification-service nests the payload as `data.{period,entries}`, not
  // directly on the response root.
  const leaderboard = (leaderboardResponse as unknown as { data?: typeof leaderboardResponse })?.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground mt-1">Top performing campaign experts</p>
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="all_time">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              {(leaderboard?.entries ?? []).map((entry) => {
                const initials = (entry.name ?? '').split(' ').map((n) => n[0]).join('');
                const isTopThree = entry.rank <= 3;

                return (
                  <Card
                    key={entry.userId}
                    className={`p-6 ${isTopThree ? 'border-primary border-2' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted font-bold text-lg">
                        {entry.rank === 1 && <Trophy className="h-6 w-6 text-yellow-500" />}
                        {entry.rank === 2 && <Medal className="h-6 w-6 text-gray-400" />}
                        {entry.rank === 3 && <Medal className="h-6 w-6 text-orange-500" />}
                        {entry.rank > 3 && `#${entry.rank}`}
                      </div>

                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{entry.name}</h3>
                          <Badge className={levelColors[entry.level]}>{entry.level}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.completedCases} cases completed • {entry.badges || 0} badges
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{entry.points}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {(leaderboard?.entries ?? []).length === 0 && (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">No leaderboard data available</p>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
