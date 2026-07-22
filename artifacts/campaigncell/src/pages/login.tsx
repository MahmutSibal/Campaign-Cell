import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@workspace/api-client-react';

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  // Personel girişi
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  // Abone girişi (GSM + OTP)
  const [gsm, setGsm] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [subscriberLoading, setSubscriberLoading] = useState(false);
  // İlk kez giriş yapan (henüz kayıtlı olmayan) abone için kayıt alanları
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [regEmail, setRegEmail] = useState('');

  const redirectMap: Record<UserProfile['role'], string> = {
    SUBSCRIBER: '/portal',
    CAMPAIGN_EXPERT: '/expert',
    SUPERVISOR: '/supervisor',
    ADMIN: '/admin',
  };

  const handleStaffLogin = async () => {
    if (!email || !password) {
      toast({ title: 'Hata', description: 'E-posta ve şifre gereklidir', variant: 'destructive' });
      return;
    }
    setStaffLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (res.ok) {
        applyAuthResult(body.data, redirectMap[(body.data.user as UserProfile).role] ?? '/');
        return;
      }
      toast({ title: 'Giriş başarısız', description: body.error || 'E-posta veya şifre hatalı', variant: 'destructive' });
    } catch {
      toast({ title: 'Giriş başarısız', description: 'Sunucuya ulaşılamadı', variant: 'destructive' });
    } finally {
      setStaffLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!gsm) {
      toast({ title: 'Hata', description: 'GSM numarası gereklidir', variant: 'destructive' });
      return;
    }
    setOtpLoading(true);
    try {
      await fetch('/api/v1/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gsmNumber: gsm }),
      });
      setOtpSent(true);
      toast({ title: 'OTP Gönderildi', description: 'Simülasyon OTP: 1234' });
    } catch {
      setOtpSent(true);
      toast({ title: 'OTP Gönderildi', description: 'Simülasyon OTP: 1234' });
    } finally {
      setOtpLoading(false);
    }
  };

  const applyAuthResult = (result: { accessToken: string; user: UserProfile }, redirectTo = '/portal') => {
    localStorage.setItem('campaigncell_token', result.accessToken);
    login(result.user, result.accessToken);
    setLocation(redirectTo);
  };

  const handleSubscriberLogin = async () => {
    if (!otp) {
      toast({ title: 'Hata', description: 'OTP gereklidir', variant: 'destructive' });
      return;
    }
    setSubscriberLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gsmNumber: gsm, otp }),
      });
      const body = await res.json();
      if (res.ok) {
        applyAuthResult(body.data);
        return;
      }
      if (res.status === 401) {
        // Bu GSM numarası kayıtlı değil — ilk kez giriş, kayıt formuna geç
        setNeedsRegistration(true);
        toast({ title: 'Yeni numara', description: 'Devam etmek için ad ve soyadınızı girin' });
        return;
      }
      toast({ title: 'Giriş başarısız', description: body.error || 'Geçersiz OTP', variant: 'destructive' });
    } catch {
      toast({ title: 'Giriş başarısız', description: 'Sunucuya ulaşılamadı', variant: 'destructive' });
    } finally {
      setSubscriberLoading(false);
    }
  };

  const handleSubscriberRegister = async () => {
    if (!ad || !soyad) {
      toast({ title: 'Hata', description: 'Ad ve soyad gereklidir', variant: 'destructive' });
      return;
    }
    setSubscriberLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad, soyad, gsmNumber: gsm, otp, email: regEmail || undefined }),
      });
      const body = await res.json();
      if (res.ok) {
        applyAuthResult(body.data);
        return;
      }
      toast({ title: 'Kayıt başarısız', description: body.error || 'Bir hata oluştu', variant: 'destructive' });
    } catch {
      toast({ title: 'Kayıt başarısız', description: 'Sunucuya ulaşılamadı', variant: 'destructive' });
    } finally {
      setSubscriberLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 rounded-xl bg-primary items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-2xl">CC</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">CampaignCell</h1>
          <p className="text-muted-foreground">Campaign Intelligence Platform</p>
        </div>

        <Card className="p-6">
          <Tabs defaultValue="staff" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="staff">Personel Girişi</TabsTrigger>
              <TabsTrigger value="subscriber">Abone Girişi</TabsTrigger>
            </TabsList>

            {/* PERSONEL */}
            <TabsContent value="staff" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ad.soyad@turkcell.com.tr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStaffLogin()}
                  autoComplete="current-password"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleStaffLogin}
                disabled={!email || !password || staffLoading}
              >
                {staffLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </TabsContent>

            {/* ABONE */}
            <TabsContent value="subscriber" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gsm">GSM Numarası</Label>
                <Input
                  id="gsm"
                  type="tel"
                  placeholder="+905351000000"
                  value={gsm}
                  onChange={(e) => setGsm(e.target.value)}
                  disabled={otpSent}
                />
              </div>

              {!otpSent ? (
                <Button
                  className="w-full"
                  onClick={handleRequestOtp}
                  disabled={!gsm || otpLoading}
                >
                  {otpLoading ? 'Gönderiliyor...' : 'OTP Gönder'}
                </Button>
              ) : !needsRegistration ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="otp">OTP Kodu</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="1234"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubscriberLogin()}
                      maxLength={6}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSubscriberLogin}
                    disabled={!otp || subscriberLoading}
                  >
                    {subscriberLoading ? 'Doğrulanıyor...' : 'Giriş Yap'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => { setOtpSent(false); setOtp(''); }}
                  >
                    GSM numarasını değiştir
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="ad">Ad</Label>
                    <Input id="ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ayşe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="soyad">Soyad</Label>
                    <Input id="soyad" value={soyad} onChange={(e) => setSoyad(e.target.value)} placeholder="Yılmaz" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regEmail">E-posta (opsiyonel)</Label>
                    <Input
                      id="regEmail"
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ayse@example.com"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubscriberRegister()}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSubscriberRegister}
                    disabled={!ad || !soyad || subscriberLoading}
                  >
                    {subscriberLoading ? 'Kaydediliyor...' : 'Kayıt Ol ve Giriş Yap'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => { setOtpSent(false); setOtp(''); setNeedsRegistration(false); }}
                  >
                    GSM numarasını değiştir
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Turkcell CodeNight 2026 — AI Campaign Intelligence
        </p>
      </div>
    </div>
  );
}
