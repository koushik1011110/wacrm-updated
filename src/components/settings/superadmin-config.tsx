'use client';

import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, AlertCircle, HelpCircle, Loader2, Play, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SettingsPanelHead } from './settings-panel-head';
import { loadFacebookSDK } from '@/lib/whatsapp/facebook-sdk';

interface SuperadminConfigData {
  META_APP_ID: string;
  META_APP_SECRET_SET: boolean;
  META_EMBEDDED_SIGNUP_CONFIG_ID: string;
  META_GRAPH_API_VERSION: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
  META_OAUTH_REDIRECT_URL: string;
  META_WEBHOOK_CALLBACK_URL: string;
  META_ALLOWED_DOMAIN: string;
  META_BUSINESS_PORTFOLIO_ID?: string;
  META_SOLUTION_ID?: string;
}

export function SuperadminConfig() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SuperadminConfigData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Diagnostics state
  const [testingSdk, setTestingSdk] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details: {
      scriptLoaded: boolean;
      sdkInitialized: boolean;
      appIdOk: boolean;
      configIdOk: boolean;
      versionOk: boolean;
      domainOk: boolean;
      cspBlocked: boolean;
      ready: boolean;
    };
  } | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch('/api/superadmin/config');
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json();
        setConfig(data);
      } catch (err: any) {
        console.error('Failed to fetch superadmin config:', err);
        setError(err.message || 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const handleTestSdk = async () => {
    if (!config?.META_APP_ID) {
      setTestResult({
        success: false,
        message: 'Cannot test SDK: Meta App ID is not configured.',
        details: {
          scriptLoaded: false,
          sdkInitialized: false,
          appIdOk: false,
          configIdOk: !!config?.META_EMBEDDED_SIGNUP_CONFIG_ID,
          versionOk: !!config?.META_GRAPH_API_VERSION,
          domainOk: false,
          cspBlocked: false,
          ready: false,
        }
      });
      return;
    }

    setTestingSdk(true);
    setTestResult(null);

    const appIdOk = !!config.META_APP_ID;
    const configIdOk = !!config.META_EMBEDDED_SIGNUP_CONFIG_ID;
    const versionOk = !!config.META_GRAPH_API_VERSION;

    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const domainOk =
      !config.META_ALLOWED_DOMAIN ||
      currentOrigin.includes(config.META_ALLOWED_DOMAIN) ||
      (typeof window !== 'undefined' && config.META_ALLOWED_DOMAIN.includes(window.location.hostname));

    try {
      await loadFacebookSDK(config.META_APP_ID, config.META_GRAPH_API_VERSION || 'v21.0');

      const isInit = !!(window as any).FB;
      const hasScript = !!document.getElementById('facebook-jssdk');
      const ready = isInit && appIdOk && configIdOk && versionOk && domainOk;

      setTestResult({
        success: isInit,
        message: isInit
          ? 'Facebook JS SDK loaded and initialized successfully!'
          : 'Facebook SDK script injected but window.FB initialization did not complete.',
        details: {
          scriptLoaded: hasScript,
          sdkInitialized: isInit,
          appIdOk,
          configIdOk,
          versionOk,
          domainOk,
          cspBlocked: false,
          ready,
        }
      });
    } catch (err: any) {
      const isCspBlocked =
        err.message?.includes('ad blocker') ||
        err.message?.includes('could not be loaded') ||
        err.message?.includes('Content Security Policy') ||
        false;

      setTestResult({
        success: false,
        message: err.message || 'Facebook SDK failed to load.',
        details: {
          scriptLoaded: !!document.getElementById('facebook-jssdk'),
          sdkInitialized: false,
          appIdOk,
          configIdOk,
          versionOk,
          domainOk,
          cspBlocked: isCspBlocked,
          ready: false,
        }
      });
    } finally {
      setTestingSdk(false);
    }
  };

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Superadmin Meta Configuration"
          description="View and verify CRM-wide Meta App and WhatsApp configuration variables."
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        <SettingsPanelHead
          title="Superadmin Meta Configuration"
          description="View and verify CRM-wide Meta App and WhatsApp configuration variables."
        />
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Error loading configuration</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </section>
    );
  }

  const items = [
    { key: 'META_APP_ID', label: 'Meta App ID', value: config?.META_APP_ID, type: 'public' },
    { key: 'META_APP_SECRET', label: 'Meta App Secret', value: config?.META_APP_SECRET_SET ? '••••••••••••••••' : null, type: 'secret' },
    { key: 'META_EMBEDDED_SIGNUP_CONFIG_ID', label: 'Embedded Signup Configuration ID', value: config?.META_EMBEDDED_SIGNUP_CONFIG_ID, type: 'public' },
    { key: 'META_GRAPH_API_VERSION', label: 'Meta Graph API Version', value: config?.META_GRAPH_API_VERSION, type: 'public' },
    { key: 'META_WEBHOOK_VERIFY_TOKEN', label: 'Webhook Verify Token', value: config?.META_WEBHOOK_VERIFY_TOKEN, type: 'public' },
    { key: 'META_OAUTH_REDIRECT_URL', label: 'OAuth Redirect URL', value: config?.META_OAUTH_REDIRECT_URL, type: 'public' },
    { key: 'META_WEBHOOK_CALLBACK_URL', label: 'Webhook Callback URL', value: config?.META_WEBHOOK_CALLBACK_URL, type: 'public' },
    { key: 'META_ALLOWED_DOMAIN', label: 'Allowed Frontend Domain', value: config?.META_ALLOWED_DOMAIN, type: 'public' },
    { key: 'META_BUSINESS_PORTFOLIO_ID', label: 'Meta Business Portfolio ID (Optional)', value: config?.META_BUSINESS_PORTFOLIO_ID, type: 'optional' },
    { key: 'META_SOLUTION_ID', label: 'Solution ID (Optional)', value: config?.META_SOLUTION_ID, type: 'optional' },
  ];

  return (
    <section className="animate-in fade-in-50 duration-200 space-y-6">
      <SettingsPanelHead
        title="Superadmin Meta Configuration"
        description="View and verify CRM-wide Meta App and WhatsApp configuration variables."
      />

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        {/* Environment status details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Shield className="size-5 text-primary" />
                Environment variables status
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                These variables are loaded from the server's `.env` configuration. Access tokens are kept secure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {items.map((item) => (
                  <div key={item.key} className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground block">{item.label}</span>
                      <code className="text-sm text-foreground break-all select-all font-mono mt-1 block">
                        {item.value || 'Not Configured'}
                      </code>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      {item.value ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          Loaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
                          <AlertCircle className="size-3" />
                          {item.type === 'optional' ? 'Optional' : 'Missing'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Diagnostics & SDK Tester side-panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Activity className="size-5 text-primary" />
                Facebook SDK diagnostics
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Verify CSP headers, network loading, and client initialization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                onClick={handleTestSdk}
                disabled={testingSdk}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground flex items-center justify-center gap-2"
              >
                {testingSdk ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Testing SDK...
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Test Facebook SDK
                  </>
                )}
              </Button>

              {testResult && (
                <div className="space-y-3 mt-4 text-xs">
                  <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'bg-emerald-950/30 border-emerald-700/50 text-emerald-300' : ''}>
                    <AlertTitle>{testResult.success ? 'Diagnostics Passed' : 'Diagnostics Failed'}</AlertTitle>
                    <AlertDescription className="text-xs">{testResult.message}</AlertDescription>
                  </Alert>

                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20 font-mono">
                    <div className="flex items-center justify-between">
                      <span>App ID Status</span>
                      <span className={testResult.details.appIdOk ? 'text-emerald-400' : 'text-amber-500'}>
                        {testResult.details.appIdOk ? 'Configured' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Config ID Status</span>
                      <span className={testResult.details.configIdOk ? 'text-emerald-400' : 'text-amber-500'}>
                        {testResult.details.configIdOk ? 'Configured' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Graph Version Status</span>
                      <span className={testResult.details.versionOk ? 'text-emerald-400' : 'text-amber-500'}>
                        {testResult.details.versionOk ? 'Configured' : 'Missing'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Domain Allowed</span>
                      <span className={testResult.details.domainOk ? 'text-emerald-400' : 'text-amber-500'}>
                        {testResult.details.domainOk ? 'Yes' : 'Unconfirmed'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Script Tag Injected</span>
                      <span className={testResult.details.scriptLoaded ? 'text-emerald-400' : 'text-red-400'}>
                        {testResult.details.scriptLoaded ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>SDK Initialized</span>
                      <span className={testResult.details.sdkInitialized ? 'text-emerald-400' : 'text-red-400'}>
                        {testResult.details.sdkInitialized ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>CSP / Adblock Blocked</span>
                      <span className={testResult.details.cspBlocked ? 'text-red-400 font-bold animate-pulse' : 'text-emerald-400'}>
                        {testResult.details.cspBlocked ? 'Blocked' : 'No'}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex items-center justify-between font-bold text-foreground">
                      <span>Embedded Signup Ready</span>
                      <span className={testResult.details.ready ? 'text-emerald-400' : 'text-red-400'}>
                        {testResult.details.ready ? 'Ready' : 'Not Ready'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            Meta WhatsApp Embedded Signup Setup
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Complete, step-by-step setup documentation to configure your Meta Developer app.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none text-muted-foreground space-y-6">
          <div className="space-y-4">
            <h3 className="text-foreground font-semibold text-lg">1. Meta Developer App Creation</h3>
            <p className="text-sm leading-relaxed">
              Go to <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta for Developers</a>, log in with your Facebook account, click <strong>My Apps</strong>, then <strong>Create App</strong>. Select <strong>Business</strong> or <strong>Other (with Business Portfolio type)</strong>, fill in the details, and link it to your Meta Business Portfolio.
            </p>

            <h3 className="text-foreground font-semibold text-lg font-bold">2. Allowed Domains & HTTPS Verification</h3>
            <p className="text-sm leading-relaxed text-amber-200">
              Ensure that your CRM production domain uses <strong className="text-foreground">HTTPS</strong>. Add your domain name (e.g., <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">your-crm-domain.com</code>) to the <strong>App Domains</strong> section in basic settings. Add it to the <strong>Allowed Domains for the JavaScript SDK</strong> list under Facebook Login for Business settings.
            </p>

            <h3 className="text-foreground font-semibold text-lg">3. Add WhatsApp Product</h3>
            <p className="text-sm leading-relaxed">
              Inside your Meta App Dashboard, scroll to <strong>Add products to your app</strong>, find <strong>WhatsApp</strong>, and click <strong>Set Up</strong>. Follow the instructions to link the app to your Meta Business Account.
            </p>

            <h3 className="text-foreground font-semibold text-lg">4. Configure Facebook Login for Business</h3>
            <p className="text-sm leading-relaxed">
              Add the <strong>Facebook Login for Business</strong> product to your app. Go to its configuration page. Enable <strong>Login with Facebook JavaScript SDK</strong>. Set the <strong>Allowed Domains</strong> and <strong>Valid OAuth Redirect URLs</strong> (must match the CRM domain or localhost redirect URL).
            </p>

            <h3 className="text-foreground font-semibold text-lg">5. Create WhatsApp Embedded Signup Configuration</h3>
            <p className="text-sm leading-relaxed">
              Go to your Meta Business Manager, locate <strong>WhatsApp Manager</strong>, select your business, go to <strong>Embedded Signup</strong>, and create a configuration setup. Get the configuration ID.
            </p>

            <h3 className="text-foreground font-semibold text-lg">6. Find the Meta Credentials</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><strong>Meta App ID:</strong> Found at the top of your Meta App Dashboard.</li>
              <li><strong>Meta App Secret:</strong> Found in App Settings &gt; Basic.</li>
              <li><strong>Embedded Signup Configuration ID:</strong> Found in WhatsApp Manager &gt; Embedded Signup.</li>
            </ul>

            <h3 className="text-foreground font-semibold text-lg">7. Required Permissions</h3>
            <p className="text-sm leading-relaxed">
              Under App Review &gt; Permissions and Features, ensure your login config asks for:
              <br />
              <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">whatsapp_business_management</code>
              <br />
              <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">whatsapp_business_messaging</code>
            </p>

            <h3 className="text-foreground font-semibold text-lg">8. Valid OAuth Redirect URLs & Allowed Domains</h3>
            <p className="text-sm leading-relaxed">
              Set the callback domain under Facebook Login for Business settings. For instance, add your CRM's public URL:
              <br />
              <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">
                {config?.META_OAUTH_REDIRECT_URL || 'https://your-crm-domain.com'}
              </code>
            </p>

            <h3 className="text-foreground font-semibold text-lg">9. Webhook Setup</h3>
            <p className="text-sm leading-relaxed">
              In your Meta App Dashboard under WhatsApp &gt; Configuration:
              <br />
              - Set the <strong>Callback URL</strong> to: <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">{config?.META_WEBHOOK_CALLBACK_URL || 'https://your-crm-domain.com/api/whatsapp/webhook'}</code>
              <br />
              - Set the <strong>Verify Token</strong> to match <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">{config?.META_WEBHOOK_VERIFY_TOKEN || 'your_custom_token'}</code>.
              <br />
              - Click <strong>Verify and Save</strong>. Under Webhook Fields, subscribe to <strong className="text-foreground">messages</strong>.
            </p>

            <h3 className="text-foreground font-semibold text-lg">10. Legal URLs</h3>
            <p className="text-sm leading-relaxed">
              Provide the following links in the basic app settings:
              <br />
              - <strong>Privacy Policy URL:</strong> <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">https://[your-domain]/privacy-policy</code>
              <br />
              - <strong>Terms of Service URL:</strong> <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">https://[your-domain]/terms-of-service</code>
              <br />
              - <strong>Data Deletion Instructions URL:</strong> <code className="text-xs text-foreground font-mono bg-muted px-1 py-0.5 rounded">https://[your-domain]/data-deletion</code>
            </p>

            <h3 className="text-foreground font-semibold text-lg">11. Go Live & Testing</h3>
            <p className="text-sm leading-relaxed">
              Once testing is successful in Development mode, switch the Meta app toggle at the top from <strong>Development</strong> to <strong>Live</strong>. Execute App Review to get advanced access permissions for production.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
