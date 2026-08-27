"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShieldCheck, Loader2, CreditCard, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

function PayCheckoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const mode = searchParams.get("mode") || "sandbox";

  const [simulating, setSimulating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cashfreeRef = useRef<any>(null);

  const isSandbox = mode === "sandbox" || mode === "TEST";
  const directFallbackUrl = `https://payments${isSandbox ? "-test" : ""}.cashfree.com/order/#${sessionId}`;

  const launchCashfreeModal = () => {
    if (!sessionId) return;
    try {
      if (cashfreeRef.current) {
        cashfreeRef.current.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_modal",
        });
      } else if ((window as any).Cashfree) {
        const cashfree = (window as any).Cashfree({
          mode: isSandbox ? "sandbox" : "production",
        });
        cashfreeRef.current = cashfree;
        cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: "_modal",
        });
      } else {
        window.location.href = directFallbackUrl;
      }
    } catch (err: any) {
      console.error("Cashfree checkout error:", err);
      window.location.href = directFallbackUrl;
    }
  };

  const simulateSuccessPayment = async () => {
    if (!orderId) {
      setError("Order ID missing");
      return;
    }
    setSimulating(true);
    try {
      const res = await fetch("/api/payments/cashfree/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            order: { order_id: orderId },
            payment: { payment_status: "SUCCESS", cf_payment_id: `SIM_${Date.now()}` },
          },
        }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        setError("Payment simulation failed");
      }
    } catch {
      setError("Network error simulating payment");
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (!sessionId && !orderId) {
      setError("Payment details missing.");
      return;
    }

    let isCancelled = false;

    const loadCashfreeSdk = async () => {
      try {
        if (!(window as any).Cashfree) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
            script.onload = () => resolve();
            script.onerror = () => resolve(); // don't block UI if script fails
            document.body.appendChild(script);
          });
        }

        if (isCancelled) return;

        if ((window as any).Cashfree) {
          const cashfree = (window as any).Cashfree({
            mode: isSandbox ? "sandbox" : "production",
          });
          cashfreeRef.current = cashfree;
        }
      } catch (err) {
        console.warn("Cashfree SDK script failed to load:", err);
      }
    };

    loadCashfreeSdk();

    return () => {
      isCancelled = true;
    };
  }, [sessionId, mode, isSandbox, orderId]);

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
            Your ₹500 advance payment has been confirmed. A WhatsApp booking confirmation message has been sent to your phone! 🎉
          </p>
          {orderId && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono text-muted-foreground">
              Booking Ref: {orderId}
            </div>
          )}
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
            Advance Booking Payment
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete your ₹500 advance payment to finalize your booking slot.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-left text-xs space-y-2">
          {orderId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booking Ref:</span>
              <span className="font-mono font-semibold text-foreground">{orderId}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Gateway:</span>
            <span className="font-semibold text-foreground">Cashfree Payments ({isSandbox ? 'Sandbox' : 'Live'})</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
            <span>Advance Amount:</span>
            <span className="text-emerald-500 font-mono">₹500.00</span>
          </div>
        </div>

        {/* Dashboard setup warning helper */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left text-[11px] text-amber-600 dark:text-amber-400 space-y-1">
          <div className="font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> If Cashfree Checkout appears blank:
          </div>
          <div>
            Enable <b>UPI & Cards</b> in your Cashfree Sandbox Dashboard (Developers → Payment Methods).
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={launchCashfreeModal} className="w-full h-11 text-sm font-semibold bg-primary text-primary-foreground gap-2">
            <CreditCard className="h-4 w-4" /> Open Cashfree Payment Modal
          </Button>

          <Button
            onClick={simulateSuccessPayment}
            disabled={simulating}
            variant="outline"
            className="w-full h-11 text-sm font-semibold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 gap-2"
          >
            {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Simulate Instant Test Payment (Success)
          </Button>

          {sessionId && (
            <a
              href={directFallbackUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-muted-foreground hover:text-foreground underline pt-1"
            >
              Click here to open direct Cashfree Payment Portal link
            </a>
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] font-medium text-emerald-500 border-t border-border">
          <ShieldCheck className="h-4 w-4" /> 256-bit Encrypted SSL Payment
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <PayCheckoutInner />
    </Suspense>
  );
}
