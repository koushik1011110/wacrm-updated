'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Shield,
  Users,
  Building2,
  Cpu,
  IndianRupee,
  Save,
  PlusCircle,
  LogOut,
  Loader2,
  RefreshCw,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AccountRow {
  id: string;
  name: string;
  wallet_balance_inr: number;
  user_count: number;
  created_at: string;
}

interface PortalData {
  total_users: number;
  total_accounts: number;
  total_tokens_used: number;
  total_cost_inr: number;
  token_rate_per_1k_inr: number;
  accounts: AccountRow[];
}

export default function SuperadminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loginLoading, setLoginLoading] = useState(false);

  // Portal data state
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Rate editor state
  const [rateInput, setRateInput] = useState<string>('0.15');
  const [savingRate, setSavingRate] = useState(false);

  // Balance edit modal / inline state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [savingBalance, setSavingBalance] = useState(false);

  // Check auth status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/superadmin/auth/check');
      const json = await res.json();
      setAuthenticated(json.authenticated);
      if (json.authenticated) {
        void fetchPortalData();
      }
    } catch {
      setAuthenticated(false);
    }
  }, []);

  const fetchPortalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/superadmin/portal/data');
      if (res.ok) {
        const json = await res.json();
        setPortalData(json);
        setRateInput(String(json.token_rate_per_1k_inr ?? 0.15));
      } else if (res.status === 401) {
        setAuthenticated(false);
      }
    } catch (err) {
      console.error('Failed to load superadmin portal data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch('/api/superadmin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast.success('Superadmin access granted');
        setAuthenticated(true);
        void fetchPortalData();
      } else {
        toast.error(json.error || 'Invalid credentials');
      }
    } catch {
      toast.error('Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/superadmin/auth/logout', { method: 'POST' });
      setAuthenticated(false);
      setPortalData(null);
      toast.success('Logged out');
    } catch {
      toast.error('Logout failed');
    }
  };

  const handleSaveRate = async () => {
    const rateNum = Number(rateInput);
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error('Enter a valid token rate amount');
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_token_rate', rate: rateNum }),
      });
      if (res.ok) {
        toast.success('Global AI token rate updated');
        void fetchPortalData();
      } else {
        toast.error('Failed to update rate');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingRate(false);
    }
  };

  const handleUpdateBalance = async (accountId: string) => {
    const val = Number(balanceInput);
    if (isNaN(val) || val < 0) {
      toast.error('Enter a valid balance amount in ₹');
      return;
    }
    setSavingBalance(true);
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_balance', account_id: accountId, balance: val }),
      });
      if (res.ok) {
        toast.success('Account balance updated successfully');
        setEditingAccountId(null);
        setBalanceInput('');
        void fetchPortalData();
      } else {
        toast.error('Failed to update balance');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingBalance(false);
    }
  };

  if (authenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Render Superadmin Login view if not authenticated
  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground font-bold">Superadmin Portal</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sign in with hardcoded superadmin credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sa-username">Username</Label>
                <Input
                  id="sa-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="border-border bg-muted text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sa-password">Password</Label>
                <Input
                  id="sa-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin"
                  required
                  className="border-border bg-muted text-foreground"
                />
              </div>

              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Default Credentials:</span>
                <br />
                Username: <code className="text-primary font-mono font-bold">admin</code> | Password: <code className="text-primary font-mono font-bold">admin</code>
              </div>

              <Button type="submit" disabled={loginLoading} className="w-full bg-primary text-primary-foreground">
                {loginLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Sign In to Superadmin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Superadmin Portal Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Superadmin Portal</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Global management portal — monitor user counts, edit token pricing, and update account balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchPortalData} disabled={loadingData}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Top 4 Stat Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {portalData?.total_users ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Across all workspaces</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {portalData?.total_accounts ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Active customer accounts</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total AI Tokens Used</CardTitle>
            <Cpu className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {portalData?.total_tokens_used?.toLocaleString() ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Global AI prompts + completions</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Token Rate (₹ / 1k)</CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{portalData?.token_rate_per_1k_inr ?? '0.15'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Deducted per 1,000 tokens</p>
          </CardContent>
        </Card>
      </div>

      {/* Global Token Pricing Settings Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <IndianRupee className="h-4 w-4 text-emerald-400" /> Global AI Token Pricing
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Set the rate deducted from account balances per 1,000 tokens consumed by AI agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Rate (₹ per 1,000 Tokens):</span>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-32 border-border bg-muted font-mono"
              />
            </div>
            <Button onClick={handleSaveRate} disabled={savingRate} className="gap-2">
              {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Token Rate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Workspaces & Account Balance Management Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Building2 className="h-4 w-4 text-primary" /> Workspaces & Account Balances
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            View user counts and update or credit wallet balances (in ₹) for each workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portalData?.accounts && portalData.accounts.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-3">Workspace Name</th>
                    <th className="p-3">Users</th>
                    <th className="p-3">Wallet Balance (₹)</th>
                    <th className="p-3">Created Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {portalData.accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/20">
                      <td className="p-3 font-semibold text-foreground">{acc.name}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          <Users className="h-3 w-3" /> {acc.user_count} user{acc.user_count === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="p-3 font-bold font-mono text-emerald-400">
                        ₹{acc.wallet_balance_inr.toFixed(2)}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(acc.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        {editingAccountId === acc.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              min="0"
                              value={balanceInput}
                              onChange={(e) => setBalanceInput(e.target.value)}
                              placeholder={String(acc.wallet_balance_inr)}
                              className="w-28 h-8 text-xs border-border bg-muted font-mono"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => handleUpdateBalance(acc.id)}
                              disabled={savingBalance}
                            >
                              {savingBalance ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => {
                                setEditingAccountId(null);
                                setBalanceInput('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => {
                              setEditingAccountId(acc.id);
                              setBalanceInput(String(acc.wallet_balance_inr));
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-primary" /> Edit Balance
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No workspaces found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
