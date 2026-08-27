'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Cpu, IndianRupee, History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UsageLog {
  id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_inr: number;
  created_at: string;
}

interface UsageData {
  wallet_balance_inr: number;
  token_rate_per_1k_inr: number;
  total_tokens: number;
  total_cost_inr: number;
  recent_logs: UsageLog[];
}

export function AiUsageCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/usage');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch AI token usage:', err);
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" /> Token Usage & Wallet Balance
          </CardTitle>
          <CardDescription>
            Monitor AI token consumption and balance deducted in Rupees (₹).
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchUsage} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Metric Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <IndianRupee className="h-3.5 w-3.5 text-emerald-500" /> Current Wallet Balance
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              ₹{data?.wallet_balance_inr?.toFixed(2) ?? '0.00'}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Rate: ₹{data?.token_rate_per_1k_inr ?? '0.15'} per 1k tokens
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Cpu className="h-3.5 w-3.5 text-primary" /> Total Tokens Consumed
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {data?.total_tokens?.toLocaleString() ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Across all AI prompts & completions
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-amber-500" /> Total Cost Deducted
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              ₹{data?.total_cost_inr?.toFixed(4) ?? '0.0000'}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Calculated dynamically per token
            </div>
          </div>
        </div>

        {/* Recent Usage Logs */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="h-4 w-4 text-muted-foreground" /> Recent AI Token Activity
          </div>

          {data?.recent_logs && data.recent_logs.length > 0 ? (
            <div className="rounded-md border border-border overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2.5 font-medium">Time</th>
                    <th className="p-2.5 font-medium">Provider / Model</th>
                    <th className="p-2.5 font-medium text-right">Prompt</th>
                    <th className="p-2.5 font-medium text-right">Completion</th>
                    <th className="p-2.5 font-medium text-right">Total Tokens</th>
                    <th className="p-2.5 font-medium text-right">Cost (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recent_logs.slice(0, 5).map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="p-2.5 text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-2.5 font-medium text-foreground capitalize">
                        {log.provider} ({log.model})
                      </td>
                      <td className="p-2.5 text-right font-mono">{log.prompt_tokens}</td>
                      <td className="p-2.5 text-right font-mono">{log.completion_tokens}</td>
                      <td className="p-2.5 text-right font-mono font-medium">{log.total_tokens}</td>
                      <td className="p-2.5 text-right font-mono text-emerald-400">
                        ₹{Number(log.cost_inr).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-border bg-muted/10 p-4 text-center text-xs text-muted-foreground">
              No token usage logged yet. Generate replies or test AI agents to see token deductions here.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
