import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useGetSubscriberCampaigns,
  useAcceptOffer,
  useRejectOffer,
  useRateOffer,
  getGetSubscriberCampaignsQueryKey,
} from '@workspace/api-client-react';
import { Loader2, Star, CheckCircle, XCircle, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { SubscriberCampaign } from '@workspace/api-client-react';

export default function SubscriberPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const subscriberId = user?.id || '';

  const { data: campaigns, isLoading } = useGetSubscriberCampaigns(subscriberId, {
    query: { enabled: !!subscriberId, queryKey: getGetSubscriberCampaignsQueryKey(subscriberId) },
  });

  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();
  const rateOffer = useRateOffer();

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; campaign: SubscriberCampaign | null }>({
    open: false,
    campaign: null,
  });
  const [rejectReason, setRejectReason] = useState('');

  const [ratingDialog, setRatingDialog] = useState<{ open: boolean; campaign: SubscriberCampaign | null }>({
    open: false,
    campaign: null,
  });
  const [rating, setRating] = useState(0);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetSubscriberCampaignsQueryKey(subscriberId) });

  const handleAccept = (campaign: SubscriberCampaign) => {
    // API: POST /api/v1/subscribers/:subscriberId/offers/:campaignId/accept
    acceptOffer.mutate(
      { id: subscriberId, campaignId: campaign.campaignId },
      {
        onSuccess: () => {
          toast({ title: 'Offer Accepted', description: 'You have accepted this campaign offer.' });
          invalidate();
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to accept offer', variant: 'destructive' });
        },
      }
    );
  };

  const handleReject = () => {
    if (!rejectDialog.campaign || !rejectReason) return;

    // API: POST /api/v1/subscribers/:subscriberId/offers/:campaignId/reject
    rejectOffer.mutate(
      { id: subscriberId, campaignId: rejectDialog.campaign.campaignId, data: { reason: rejectReason } },
      {
        onSuccess: () => {
          toast({ title: 'Offer Rejected', description: 'Thank you for your feedback.' });
          invalidate();
          setRejectDialog({ open: false, campaign: null });
          setRejectReason('');
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to reject offer', variant: 'destructive' });
        },
      }
    );
  };

  const handleRate = () => {
    if (!ratingDialog.campaign || rating === 0) return;

    // API: POST /api/v1/subscribers/:subscriberId/offers/:campaignId/rate
    rateOffer.mutate(
      { id: subscriberId, campaignId: ratingDialog.campaign.campaignId, data: { rating } },
      {
        onSuccess: () => {
          toast({ title: 'Rating Submitted', description: 'Thank you for rating this offer!' });
          invalidate();
          setRatingDialog({ open: false, campaign: null });
          setRating(0);
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to submit rating', variant: 'destructive' });
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

  const campaignData = campaigns?.data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Offers</h1>
        <p className="text-muted-foreground mt-1">Personalized campaign recommendations for you</p>
      </div>

      {campaignData.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No campaign offers available at the moment.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaignData.map((campaign) => (
            <Card key={campaign.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{campaign.name}</h3>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{campaign.type}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">{campaign.discount}% OFF</div>
                  {campaign.validUntil && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Valid until {new Date(campaign.validUntil).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {/* AI Reasoning */}
              {campaign.aiReasoning && (
                <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-primary">AI Recommendation</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{campaign.aiReasoning}</p>
                </div>
              )}

              {/* Scores */}
              <div className="flex gap-4 mb-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Match Score: </span>
                  <span className="font-bold text-primary">
                    {(campaign.recommendationScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Conv. Prob: </span>
                  <span className="font-bold">
                    {(campaign.conversionProbability * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Rating display */}
              {campaign.status === 'RATED' && campaign.rating && (
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < campaign.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground ml-1">Your rating</span>
                </div>
              )}

              {campaign.rejectionReason && (
                <p className="text-sm text-muted-foreground mb-4">
                  Rejection reason: {campaign.rejectionReason}
                </p>
              )}

              {/* Action Buttons */}
              {campaign.status === 'PENDING' && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAccept(campaign)}
                    disabled={acceptOffer.isPending}
                    className="gap-2"
                    data-testid={`button-accept-${campaign.id}`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Accept Offer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialog({ open: true, campaign })}
                    className="gap-2"
                    data-testid={`button-reject-${campaign.id}`}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}

              {campaign.status === 'ACCEPTED' && (
                <Button
                  variant="outline"
                  onClick={() => setRatingDialog({ open: true, campaign })}
                  className="gap-2"
                  data-testid={`button-rate-${campaign.id}`}
                >
                  <Star className="h-4 w-4" />
                  Rate This Offer
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, campaign: open ? rejectDialog.campaign : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Offer</DialogTitle>
            <DialogDescription>Please tell us why you're rejecting this offer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Not interested, already subscribed, price too high..."
              rows={3}
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, campaign: null })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason || rejectOffer.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectOffer.isPending ? 'Rejecting...' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Dialog */}
      <Dialog open={ratingDialog.open} onOpenChange={(open) => setRatingDialog({ open, campaign: open ? ratingDialog.campaign : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate This Offer</DialogTitle>
            <DialogDescription>How satisfied are you with this campaign offer?</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 py-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setRating(i + 1)}
                className="focus:outline-none transition-transform hover:scale-110"
                data-testid={`star-rating-${i + 1}`}
              >
                <Star
                  className={`h-10 w-10 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {rating === 0 ? 'Select a rating' : `${rating} star${rating > 1 ? 's' : ''}`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingDialog({ open: false, campaign: null })}>
              Cancel
            </Button>
            <Button
              onClick={handleRate}
              disabled={rating === 0 || rateOffer.isPending}
              data-testid="button-submit-rating"
            >
              {rateOffer.isPending ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
