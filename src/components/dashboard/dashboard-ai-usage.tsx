'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, IndianRupee, Coins, ArrowRight, RefreshCw, Bot } from 'lucide-react';

interface AiUsageSummary {
  wallet_balance_inr: number;
  token_rate_per_1k_inr: number;
  total_tokens: number;
  total_cost_inr: number;
}

export function DashboardAiUsage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AiUsageSummary | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/usage');
      if (res.ok) {
        const json = await res.json();
        setSummary(json);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard AI usage:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsage();
    const interval = setInterval(() => {
      void fetchUsage();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Bot className="h-5 w-5 text-primary" /> AI Agent Token & Wallet Summary
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Real-time balance and AI token consumption monitoring.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchUsage} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/agents">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              Manage Agents <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Balance Card */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5 text-emerald-400" /> Wallet Balance
            </div>
            <div className="mt-1.5 text-xl font-bold text-foreground">
              ₹{summary?.wallet_balance_inr?.toFixed(2) ?? '0.00'}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Rate: ₹{summary?.token_rate_per_1k_inr ?? '0.15'}/1k tokens
            </p>
          </div>

          {/* Tokens Consumed Card */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Cpu className="h-3.5 w-3.5 text-primary" /> Tokens Consumed
            </div>
            <div className="mt-1.5 text-xl font-bold text-foreground">
              {summary?.total_tokens?.toLocaleString() ?? 0}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Prompts + completions
            </p>
          </div>

          {/* Total AI Cost Card */}
          <div className="rounded-lg border border-border bg-muted/20 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-amber-400" /> Total Cost Deducted
            </div>
            <div className="mt-1.5 text-xl font-bold text-foreground">
              ₹{summary?.total_cost_inr?.toFixed(4) ?? '0.0000'}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Dynamically calculated
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
