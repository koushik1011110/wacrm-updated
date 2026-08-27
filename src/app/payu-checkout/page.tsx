'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2, CreditCard, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

function PayUCheckoutInner() {
  const searchParams = useSearchParams();
  const txnid = searchParams.get('txnid') || '';
  const amount = searchParams.get('amount') || '1.00';
  const firstname = searchParams.get('firstname') || 'Customer';
  const productinfo = searchParams.get('productinfo') || 'Advance Booking Fee';

  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payuData, setPayuData] = useState<any>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!txnid) {
      setError('Transaction Reference ID is missing.');
      return;
    }

    // Fetch PayU signed form data from API
    const fetchPayUData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/payments/payu/hash?txnid=${encodeURIComponent(txnid)}&amount=${encodeURIComponent(amount)}&firstname=${encodeURIComponent(firstname)}&productinfo=${encodeURIComponent(productinfo)}`);
        if (res.ok) {
          const json = await res.json();
          setPayuData(json.formData);
        } else {
          setError('Failed to initialize PayU Checkout session.');
        }
      } catch (err: any) {
        console.error('PayU hash fetch error:', err);
        setError('Error connecting to PayU gateway.');
      } finally {
        setLoading(false);
      }
    };

    fetchPayUData();
  }, [txnid, amount, firstname, productinfo]);

  const handlePayUGatewaySubmit = () => {
    if (formRef.current) {
      formRef.current.submit();
    }
  };

  const simulateSuccessPayment = async () => {
    if (!txnid) return;
    setSimulating(true);
    try {
      const res = await fetch('/api/payments/payu/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          status: 'success',
          txnid: txnid,
          amount: amount,
          productinfo: productinfo,
          firstname: firstname,
          email: 'customer@gmail.com',
          mihpayid: `PAYU_SIM_${Date.now()}`,
        }).toString(),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        setError('Payment simulation failed.');
      }
    } catch {
      setError('Network error during simulation.');
    } finally {
      setSimulating(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="w-full max-w-md rounded-xl border border-emerald-500/30 bg-card p-8 shadow-2xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Payment Successful!
          </h2>
          <p className="text-sm text-muted-foreground">
            Your ₹{amount} advance booking payment has been verified via PayU. A WhatsApp booking confirmation message has been sent to your phone! 🎉
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono text-muted-foreground">
            PayU Txn ID: {txnid}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CreditCard className="h-8 w-8 text-primary" />
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            PayU Advance Booking Payment
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete your ₹{amount} advance payment to confirm your booking slot.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booking Ref:</span>
            <span className="font-mono font-semibold text-foreground">{txnid}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer Name:</span>
            <span className="font-semibold text-foreground">{firstname}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Gateway:</span>
            <span className="font-semibold text-foreground">PayU Money / Payments</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
            <span>Advance Amount:</span>
            <span className="text-emerald-500 font-mono">₹{amount}</span>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {/* Hidden HTML form for PayU Gateway POST submission */}
        {payuData && (
          <form ref={formRef} action={payuData.action} method="POST" className="hidden">
            <input type="hidden" name="key" value={payuData.key} />
            <input type="hidden" name="txnid" value={payuData.txnid} />
            <input type="hidden" name="amount" value={payuData.amount} />
            <input type="hidden" name="productinfo" value={payuData.productinfo} />
            <input type="hidden" name="firstname" value={payuData.firstname} />
            <input type="hidden" name="email" value={payuData.email} />
            <input type="hidden" name="phone" value={payuData.phone} />
            <input type="hidden" name="surl" value={payuData.surl} />
            <input type="hidden" name="furl" value={payuData.furl} />
            <input type="hidden" name="hash" value={payuData.hash} />
          </form>
        )}

        <div className="space-y-3">
          <Button
            onClick={handlePayUGatewaySubmit}
            disabled={loading || !payuData}
            className="w-full h-11 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-4 w-4" /> Pay via PayU Gateway <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <Button
            onClick={simulateSuccessPayment}
            disabled={simulating}
            variant="outline"
            className="w-full h-11 text-sm font-semibold border-primary/40 text-primary hover:bg-primary/10 gap-2"
          >
            {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Simulate Instant Test Payment (Success)
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] font-medium text-emerald-500 border-t border-border">
          <ShieldCheck className="h-4 w-4" /> 256-bit Encrypted PayU Security
        </div>
      </div>
    </div>
  );
}

export default function PayUCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <PayUCheckoutInner />
    </Suspense>
  );
}
