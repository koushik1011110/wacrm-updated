'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Coins, IndianRupee, Save, PlusCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AccountOption {
  id: string;
  name: string;
  wallet_balance_inr: number;
}

export function SuperadminAiBillingCard() {
  const [loading, setLoading] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [addingBalance, setAddingBalance] = useState(false);

  const [tokenRate, setTokenRate] = useState<string>('0.15');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [creditAmount, setCreditAmount] = useState<string>('');

  const fetchBillingInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/billing');
      if (res.ok) {
        const json = await res.json();
        setTokenRate(String(json.token_rate_per_1k_inr ?? 0.15));
        setAccounts(json.accounts || []);
        if (json.accounts?.length > 0) {
          setSelectedAccountId(json.accounts[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load superadmin billing config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBillingInfo();
  }, [fetchBillingInfo]);

  const handleSaveRate = async () => {
    const rateNum = Number(tokenRate);
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error('Enter a valid token rate amount');
      return;
    }

    setSavingRate(true);
    try {
      const res = await fetch('/api/superadmin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_rate', rate: rateNum }),
      });
      if (res.ok) {
        toast.success('Global AI token rate updated');
      } else {
        toast.error('Failed to update token rate');
      }
    } catch {
      toast.error('Network error updating token rate');
    } finally {
      setSavingRate(false);
    }
  };

  const handleAddBalance = async () => {
    const amountNum = Number(creditAmount);
    if (!selectedAccountId) {
      toast.error('Select an account');
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Enter a valid credit amount in ₹');
      return;
    }

    setAddingBalance(true);
    try {
      const res = await fetch('/api/superadmin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_balance',
          account_id: selectedAccountId,
          amount: amountNum,
        }),
      });
      if (res.ok) {
        toast.success(`Successfully added ₹${amountNum} to account balance`);
        setCreditAmount('');
        await fetchBillingInfo();
      } else {
        toast.error('Failed to add balance');
      }
    } catch {
      toast.error('Network error adding balance');
    } finally {
      setAddingBalance(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <Coins className="h-4 w-4 text-primary" /> Superadmin AI Token Pricing & Account Balance
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Configure the global rate per 1,000 tokens (in ₹) and manage workspace wallet balances.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Token Pricing Rate Setting */}
        <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <IndianRupee className="h-4 w-4 text-emerald-400" /> Token Rate (₹ per 1,000 Tokens)
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={tokenRate}
              onChange={(e) => setTokenRate(e.target.value)}
              placeholder="0.15"
              disabled={loading || savingRate}
              className="max-w-[200px]"
            />
            <Button onClick={handleSaveRate} disabled={loading || savingRate}>
              {savingRate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Rate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Current global deduction rate applied to all AI agent token usages across workspaces.
          </p>
        </div>

        {/* Account Balance Management */}
        <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/20">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <PlusCircle className="h-4 w-4 text-primary" /> Credit Account Wallet Balance
          </Label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Select Account / Workspace</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={loading || accounts.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} (Balance: ₹{Number(acc.wallet_balance_inr || 0).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Add Balance Amount (₹)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="500"
                  disabled={loading || addingBalance}
                />
                <Button onClick={handleAddBalance} disabled={loading || addingBalance}>
                  {addingBalance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  Add Balance
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
