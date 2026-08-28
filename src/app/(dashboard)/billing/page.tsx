'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Crown,
  Sparkles,
  Ticket,
  CheckCircle2,
  Calendar,
  CreditCard,
  Loader2,
  Gift,
  ArrowRight,
  ShieldCheck,
  Zap,
  Bot,
  CalendarRange,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface SubscriptionInfo {
  id: string;
  status: string;
  expires_at: string;
  is_free_grant: boolean;
  applied_coupon_code: string | null;
}

export default function BillingPage() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(499.00);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_percent: number;
    is_100_percent_free: boolean;
    final_price_inr: number;
  } | null>(null);

  // Checkout loading
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscriptions/status');
      if (res.ok) {
        const json = await res.json();
        setIsPro(json.is_pro);
        setSubscription(json.subscription);
        setMonthlyPrice(json.monthly_price_inr || 499.00);
      }
    } catch (err) {
      console.error('Failed to load subscription status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();

    // Check query params for PayU payment response
    const success = searchParams.get('subscription_success');
    const error = searchParams.get('subscription_error');

    if (success) {
      toast.success('🎉 Monthly subscription activated successfully!');
    } else if (error) {
      toast.error('Payment failed or was canceled. Please try again.');
    }
  }, [fetchStatus, searchParams]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    setValidatingCoupon(true);
    try {
      const res = await fetch('/api/subscriptions/coupon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });

      const json = await res.json();
      if (res.ok && json.valid) {
        setAppliedCoupon({
          code: json.code,
          discount_percent: json.discount_percent,
          is_100_percent_free: json.is_100_percent_free,
          final_price_inr: json.final_price_inr,
        });
        toast.success(`Coupon '${json.code}' applied! ${json.is_100_percent_free ? '100% FREE Pro Plan' : `${json.discount_percent}% Discount`}`);
      } else {
        setAppliedCoupon(null);
        toast.error(json.error || 'Invalid coupon code');
      }
    } catch {
      toast.error('Failed to validate coupon code');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleInitiatePayment = async () => {
    setCheckoutLoading(true);
    try {
      // 1. Get status for account id
      const statusRes = await fetch('/api/subscriptions/status');
      const statusJson = await statusRes.json();

      if (!statusJson.account_id) {
        toast.error('Account workspace not found');
        setCheckoutLoading(false);
        return;
      }

      // 2. Initiate subscription API call
      const res = await fetch('/api/payments/payu/subscription/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: statusJson.account_id,
          coupon_code: appliedCoupon?.code || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || 'Failed to initiate checkout');
        setCheckoutLoading(false);
        return;
      }

      // If 100% free via coupon
      if (json.is_free) {
        toast.success('🎉 Subscription activated for free via coupon!');
        void fetchStatus();
        setCheckoutLoading(false);
        return;
      }

      // Submit PayU HTML Form automatically
      if (json.payu && json.payu.formData) {
        const { action, ...formData } = json.payu.formData;
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = action;

        Object.entries(formData).forEach(([key, value]) => {
          const hiddenField = document.createElement('input');
          hiddenField.type = 'hidden';
          hiddenField.name = key;
          hiddenField.value = String(value);
          form.appendChild(hiddenField);
        });

        document.body.appendChild(form);
        form.submit();
      }
    } catch (err: any) {
      toast.error('Payment initialization error');
      setCheckoutLoading(false);
    }
  };

  const effectivePrice = appliedCoupon ? appliedCoupon.final_price_inr : monthlyPrice;

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Crown className="h-7 w-7 text-amber-400" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">SaaS Subscription & Billing</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Upgrade your plan to unlock full AI Agent automation and Booking management features with PayU.
        </p>
      </div>

      {/* Current Plan Status Card */}
      <Card className={`border-2 ${isPro ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-card'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className={`h-5 w-5 ${isPro ? 'text-emerald-400' : 'text-muted-foreground'}`} />
              Current Plan Status
            </CardTitle>
            {isPro ? (
              <Badge className="bg-emerald-500 text-white font-semibold">
                <Crown className="mr-1 h-3.5 w-3.5" /> PRO PLAN ACTIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                FREE PLAN (BASIC)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPro && subscription ? (
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                Your workspace has full access to <strong>AI Agent Automation</strong>, <strong>WhatsApp Flow Bookings</strong>, and premium features!
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-primary" /> Valid Until: <strong>{new Date(subscription.expires_at).toLocaleDateString()}</strong>
                </span>
                {subscription.is_free_grant && (
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <Gift className="h-4 w-4" /> Free Grant / Coupon Benefit
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                You are currently on the Free Basic plan. Basic messaging is included for free.
              </p>
              <p className="text-xs text-amber-400 font-medium">
                ⚠️ Upgrade to Pro to enable AI Agent Bot responses and Booking systems.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pro Features Showcase & PayU Checkout Card */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: What's included in Pro Plan */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <Zap className="h-5 w-5 text-amber-400" /> What&apos;s Included in Pro Plan
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Everything you need to automate your business customer conversations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">AI Agent Automation</h4>
                <p className="text-xs text-muted-foreground">
                  Smart AI replies powered by OpenAI, Gemini, & DeepSeek for auto-replying to WhatsApp leads 24/7.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CalendarRange className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Booking & Advance Payment System</h4>
                <p className="text-xs text-muted-foreground">
                  Interactive WhatsApp slot selection and advance payment collection via PayU gateway.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Priority Support & High Limits</h4>
                <p className="text-xs text-muted-foreground">
                  Higher daily broadcast & automation limits with instant technical support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Upgrade / PayU Checkout Form */}
        <Card className="border-2 border-primary/30 bg-card shadow-xl flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between text-foreground">
              <span>Pro Plan Subscription</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                ₹{effectivePrice.toFixed(2)}<span className="text-xs text-muted-foreground font-normal">/mo</span>
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Monthly recurring SaaS subscription processed securely via PayU Gateway.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Coupon Code Section */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Ticket className="h-3.5 w-3.5 text-emerald-400" /> Have a Coupon Code?
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter Coupon Code (e.g. FREEVIP)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="uppercase font-mono text-xs border-border bg-muted"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleValidateCoupon}
                  disabled={validatingCoupon}
                  className="text-xs"
                >
                  {validatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                </Button>
              </div>

              {appliedCoupon && (
                <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  {appliedCoupon.is_100_percent_free
                    ? '100% FREE Access Coupon Applied!'
                    : `${appliedCoupon.discount_percent}% Discount Applied!`}
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="space-y-1.5 text-xs text-muted-foreground border-t border-border pt-3">
              <div className="flex justify-between">
                <span>Monthly Base Plan</span>
                <span>₹{monthlyPrice.toFixed(2)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-emerald-400 font-semibold">
                  <span>Coupon Discount ({appliedCoupon.code})</span>
                  <span>-₹{(monthlyPrice - effectivePrice).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border">
                <span>Total Payable Now</span>
                <span className="text-emerald-400">₹{effectivePrice.toFixed(2)}</span>
              </div>
            </div>

            {/* PayU Checkout Trigger Button */}
            <Button
              onClick={handleInitiatePayment}
              disabled={checkoutLoading}
              className="w-full bg-primary text-primary-foreground h-11 text-sm font-bold shadow-lg gap-2"
            >
              {checkoutLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : effectivePrice === 0 ? (
                <>
                  <Gift className="h-5 w-5 text-emerald-300" /> Activate 100% Free Pro Plan
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" /> Pay ₹{effectivePrice.toFixed(2)} via PayU <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
