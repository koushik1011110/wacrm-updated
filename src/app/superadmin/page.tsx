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
  Ticket,
  Sparkles,
  Gift,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Crown,
  Ban,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface AccountSubscription {
  status: string;
  expires_at: string;
  is_free_grant: boolean;
  applied_coupon_code: string | null;
}

interface AccountRow {
  id: string;
  name: string;
  wallet_balance_inr: number;
  user_count: number;
  created_at: string;
  subscription: AccountSubscription | null;
}

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  is_100_percent_free: boolean;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface PortalData {
  total_users: number;
  total_accounts: number;
  total_tokens_used: number;
  total_cost_inr: number;
  token_rate_per_1k_inr: number;
  monthly_subscription_price_inr: number;
  coupons: Coupon[];
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

  // Rate & Subscription Price editor state
  const [rateInput, setRateInput] = useState<string>('0.15');
  const [savingRate, setSavingRate] = useState(false);
  const [subPriceInput, setSubPriceInput] = useState<string>('499.00');
  const [savingSubPrice, setSavingSubPrice] = useState(false);

  // Balance edit modal / inline state
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [savingBalance, setSavingBalance] = useState(false);

  // New Coupon form state
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState('100');
  const [newCouponMaxUses, setNewCouponMaxUses] = useState('');
  const [is100Free, setIs100Free] = useState(true);
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  // Grant Free Pro Subscription state
  const [grantingAccountId, setGrantingAccountId] = useState<string | null>(null);

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
        setSubPriceInput(String(json.monthly_subscription_price_inr ?? 499.00));
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

  const handleSaveSubPrice = async () => {
    const priceNum = Number(subPriceInput);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error('Enter a valid monthly subscription price');
      return;
    }
    setSavingSubPrice(true);
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_subscription_price', price: priceNum }),
      });
      if (res.ok) {
        toast.success('Monthly subscription price updated');
        void fetchPortalData();
      } else {
        toast.error('Failed to update price');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingSubPrice(false);
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

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCouponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    setCreatingCoupon(true);
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_coupon',
          code: newCouponCode,
          discount_percent: is100Free ? 100 : Number(newCouponDiscount || 100),
          is_100_percent_free: is100Free,
          max_uses: newCouponMaxUses ? Number(newCouponMaxUses) : null,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Coupon '${newCouponCode.toUpperCase()}' created successfully!`);
        setNewCouponCode('');
        setNewCouponDiscount('100');
        setNewCouponMaxUses('');
        setIs100Free(true);
        void fetchPortalData();
      } else {
        toast.error(json.error || 'Failed to create coupon');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleToggleCoupon = async (couponId: string, currentActive: boolean) => {
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_coupon', coupon_id: couponId, is_active: !currentActive }),
      });
      if (res.ok) {
        toast.success(currentActive ? 'Coupon deactivated' : 'Coupon activated');
        void fetchPortalData();
      }
    } catch {
      toast.error('Failed to toggle coupon status');
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_coupon', coupon_id: couponId }),
      });
      if (res.ok) {
        toast.success('Coupon deleted');
        void fetchPortalData();
      }
    } catch {
      toast.error('Failed to delete coupon');
    }
  };

  const handleGrantFreeSubscription = async (accountId: string, days = 30) => {
    setGrantingAccountId(accountId);
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant_free_subscription', account_id: accountId, days }),
      });
      if (res.ok) {
        toast.success(`Free Pro benefits granted for ${days} days!`);
        void fetchPortalData();
      } else {
        toast.error('Failed to grant free subscription');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setGrantingAccountId(null);
    }
  };

  const handleRevokeSubscription = async (accountId: string) => {
    if (!confirm('Are you sure you want to revoke Pro subscription for this account?')) return;
    setGrantingAccountId(accountId);
    try {
      const res = await fetch('/api/superadmin/portal/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_subscription', account_id: accountId }),
      });
      if (res.ok) {
        toast.success('Subscription revoked');
        void fetchPortalData();
      } else {
        toast.error('Failed to revoke subscription');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setGrantingAccountId(null);
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Superadmin SaaS Portal</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage PayU subscription pricing, generate coupon codes, grant free Pro benefits, and monitor usage.
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

      {/* Top Overview Cards */}
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
            <p className="text-[11px] text-muted-foreground mt-1">Across all registered accounts</p>
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
            <CardTitle className="text-xs font-medium text-muted-foreground">Monthly Sub Price</CardTitle>
            <Crown className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{portalData?.monthly_subscription_price_inr ?? '499.00'}/mo
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">PayU gateway subscription cost</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Coupons</CardTitle>
            <Ticket className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {portalData?.coupons?.filter((c) => c.is_active).length ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Available for free/discount upgrades</p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing & AI Rate Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Subscription Pricing Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-foreground">
              <Crown className="h-4 w-4 text-amber-400" /> Monthly Subscription Pricing (PayU)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Set the monthly fee (in ₹) for upgrading to Pro features (AI Agent & Bookings).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Monthly Fee (₹):</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={subPriceInput}
                  onChange={(e) => setSubPriceInput(e.target.value)}
                  className="w-36 border-border bg-muted font-mono font-bold text-foreground"
                />
              </div>
              <Button onClick={handleSaveSubPrice} disabled={savingSubPrice} className="gap-2">
                {savingSubPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Subscription Price
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Global AI Token Pricing Card */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-foreground">
              <IndianRupee className="h-4 w-4 text-emerald-400" /> Global AI Token Pricing
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Set the rate deducted from account balances per 1,000 AI tokens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Rate (₹ / 1k Tokens):</span>
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
      </div>

      {/* Coupon Codes Management Card */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Ticket className="h-4 w-4 text-emerald-400" /> Coupon Codes & Free Access Grants
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Create coupon codes to grant users 100% free access or percentage discounts on monthly subscriptions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Coupon Form */}
          <form onSubmit={handleCreateCoupon} className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <PlusCircle className="h-4 w-4 text-primary" /> Create New Coupon Code
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="coupon-code" className="text-xs">Coupon Code</Label>
                <Input
                  id="coupon-code"
                  placeholder="e.g. FREEVIP100"
                  value={newCouponCode}
                  onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
                  className="uppercase font-mono border-border bg-muted"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Access Type</Label>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant={is100Free ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setIs100Free(true);
                      setNewCouponDiscount('100');
                    }}
                  >
                    <Gift className="mr-1 h-3.5 w-3.5" /> 100% Free
                  </Button>
                  <Button
                    type="button"
                    variant={!is100Free ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setIs100Free(false);
                      setNewCouponDiscount('50');
                    }}
                  >
                    % Discount
                  </Button>
                </div>
              </div>

              {!is100Free && (
                <div className="space-y-1.5">
                  <Label htmlFor="discount-pct" className="text-xs">Discount Percentage (%)</Label>
                  <Input
                    id="discount-pct"
                    type="number"
                    min="1"
                    max="99"
                    value={newCouponDiscount}
                    onChange={(e) => setNewCouponDiscount(e.target.value)}
                    className="border-border bg-muted font-mono"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="max-uses" className="text-xs">Max Uses (Leave blank for unlimited)</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={newCouponMaxUses}
                  onChange={(e) => setNewCouponMaxUses(e.target.value)}
                  className="border-border bg-muted font-mono"
                />
              </div>
            </div>

            <Button type="submit" disabled={creatingCoupon} size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              {creatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
              Create Coupon Code
            </Button>
          </form>

          {/* Coupon Codes Table */}
          {portalData?.coupons && portalData.coupons.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-3">Coupon Code</th>
                    <th className="p-3">Benefit</th>
                    <th className="p-3">Usage Count</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {portalData.coupons.map((cpn) => (
                    <tr key={cpn.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-bold text-primary flex items-center gap-1.5">
                        <Ticket className="h-3.5 w-3.5 text-emerald-400" /> {cpn.code}
                      </td>
                      <td className="p-3">
                        {cpn.is_100_percent_free || cpn.discount_percent >= 100 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                            <Gift className="h-3 w-3" /> 100% Free Pro
                          </span>
                        ) : (
                          <span className="font-semibold text-foreground">
                            {cpn.discount_percent}% OFF
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {cpn.used_count} / {cpn.max_uses ?? '∞'} used
                      </td>
                      <td className="p-3">
                        {cpn.is_active ? (
                          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                            <Ban className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleToggleCoupon(cpn.id, cpn.is_active)}
                        >
                          {cpn.is_active ? (
                            <span className="text-amber-400 flex items-center gap-1"><ToggleRight className="h-4 w-4" /> Deactivate</span>
                          ) : (
                            <span className="text-emerald-400 flex items-center gap-1"><ToggleLeft className="h-4 w-4" /> Activate</span>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCoupon(cpn.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No coupon codes created yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspaces, Subscriptions & Account Balances Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Building2 className="h-4 w-4 text-primary" /> Workspaces & Subscription Control
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Monitor plan statuses, grant free Pro subscriptions, or edit wallet balances for any workspace.
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
                    <th className="p-3">Subscription Status</th>
                    <th className="p-3">Wallet Balance (₹)</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {portalData.accounts.map((acc) => {
                    const hasSub = Boolean(acc.subscription);
                    return (
                      <tr key={acc.id} className="hover:bg-muted/20">
                        <td className="p-3 font-semibold text-foreground">{acc.name}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            <Users className="h-3 w-3" /> {acc.user_count} user{acc.user_count === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="p-3">
                          {hasSub ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                                <Crown className="h-3 w-3" />
                                {acc.subscription?.is_free_grant ? 'Pro (Free Grant)' : 'Pro Plan Active'}
                              </span>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Expires: {new Date(acc.subscription!.expires_at).toLocaleDateString()}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                              Free Plan (Basic)
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold font-mono text-emerald-400">
                          ₹{acc.wallet_balance_inr.toFixed(2)}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {/* Grant/Revoke Subscription Action */}
                          {hasSub ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-amber-400 hover:text-amber-300 border-amber-400/30"
                              onClick={() => handleRevokeSubscription(acc.id)}
                              disabled={grantingAccountId === acc.id}
                            >
                              {grantingAccountId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5 mr-1" />}
                              Revoke Pro
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs text-emerald-400 hover:text-emerald-300 border-emerald-500/30"
                              onClick={() => handleGrantFreeSubscription(acc.id, 30)}
                              disabled={grantingAccountId === acc.id}
                            >
                              {grantingAccountId === acc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5 mr-1" />}
                              Grant Free Pro (30d)
                            </Button>
                          )}

                          {/* Edit Balance Action */}
                          {editingAccountId === acc.id ? (
                            <div className="inline-flex items-center gap-2">
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
                    );
                  })}
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
