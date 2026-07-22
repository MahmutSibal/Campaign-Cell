import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useGetGameProfile, useListBadges, getGetGameProfileQueryKey, getListBadgesQueryKey } from '@workspace/api-client-react';
import { Loader2, Award, Trophy } from 'lucide-react';

const levelColors = {
  BRONZE: 'bg-orange-100 text-orange-700 border-orange-300',
  SILVER: 'bg-gray-100 text-gray-700 border-gray-300',
  GOLD: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  PLATINUM: 'bg-purple-100 text-purple-700 border-purple-300',
};

export default function ExpertAchievements() {
  const { user } = useAuth();
  
  const { data: profile, isLoading: profileLoading } = useGetGameProfile(user?.id || '', {
    query: { enabled: !!user?.id, queryKey: getGetGameProfileQueryKey(user?.id || '') },
  });
  
  const { data: allBadges, isLoading: badgesLoading } = useListBadges({
    query: { queryKey: getListBadgesQueryKey() },
  });

  if (profileLoading || badgesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const earnedBadges = profile?.badges || [];
  const earnedBadgeIds = new Set(earnedBadges.map((b) => b.id));
  const lockedBadges = (allBadges?.data || []).filter((b) => !earnedBadgeIds.has(b.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Achievements</h1>
        <p className="text-muted-foreground mt-1">Your badges and gamification progress</p>
      </div>

      {/* Profile Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{profile?.name}</h2>
            <div className="flex items-center gap-3">
              <Badge className={`${levelColors[profile?.level || 'BRONZE']} border-2`}>
                {profile?.level} LEVEL
              </Badge>
              <span className="text-muted-foreground">Rank #{profile?.rank}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{profile?.totalPoints}</div>
            <div className="text-sm text-muted-foreground">Total Points</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{profile?.completedCases}</div>
            <div className="text-sm text-muted-foreground">Cases Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{earnedBadges.length}</div>
            <div className="text-sm text-muted-foreground">Badges Earned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{(profile?.averagePerformance || 0).toFixed(1)}%</div>
            <div className="text-sm text-muted-foreground">Avg Performance</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progress to Next Level</span>
            <span className="font-medium">65%</span>
          </div>
          <Progress value={65} className="h-2" />
        </div>
      </Card>

      {/* Earned Badges */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Earned Badges ({earnedBadges.length})</h2>
        {earnedBadges.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {earnedBadges.map((badge) => (
              <Card key={badge.id} className="p-6 border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Award className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{badge.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{badge.description}</p>
                    <div className="text-xs text-muted-foreground">
                      Earned {badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : 'Recently'}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No badges earned yet. Complete cases to unlock achievements!</p>
          </Card>
        )}
      </div>

      {/* Locked Badges */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Locked Badges ({lockedBadges.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lockedBadges.map((badge) => (
            <Card key={badge.id} className="p-6 opacity-50">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Award className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">{badge.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{badge.description}</p>
                  <div className="text-xs text-muted-foreground">
                    Requirement: {badge.requirement}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
