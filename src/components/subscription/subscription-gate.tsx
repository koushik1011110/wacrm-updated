'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Lock, Sparkles, ArrowRight, Loader2, Gift } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SubscriptionGateProps {
  featureName: string;
  featureDescription?: string;
  children: React.ReactNode;
}

export function SubscriptionGate({
  featureName,
  featureDescription,
  children,
}: SubscriptionGateProps) {
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/subscriptions/status');
        if (res.ok) {
          const json = await res.json();
          setIsPro(json.is_pro);
        }
      } catch (err) {
        console.error('Subscription check failed:', err);
      } finally {
        setLoading(false);
      }
    }
    void checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // If account has active Pro subscription, render feature children
  if (isPro) {
    return <>{children}</>;
  }

  // Otherwise render Feature Lock Screen
  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
      <Card className="border-2 border-primary/20 bg-card shadow-2xl text-center max-w-lg w-full">
        <CardHeader className="space-y-3 pb-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <Lock className="h-7 w-7 text-amber-400" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold text-foreground">
              {featureName} Requires Pro Plan
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {featureDescription || `${featureName} is a premium feature available on Pro SaaS subscription.`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-left space-y-2 text-xs">
            <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
              <Crown className="h-4 w-4 text-amber-400" /> Unlock Pro Benefits:
            </div>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside pl-1">
              <li>Full access to <strong>AI Agent Bot Responses</strong></li>
              <li>Automated <strong>WhatsApp Booking System</strong> & PayU collections</li>
              <li>Priority customer support & high usage limits</li>
              <li>Use a <strong>Superadmin Coupon Code</strong> for 100% Free Access</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <Link href="/billing" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-primary text-primary-foreground font-bold gap-2">
                <Crown className="h-4 w-4 text-amber-300" /> Upgrade Plan / Redeem Coupon <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
