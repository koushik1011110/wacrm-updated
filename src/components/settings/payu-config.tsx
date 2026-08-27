'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Save, ShieldCheck, Loader2, Key, Lock, Radio } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function PayUConfig() {
  const [merchantKey, setMerchantKey] = useState('');
  const [merchantSalt, setMerchantSalt] = useState('');
  const [env, setEnv] = useState<'TEST' | 'PROD'>('PROD');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const res = await fetch('/api/payments/payu/config');
        if (res.ok) {
          const json = await res.json();
          setMerchantKey(json.merchant_key || '');
          setMerchantSalt(json.merchant_salt || '');
          setEnv(json.env === 'PROD' ? 'PROD' : 'TEST');
          setIsCustom(Boolean(json.is_custom));
        }
      } catch {
        toast.error('Failed to load PayU settings');
      } finally {
        setLoading(false);
      }
    }

    void loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantKey.trim() || !merchantSalt.trim()) {
      toast.error('Please enter both PayU Merchant Key and Merchant Salt');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/payments/payu/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_key: merchantKey.trim(),
          merchant_salt: merchantSalt.trim(),
          env,
        }),
      });

      if (res.ok) {
        toast.success('PayU payment gateway credentials saved successfully!');
        setIsCustom(true);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Failed to save PayU settings');
      }
    } catch {
      toast.error('Network error saving PayU settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base text-foreground">PayU Payment Gateway Setup</CardTitle>
          </div>
          {isCustom ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Custom Account Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              Default Shared Credentials
            </span>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Enter your personal PayU Merchant credentials so customer advance payments go directly into your bank account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-muted-foreground" /> PayU Merchant Key
            </label>
            <Input
              type="text"
              value={merchantKey}
              onChange={(e) => setMerchantKey(e.target.value)}
              placeholder="e.g. GTK32n or your live Merchant Key"
              className="border-border bg-muted font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" /> PayU Merchant Salt
            </label>
            <Input
              type="password"
              value={merchantSalt}
              onChange={(e) => setMerchantSalt(e.target.value)}
              placeholder="Enter your PayU Merchant Salt"
              className="border-border bg-muted font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-muted-foreground" /> PayU Environment
            </label>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-foreground">
                <input
                  type="radio"
                  name="payu_env"
                  value="PROD"
                  checked={env === 'PROD'}
                  onChange={() => setEnv('PROD')}
                  className="accent-primary"
                />
                Live Production (PROD) - Real Customer Payments
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-foreground">
                <input
                  type="radio"
                  name="payu_env"
                  value="TEST"
                  checked={env === 'TEST'}
                  onChange={() => setEnv('TEST')}
                  className="accent-primary"
                />
                Sandbox Test (TEST)
              </label>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full sm:w-auto h-9 gap-1.5 text-xs font-semibold">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save PayU Credentials
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
