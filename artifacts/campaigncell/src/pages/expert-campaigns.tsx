import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/StatusBadge';
import { PriorityBadge } from '@/components/PriorityBadge';
import { Badge } from '@/components/ui/badge';
import {
  useListCampaigns,
  useCreateCampaign,
  useAnalyzeCampaign,
  getListCampaignsQueryKey,
} from '@workspace/api-client-react';
import { Loader2, Plus, Search, Filter, Brain, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { CampaignInput, Campaign } from '@workspace/api-client-react';

export default function ExpertCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState({ status: '', segment: '', type: '', search: '' });
  const { data: campaigns, isLoading } = useListCampaigns(filters, {
    query: { queryKey: getListCampaignsQueryKey(filters) },
  });

  const createCampaign = useCreateCampaign();
  const analyzeCampaign = useAnalyzeCampaign();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [formData, setFormData] = useState<Partial<CampaignInput>>({
    name: '',
    description: '',
    type: undefined,
    segment: undefined,
    discount: 0,
    startDate: '',
    endDate: '',
  });
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    success: boolean;
    aiAvailable: boolean;
    message?: string;
    campaign?: Campaign;
  } | null>(null);

  const handleCreateCampaign = () => {
    if (!formData.name || !formData.type || !formData.startDate || !formData.endDate) {
      toast({ title: 'Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    createCampaign.mutate(
      {
        data: {
          name: formData.name,
          description: formData.description,
          type: formData.type!,
          segment: formData.segment,
          discount: formData.discount || 0,
          startDate: formData.startDate,
          endDate: formData.endDate,
        },
      },
      {
        onSuccess: (campaign) => {
          setCreatedCampaign(campaign);
          setWizardStep(3);
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
        },
      }
    );
  };

  const handleAnalyze = () => {
    if (!createdCampaign) return;

    setAnalyzing(true);
    analyzeCampaign.mutate(
      { id: createdCampaign.id },
      {
        onSuccess: (result) => {
          setAnalyzing(false);
          setAnalysisResult(result);
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey(filters) });
          
          if (result.aiAvailable) {
            toast({ title: 'AI Analysis Complete', description: 'Campaign optimized successfully' });
          } else {
            toast({
              title: 'AI Unavailable',
              description: 'Campaign queued for manual optimization',
              variant: 'destructive',
            });
          }
        },
        onError: () => {
          setAnalyzing(false);
          toast({ title: 'Error', description: 'Analysis failed', variant: 'destructive' });
        },
      }
    );
  };

  const resetWizard = () => {
    setWizardOpen(false);
    setWizardStep(1);
    setFormData({
      name: '',
      description: '',
      type: undefined,
      segment: undefined,
      discount: 0,
      startDate: '',
      endDate: '',
    });
    setCreatedCampaign(null);
    setAnalysisResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage and create campaigns</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="gap-2" data-testid="button-new-campaign">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9"
              data-testid="input-search-campaigns"
            />
          </div>
          <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
            <SelectTrigger data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="OPTIMIZING">Optimizing</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.segment} onValueChange={(value) => setFilters({ ...filters, segment: value })}>
            <SelectTrigger data-testid="select-filter-segment">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Segments</SelectItem>
              <SelectItem value="YUKSEK_DEGER">High Value</SelectItem>
              <SelectItem value="RISKLI_KAYIP">At Risk</SelectItem>
              <SelectItem value="YENI_ABONE">New Subscriber</SelectItem>
              <SelectItem value="PASIF">Passive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
            <SelectTrigger data-testid="select-filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="EK_PAKET">Extra Package</SelectItem>
              <SelectItem value="TARIFE_YUKSELTME">Tariff Upgrade</SelectItem>
              <SelectItem value="CIHAZ_FIRSATI">Device Offer</SelectItem>
              <SelectItem value="SADAKAT">Loyalty</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Campaigns List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns?.data.map((campaign) => (
            <Card key={campaign.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{campaign.name}</h3>
                    <StatusBadge status={campaign.status} />
                    <PriorityBadge priority={campaign.priority} />
                    {campaign.isAiAnalyzed && (
                      <Badge variant="outline" className="gap-1">
                        <Brain className="h-3 w-3" />
                        AI Optimized
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{campaign.description}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-muted-foreground">Type: <span className="font-medium text-foreground">{campaign.type}</span></span>
                    <span className="text-muted-foreground">Discount: <span className="font-medium text-foreground">{campaign.discount}%</span></span>
                    <span className="text-muted-foreground">
                      Period: <span className="font-medium text-foreground">
                        {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                </div>
                {campaign.conversionProbability && (
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Conversion Probability</div>
                    <div className="text-2xl font-bold text-primary">
                      {(campaign.conversionProbability * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
          {campaigns?.data.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No campaigns found. Create your first campaign!</p>
            </Card>
          )}
        </div>
      )}

      {/* Campaign Creation Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Campaign - Step {wizardStep} of 3</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && 'Enter campaign information'}
              {wizardStep === 2 && 'Select target segment'}
              {wizardStep === 3 && 'AI Analysis'}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name *</Label>
                <Input
                  id="campaign-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Summer Data Boost"
                  data-testid="input-campaign-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Campaign description..."
                  rows={3}
                  data-testid="textarea-campaign-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-type">Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as any })}>
                    <SelectTrigger id="campaign-type" data-testid="select-campaign-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EK_PAKET">Extra Package</SelectItem>
                      <SelectItem value="TARIFE_YUKSELTME">Tariff Upgrade</SelectItem>
                      <SelectItem value="CIHAZ_FIRSATI">Device Offer</SelectItem>
                      <SelectItem value="SADAKAT">Loyalty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-discount">Discount (%)</Label>
                  <Input
                    id="campaign-discount"
                    type="number"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
                    placeholder="20"
                    data-testid="input-campaign-discount"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-start">Start Date *</Label>
                  <Input
                    id="campaign-start"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    data-testid="input-campaign-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campaign-end">End Date *</Label>
                  <Input
                    id="campaign-end"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    data-testid="input-campaign-end"
                  />
                </div>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <Label>Target Segment (Optional - AI will auto-detect if not selected)</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'YUKSEK_DEGER', label: 'High Value', desc: 'Premium customers' },
                  { value: 'RISKLI_KAYIP', label: 'At Risk', desc: 'Churn prevention' },
                  { value: 'YENI_ABONE', label: 'New Subscriber', desc: 'Recent signups' },
                  { value: 'PASIF', label: 'Passive', desc: 'Low activity users' },
                ].map((seg) => (
                  <Card
                    key={seg.value}
                    className={`p-4 cursor-pointer transition-colors ${
                      formData.segment === seg.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFormData({ ...formData, segment: seg.value as any })}
                    data-testid={`card-segment-${seg.value.toLowerCase()}`}
                  >
                    <div className="font-medium mb-1">{seg.label}</div>
                    <div className="text-xs text-muted-foreground">{seg.desc}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              {!analyzing && !analysisResult && (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Campaign created. Ready for AI analysis?</p>
                  <Button onClick={handleAnalyze} data-testid="button-start-analysis">
                    Start AI Analysis
                  </Button>
                </div>
              )}

              {analyzing && (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="font-medium">AI analyzing campaign...</p>
                  <p className="text-sm text-muted-foreground">This may take a moment</p>
                </div>
              )}

              {analysisResult && (
                <div className="space-y-4">
                  {analysisResult.aiAvailable ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Brain className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-green-900 mb-1">AI Analysis Complete</div>
                          <p className="text-sm text-green-700">
                            Campaign optimized with AI recommendations. Segment: {analysisResult.campaign?.segment}, Priority: {analysisResult.campaign?.priority}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-amber-900 mb-1">AI Service Unavailable</div>
                          <p className="text-sm text-amber-700">
                            {analysisResult.message || 'Campaign created successfully and queued for manual optimization.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {wizardStep === 1 && (
              <>
                <Button variant="outline" onClick={resetWizard}>
                  Cancel
                </Button>
                <Button onClick={() => setWizardStep(2)} data-testid="button-wizard-next-1">
                  Next
                </Button>
              </>
            )}
            {wizardStep === 2 && (
              <>
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  Back
                </Button>
                <Button onClick={handleCreateCampaign} disabled={createCampaign.isPending} data-testid="button-wizard-create">
                  {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              </>
            )}
            {wizardStep === 3 && analysisResult && (
              <Button onClick={resetWizard} data-testid="button-wizard-done">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
