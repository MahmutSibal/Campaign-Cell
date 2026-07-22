import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BarChart3,
  Brain,
  Target,
  Zap,
  Users,
  TrendingUp,
  Shield,
  Award,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">CC</span>
            </div>
            <span className="font-semibold text-lg">CampaignCell</span>
          </div>
          <Link href="/login">
            <Button data-testid="button-login">Login</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            CampaignCell
          </h1>
          <p className="text-3xl font-semibold text-primary mb-4">
            Doğru Teklif. Doğru Müşteri. Doğru Zaman.
          </p>
          <p className="text-xl text-muted-foreground mb-3">
            Right Offer. Right Customer. Right Moment.
          </p>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            AI-powered Campaign Intelligence Platform for enterprise telecom marketing. Built for Turkcell CodeNight 2026.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="gap-2" data-testid="button-explore">
                <Zap className="h-5 w-5" />
                Explore Campaign Intelligence
              </Button>
            </Link>
            <Link href="/portal">
              <Button size="lg" variant="outline" data-testid="button-demo">
                View Live Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-muted/30 border-y">
        <div className="container mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">+1M</div>
              <div className="text-sm text-muted-foreground">Customer Profiles</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">87%</div>
              <div className="text-sm text-muted-foreground">AI Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">Campaign Intelligence</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">+18%</div>
              <div className="text-sm text-muted-foreground">Avg Conversion Lift</div>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">
            * Synthetic Demo Data for Turkcell CodeNight 2026 Hackathon
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="p-6">
            <Brain className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">AI-Powered Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Real-time campaign optimization with machine learning models trained on subscriber behavior patterns.
            </p>
          </Card>
          <Card className="p-6">
            <Target className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Smart Segmentation</h3>
            <p className="text-sm text-muted-foreground">
              Automatic subscriber categorization into high-value, at-risk, new, and passive segments.
            </p>
          </Card>
          <Card className="p-6">
            <BarChart3 className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Intelligence Center</h3>
            <p className="text-sm text-muted-foreground">
              Comprehensive dashboard with real-time KPIs, trends, and expert performance analytics.
            </p>
          </Card>
          <Card className="p-6">
            <TrendingUp className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">A/B Testing</h3>
            <p className="text-sm text-muted-foreground">
              Built-in experiment framework to test campaign variants and optimize conversion rates.
            </p>
          </Card>
          <Card className="p-6">
            <Users className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Customer 360</h3>
            <p className="text-sm text-muted-foreground">
              Complete subscriber profiles with usage patterns, churn risk, and personalized recommendations.
            </p>
          </Card>
          <Card className="p-6">
            <Award className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">Gamification</h3>
            <p className="text-sm text-muted-foreground">
              Expert leaderboards, badges, and achievement systems to drive performance excellence.
            </p>
          </Card>
        </div>
      </section>

      {/* Roles */}
      <section className="bg-muted/30 border-y">
        <div className="container mx-auto px-6 py-24">
          <h2 className="text-3xl font-bold text-center mb-12">Role-Based Access</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Subscriber Portal</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Personalized campaign offers with AI-powered recommendations, acceptance/rejection workflows, and rating system.
              </p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Campaign Expert</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Campaign creation wizard, optimization case management, AI insights, A/B experiments, and gamification achievements.
              </p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Supervisor</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Intelligence center with comprehensive analytics, expert performance monitoring, AI accuracy tracking, and override capabilities.
              </p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Admin</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                User management, role assignment, account locking, and complete audit log viewer with detailed action tracking.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">CC</span>
              </div>
              <span className="font-semibold">CampaignCell</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built for Turkcell CodeNight 2026 Hackathon
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
