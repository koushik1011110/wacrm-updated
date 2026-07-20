'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Unlink,
  ListTodo,
  Settings2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { loadFacebookSDK, resetFacebookSDK } from '@/lib/whatsapp/facebook-sdk';

function Facebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SettingsPanelHead } from './settings-panel-head';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';

const MASKED_TOKEN = '••••••••••••••••';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown';
type ResetReason = 'token_corrupted' | 'meta_api_error' | null;

interface OnboardingLog {
  id: string;
  stage: string;
  status: string;
  error_message: string | null;
  meta_error_code: number | null;
  created_at: string;
  waba_id: string | null;
  phone_number_id: string | null;
}

export function WhatsAppConfig() {
  const supabase = createClient();
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = useState<WhatsAppConfigType | any | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('unknown');
  const [resetReason, setResetReason] = useState<ResetReason>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const loadedAccountIdRef = useRef<string | null>(null);

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [pin, setPin] = useState('');
  const [tokenEdited, setTokenEdited] = useState(false);

  // Facebook JS SDK / Embedded Signup states
  const [sdkLoading, setSdkLoading] = useState(false);
  const [fbConfig, setFbConfig] = useState<{ appId: string; configId: string; apiVersion: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<OnboardingLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'facebook' | 'manual'>('facebook');

  const [sdkState, setSdkState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [sdkErrorMsg, setSdkErrorMsg] = useState<string | null>(null);
  const isConfigMissing = fbConfig !== null && (!fbConfig.appId || !fbConfig.configId);
  const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:';

  const isRegistered = Boolean(config?.registered_at);
  const lastRegistrationError = config?.last_registration_error ?? null;
  const [verifyingRegistration, setVerifyingRegistration] = useState(false);
  const [registrationProbe, setRegistrationProbe] = useState<any | null>(null);

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/whatsapp/webhook`
      : '';

  // Load Facebook JS SDK configuration
  useEffect(() => {
    async function loadFbConfig() {
      try {
        const res = await fetch('/api/whatsapp/embedded-signup/config');
        if (res.ok) {
          const data = await res.json();
          setFbConfig(data);
        }
      } catch (err) {
        console.error('Failed to load embedded signup configuration:', err);
      }
    }
    loadFbConfig();
  }, []);

  // Dynamically load and initialize Facebook SDK using Promise wrapper
  useEffect(() => {
    if (!fbConfig) return;

    if (!fbConfig.appId || !fbConfig.configId) {
      setSdkState('error');
      setSdkErrorMsg('Meta App ID or Embedded Signup Configuration ID is not configured in the server environment.');
      return;
    }

    setSdkState('loading');
    setSdkErrorMsg(null);
    loadFacebookSDK(fbConfig.appId, fbConfig.apiVersion || 'v21.0')
      .then(() => {
        setSdkState('ready');
        setSdkErrorMsg(null);
      })
      .catch((err: any) => {
        setSdkState('error');
        setSdkErrorMsg(err.message || 'Failed to load Facebook SDK.');
      });

    const handleSdkReady = () => {
      setSdkState('ready');
      setSdkErrorMsg(null);
    };

    window.addEventListener('facebook-sdk-ready', handleSdkReady);
    return () => {
      window.removeEventListener('facebook-sdk-ready', handleSdkReady);
    };
  }, [fbConfig]);

  const handleRetryLoadSdk = () => {
    if (!fbConfig?.appId) return;
    resetFacebookSDK();
    setSdkState('loading');
    setSdkErrorMsg(null);
    loadFacebookSDK(fbConfig.appId, fbConfig.apiVersion || 'v21.0')
      .then(() => {
        setSdkState('ready');
        setSdkErrorMsg(null);
      })
      .catch((err: any) => {
        setSdkState('error');
        setSdkErrorMsg(err.message || 'Failed to load Facebook SDK.');
      });
  };

  const fetchConfig = useCallback(async (acctId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('account_id', acctId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load config row:', error);
      }

      if (data) {
        setConfig(data);
        setPhoneNumberId(data.phone_number_id || '');
        setWabaId(data.waba_id || '');
        setAccessToken(MASKED_TOKEN);
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
      } else {
        setConfig(null);
        setPhoneNumberId('');
        setWabaId('');
        setAccessToken('');
        setVerifyToken('');
        setPin('');
        setTokenEdited(false);
      }
      setRegistrationProbe(null);

      if (data) {
        try {
          const res = await fetch('/api/whatsapp/config', { method: 'GET' });
          const payload = await res.json();

          if (payload.connected) {
            setConnectionStatus('connected');
            setResetReason(null);
            setStatusMessage('');
          } else {
            setConnectionStatus('disconnected');
            setResetReason(payload.needs_reset ? 'token_corrupted' : payload.reason === 'meta_api_error' ? 'meta_api_error' : null);
            setStatusMessage(payload.message || '');
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setConnectionStatus('disconnected');
        }
      } else {
        setConnectionStatus('disconnected');
        setResetReason(null);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('fetchConfig error:', err);
      toast.error('Failed to load WhatsApp configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      loadedAccountIdRef.current = null;
      setLoading(false);
      return;
    }
    if (loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user?.id, accountId, fetchConfig]);

  // Facebook Embedded Signup handler
  const handleFbConnect = async () => {
    if (!fbConfig?.appId || !fbConfig?.configId) {
      toast.error('Meta App Configuration is missing or incomplete.');
      return;
    }

    setSdkLoading(true);

    try {
      // 5. Wait for SDK loading/initialization inside the click handler
      await loadFacebookSDK(fbConfig.appId, fbConfig.apiVersion || 'v21.0');

      if (!(window as any).FB || typeof (window as any).FB.login !== 'function') {
        throw new Error('Facebook JavaScript SDK is not fully loaded or initialized.');
      }

      let receivedWabaId: string | null = null;
      let receivedPhoneId: string | null = null;

      const messageListener = (event: MessageEvent) => {
        // Validate origin before processing Embedded Signup event data
        if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') {
          return;
        }

        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'sharedArguments' && data.params) {
            receivedWabaId = data.params.whatsappBusinessAccountId || null;
            if (data.params.phoneParams?.phone_number_ids?.length > 0) {
              receivedPhoneId = data.params.phoneParams.phone_number_ids[0];
            }
          }
        } catch (err) {
          console.error('Error parsing popup message event:', err);
        }
      };

      window.addEventListener('message', messageListener);

      (window as any).FB.login(
        (response: any) => {
          window.removeEventListener('message', messageListener);

          if (response.authResponse?.code) {
            const authCode = response.authResponse.code;
            const waba = receivedWabaId || response.authResponse.waba_id;
            const phone = receivedPhoneId || response.authResponse.phone_number_id;

            if (!waba || !phone) {
              toast.error('Could not retrieve WhatsApp Business Account ID or Phone Number ID from the Meta session.');
              setSdkLoading(false);
              return;
            }

            fetch('/api/whatsapp/embedded-signup/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: authCode,
                waba_id: waba,
                phone_number_id: phone,
              }),
            })
              .then((callbackRes) => {
                callbackRes.json().then((data) => {
                  if (!callbackRes.ok) {
                    toast.error(data.error || 'Failed to complete Embedded Signup.');
                  } else {
                    toast.success('Connected successfully through Meta WhatsApp Embedded Signup!');
                    if (accountId) fetchConfig(accountId);
                  }
                  setSdkLoading(false);
                });
              })
              .catch((err) => {
                console.error('Callback error:', err);
                toast.error('Callback request failed.');
                setSdkLoading(false);
              });
          } else {
            toast.error('Embedded Signup process was cancelled or did not return an authorization code.');
            setSdkLoading(false);
          }
        },
        {
          config_id: fbConfig.configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            featureType: '',
            sessionInfoVersion: '3'
          },
        }
      );
    } catch (err: any) {
      console.error('Facebook SDK loading error:', err);
      toast.error(err.message || 'Failed to load Facebook SDK.');
      setSdkLoading(false);
    }
  };

  async function handleSave() {
    if (!phoneNumberId.trim()) {
      toast.error('Phone Number ID is required');
      return;
    }
    if (!config && (!accessToken.trim() || !tokenEdited)) {
      toast.error('Access Token is required for initial setup');
      return;
    }

    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim() || null,
        verify_token: verifyToken.trim() || null,
        pin: pin.trim() || null,
      };

      if (tokenEdited && accessToken !== MASKED_TOKEN && accessToken.trim()) {
        payload.access_token = accessToken.trim();
      } else if (config) {
        toast.error('Please re-enter the Access Token to save changes');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to save configuration');
        setSaving(false);
        return;
      }

      if (data.registered === false && data.registration_error) {
        toast.error(`Saved, but Meta couldn't register the number: ${data.registration_error}`, { duration: 12000 });
      } else if (data.registration_skipped) {
        toast.success('Credentials saved. Inbound registration was skipped (no PIN) — see Registration status.', { duration: 10000 });
        setPin('');
      } else {
        toast.success('WhatsApp manual connection verified and configured.');
        setPin('');
      }

      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshDetails() {
    try {
      setTesting(true);
      const res = await fetch('/api/whatsapp/config/refresh', { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Refreshed details: Connected to ${data.phone_info.verified_name || 'WhatsApp Account'}`);
        if (accountId) await fetchConfig(accountId);
      } else {
        toast.error(data.error || 'Failed to refresh connection details.');
      }
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error('Failed to contact verification endpoint.');
    } finally {
      setTesting(false);
    }
  }

  async function handleVerifyRegistration() {
    setVerifyingRegistration(true);
    setRegistrationProbe(null);
    try {
      const res = await fetch('/api/whatsapp/config/verify-registration', { method: 'GET' });
      const data = await res.json();
      setRegistrationProbe(data);
      if (data.live) {
        toast.success('Number is fully wired — Meta is delivering events.');
      } else {
        toast.error('Number is not fully registered. Verify settings below.');
      }
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('verify-registration failed:', err);
      toast.error('Could not reach the verification endpoint.');
    } finally {
      setVerifyingRegistration(false);
    }
  }

  async function handleReset() {
    if (!confirm('Are you sure you want to disconnect this WhatsApp number? This will deactivate inbound messages.')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/whatsapp/config', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to disconnect');
        return;
      }

      toast.success('WhatsApp configuration cleared.');
      setConfig(null);
      setPhoneNumberId('');
      setWabaId('');
      setAccessToken('');
      setVerifyToken('');
      setConnectionStatus('disconnected');
      setResetReason(null);
      setStatusMessage('');
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset configuration');
    } finally {
      setResetting(false);
    }
  }

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/whatsapp/embedded-signup/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleOpenLogs = () => {
    setShowLogs(true);
    fetchLogs();
  };

  function handleCopyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied to clipboard');
  }

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="WhatsApp connection"
          description="Connect your Meta WhatsApp Business API. Credentials, webhook, and setup steps all live here."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  // Render Connected Dashboard UI
  if (config && connectionStatus === 'connected') {
    return (
      <section className="animate-in fade-in-50 duration-200 space-y-6">
        <SettingsPanelHead
          title="WhatsApp connection"
          description="Connect your Meta WhatsApp Business API. Credentials, webhook, and setup steps all live here."
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            {/* Active Connection details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-foreground">Connected Account Status</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Details of your active Meta WhatsApp Cloud API connection.
                    </CardDescription>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/50 border border-emerald-700/50 text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    Connected
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Verified display name</span>
                    <strong className="text-foreground">{config.verified_name || 'WhatsApp Account'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Display Phone Number</span>
                    <strong className="text-foreground">{config.display_phone_number || 'Unknown'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Phone Number ID</span>
                    <code className="text-foreground font-mono select-all text-xs">{config.phone_number_id}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">WhatsApp Business Account ID</span>
                    <code className="text-foreground font-mono select-all text-xs">{config.waba_id || 'Not Provided'}</code>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Connection Method</span>
                    <span className="capitalize text-foreground font-medium">{config.connection_method || 'manual'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Phone number status / Quality</span>
                    <span className="capitalize text-foreground font-medium">
                      {config.phone_number_status || 'Active'} / {config.quality_rating || 'Green'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Last Verified</span>
                    <span className="text-foreground text-xs">
                      {config.last_verification_at ? new Date(config.last_verification_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Webhook subscription</span>
                    <span className="text-foreground font-medium">{config.webhook_subscription_status || 'subscribed'}</span>
                  </div>
                </div>

                {config.last_meta_api_error && (
                  <Alert className="bg-red-950/30 border-red-700/50 mt-4">
                    <AlertTriangle className="size-4 text-red-400" />
                    <AlertTitle className="text-red-200">Last Meta API Error</AlertTitle>
                    <AlertDescription className="text-red-300/80 text-xs">
                      {config.last_meta_api_error}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Registration Status Banner */}
            <Alert className={isRegistered ? 'bg-emerald-950/30 border-emerald-700/50' : 'bg-amber-950/30 border-amber-700/50'}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {isRegistered ? (
                    <CheckCircle2 className="size-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-400" />
                  )}
                  <AlertTitle className={'mb-0 ' + (isRegistered ? 'text-emerald-200' : 'text-amber-200')}>
                    {isRegistered ? 'Registered — Meta will deliver events to KK WABA' : 'Not registered — Meta will not deliver events'}
                  </AlertTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyRegistration}
                  disabled={verifyingRegistration}
                  className="border-border bg-transparent text-foreground hover:bg-muted h-7"
                >
                  {verifyingRegistration ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                  Verify with Meta
                </Button>
              </div>
              <AlertDescription className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {isRegistered ? (
                  <>Subscribed since {new Date(config.registered_at).toLocaleString()}. Click Verify with Meta if events stop arriving.</>
                ) : lastRegistrationError ? (
                  <>Last attempt failed: <span className="text-red-300">&quot;{lastRegistrationError}&quot;</span>. Re-save with 2-step PIN to retry.</>
                ) : (
                  <>This configuration requires a 2-step verification PIN to register. Enter the PIN in manual configuration below.</>
                )}
              </AlertDescription>
            </Alert>

            {/* Webhook Configuration URL */}
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Webhook Callback</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Use this webhook URL in the Meta developer panel under WhatsApp product settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="bg-muted border-border text-muted-foreground font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleRefreshDetails}
                disabled={testing}
                variant="outline"
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Refresh Account Details
              </Button>
              {config.connection_method === 'embedded' && (
                <Button
                  onClick={handleFbConnect}
                  disabled={sdkLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {sdkLoading ? <Loader2 className="size-4 animate-spin" /> : <Facebook className="size-4" />}
                  Reconnect with Facebook
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleOpenLogs}
                className="border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ListTodo className="size-4" />
                View Setup Logs
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={resetting}
                className="border-red-900 text-red-400 hover:text-red-300 hover:bg-red-950/40"
              >
                {resetting ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
                Disconnect WhatsApp
              </Button>
            </div>
          </div>

          {/* Setup Instructions Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground text-base">Setup Instructions</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Quick links to configure webhooks on Meta Developers site.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion>
                  <AccordionItem value="item-1" className="border-border">
                    <AccordionTrigger className="text-muted-foreground hover:text-foreground hover:no-underline">
                      Webhook Subscription
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm space-y-1">
                      <p>1. Go to WhatsApp &gt; Configuration in Meta dashboard.</p>
                      <p>2. Paste Callback URL and Verify Token.</p>
                      <p>3. Subscribe to <strong>messages</strong>.</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Setup Logs Modal */}
        {showLogs && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full max-h-[80vh] flex flex-col">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-foreground flex items-center justify-between">
                  <span>WhatsApp Setup Logs</span>
                  <button onClick={() => setShowLogs(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  History of WhatsApp connection attempts and failures for this account.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-y-auto p-4 flex-1 space-y-3">
                {loadingLogs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No setup logs found.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                        <span className="font-semibold text-foreground capitalize">
                          {log.stage.replace(/_/g, ' ')}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${log.status === 'success' ? 'bg-emerald-950 border border-emerald-700/50 text-emerald-400' : 'bg-red-950 border border-red-700/50 text-red-400'}`}>
                          {log.status}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-xs text-red-300/90">{log.error_message}</p>
                      )}
                      <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                        <span>WABA ID: {log.waba_id || 'N/A'} | Phone ID: {log.phone_number_id || 'N/A'}</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    );
  }

  // Render Setup Options Selection Screen
  return (
    <section className="animate-in fade-in-50 duration-200 space-y-6">
      <SettingsPanelHead
        title="WhatsApp connection"
        description="Connect your Meta WhatsApp Business API. Select a setup method below."
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Method 1: Connect with Facebook */}
        <Card className={`border-2 ${activeTab === 'facebook' ? 'border-primary' : 'border-border'} hover:border-primary/50 transition-colors cursor-pointer`} onClick={() => setActiveTab('facebook')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <Facebook className="size-5 text-blue-500" />
                Connect with Facebook
              </CardTitle>
              <span className="text-[10px] font-semibold text-primary bg-primary-soft px-2 py-0.5 rounded-full uppercase">
                Recommended
              </span>
            </div>
            <CardDescription className="text-muted-foreground mt-2">
              Log in to Meta directly, authorize KK WABA CRM, and automatically connect your number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              No need to copy ID tokens or setup complex system users. Connect in seconds using our integrated Facebook login flow.
            </p>

            {isConfigMissing && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="size-4" />
                <AlertTitle>Configuration missing</AlertTitle>
                <AlertDescription className="text-xs">
                  Meta App ID or Embedded Signup Configuration ID is not configured in the server environment. Please contact the administrator.
                </AlertDescription>
              </Alert>
            )}

            {isHttp && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="size-4" />
                <AlertTitle>HTTPS connection required</AlertTitle>
                <AlertDescription className="text-xs">
                  Facebook Login can only be used on HTTPS pages. Please access this application via your HTTPS URL (e.g. your ngrok HTTPS link).
                </AlertDescription>
              </Alert>
            )}

            {sdkState === 'error' && !isConfigMissing && (
              <div className="space-y-2 mt-2">
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Facebook SDK Error</AlertTitle>
                  <AlertDescription className="text-xs">
                    {sdkErrorMsg || 'Facebook JavaScript SDK could not be loaded.'}
                  </AlertDescription>
                </Alert>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetryLoadSdk();
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Retry Loading SDK
                </Button>
              </div>
            )}

            {activeTab === 'facebook' && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFbConnect();
                }}
                disabled={sdkLoading || sdkState !== 'ready' || isConfigMissing || isHttp}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 mt-4"
              >
                {sdkLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Connecting...
                  </>
                ) : sdkState === 'loading' ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading Facebook...
                  </>
                ) : (
                  <>
                    <Facebook className="size-4" />
                    Connect WhatsApp with Facebook
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Method 2: Manual Setup */}
        <Card className={`border-2 ${activeTab === 'manual' ? 'border-primary' : 'border-border'} hover:border-primary/50 transition-colors cursor-pointer`} onClick={() => setActiveTab('manual')}>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Settings2 className="size-5 text-muted-foreground" />
              Manual API Configuration
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Manually copy and enter your Phone Number ID, WABA ID, and permanent access token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Recommended for advanced developers or when using custom solution provider logins.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Input Fields when Manual is selected */}
      {activeTab === 'manual' && (
        <Card className="animate-in fade-in-50 duration-200">
          <CardHeader>
            <CardTitle className="text-foreground">Manual Credentials Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Phone Number ID</Label>
              <Input
                placeholder="e.g. 100234567890123"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">WhatsApp Business Account ID</Label>
              <Input
                placeholder="e.g. 100234567890456"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Permanent Access Token</Label>
              <div className="relative">
                <Input
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your access token"
                  value={accessToken}
                  onChange={(e) => {
                    setAccessToken(e.target.value);
                    setTokenEdited(true);
                  }}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Webhook Verify Token</Label>
              <Input
                placeholder="Create a custom verify token"
                value={verifyToken}
                onChange={(e) => setVerifyToken(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">
                Two-step verification PIN <span className="ml-1 text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground tracking-widest"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : 'Save Configuration'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook Configuration for copy-paste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm">Webhook details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="bg-muted border-border text-muted-foreground font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyWebhookUrl}
              className="shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
