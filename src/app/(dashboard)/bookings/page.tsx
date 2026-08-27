'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  MessageSquare,
  ExternalLink,
  Loader2,
  Calendar,
  Phone,
  User,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Booking {
  id: string;
  account_id: string;
  contact_id?: string;
  conversation_id?: string;
  customer_name?: string;
  customer_phone?: string;
  booking_date?: string;
  booking_time?: string;
  advance_amount: number;
  status: 'pending_details' | 'pending_payment' | 'confirmed' | 'cancelled';
  cashfree_order_id?: string;
  cashfree_payment_id?: string;
  payment_status: string;
  payment_link?: string;
  created_at: string;
}

interface Stats {
  total: number;
  confirmed: number;
  pending_payment: number;
  total_advance: number;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    confirmed: 0,
    pending_payment: 0,
    total_advance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const json = await res.json();
        setBookings(json.bookings || []);
        setStats(
          json.stats || {
            total: 0,
            confirmed: 0,
            pending_payment: 0,
            total_advance: 0,
          }
        );
      } else {
        toast.error('Failed to load bookings');
      }
    } catch {
      toast.error('Network error loading bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    setUpdatingId(bookingId);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookingId, status: newStatus }),
      });
      if (res.ok) {
        toast.success(`Booking status updated to ${newStatus}`);
        void fetchBookings();
      } else {
        toast.error('Failed to update booking status');
      }
    } catch {
      toast.error('Error updating status');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter bookings by search query and status tab
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      (b.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.customer_phone || '').includes(searchQuery) ||
      (b.cashfree_order_id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true : b.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Customer Bookings</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage WhatsApp AI appointment reservations, advance payments, and slot schedules.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={fetchBookings} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Bookings
        </Button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Bookings</CardTitle>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground mt-1">All booking requests</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Confirmed Slots</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.confirmed}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Advance paid & confirmed</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending Payment</CardTitle>
            <Clock className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{stats.pending_payment}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Payment link sent to customer</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Advance Collected</CardTitle>
            <IndianRupee className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₹{stats.total_advance.toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Total revenue collected</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, phone, or Ref ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 border-border bg-muted text-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {['all', 'confirmed', 'pending_payment', 'pending_details', 'cancelled'].map((tab) => (
            <Button
              key={tab}
              variant={statusFilter === tab ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(tab)}
              className="text-xs capitalize h-8"
            >
              {tab.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <CalendarCheck className="h-4 w-4 text-primary" /> Booking Records ({filteredBookings.length})
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            List of all WhatsApp AI bookings, customer details, and payment statuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredBookings.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-3">Reference / Order ID</th>
                    <th className="p-3">Customer Details</th>
                    <th className="p-3">Date & Slot</th>
                    <th className="p-3">Advance Fee</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBookings.map((b) => {
                    const isConfirmed = b.status === 'confirmed' || b.payment_status === 'SUCCESS';
                    const isPendingPay = b.status === 'pending_payment';
                    const isCancelled = b.status === 'cancelled';

                    return (
                      <tr key={b.id} className="hover:bg-muted/20">
                        <td className="p-3 font-mono text-xs font-semibold text-foreground">
                          {b.cashfree_order_id || b.id.slice(0, 8)}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {b.customer_name || 'Customer'}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
                            <Phone className="h-3 w-3" />
                            {b.customer_phone || 'N/A'}
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            {b.booking_date || b.booking_time || 'Not selected'}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          ₹{Number(b.advance_amount || 500).toFixed(2)}
                        </td>
                        <td className="p-3">
                          {isConfirmed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Confirmed
                            </span>
                          ) : isPendingPay ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
                              <Clock className="h-3 w-3" /> Pending Payment
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/30 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                              <XCircle className="h-3 w-3" /> Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                              Pending Details
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(b.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {b.conversation_id && (
                              <Button variant="ghost" size="sm" asChild className="h-8 gap-1 text-xs">
                                <Link href={`/inbox?conversation=${b.conversation_id}`}>
                                  <MessageSquare className="h-3.5 w-3.5 text-primary" /> Chat
                                </Link>
                              </Button>
                            )}

                            {!isConfirmed && !isCancelled && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                disabled={updatingId === b.id}
                                onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                              >
                                {updatingId === b.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Confirm
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <CalendarCheck className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p>No bookings found matching your search criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
