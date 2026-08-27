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
  Loader2,
  Calendar as CalendarIcon,
  Phone,
  User,
  Filter,
  Save,
  Settings2,
  Plus,
  Trash2,
  Clock3,
  Sliders,
  LayoutList,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PayUConfig } from '@/components/settings/payu-config';
import { BookingCalendar } from '@/components/bookings/booking-calendar';
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
  const [activeTab, setActiveTab] = useState<'monitor' | 'settings'>('monitor');
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
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

  // Default Advance Fee State
  const [defaultAdvanceFee, setDefaultAdvanceFee] = useState<string>('500');
  const [savingAdvance, setSavingAdvance] = useState(false);

  // Custom Booking Time Slots State
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState('');
  const [savingSlots, setSavingSlots] = useState(false);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const json = await res.json();
        setBookings(json.bookings || []);
        if (json.default_advance_amount !== undefined) {
          setDefaultAdvanceFee(String(json.default_advance_amount));
        }
        if (Array.isArray(json.time_slots)) {
          setTimeSlots(json.time_slots);
        }
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

  const handleSaveDefaultAdvance = async () => {
    const numAmount = parseFloat(defaultAdvanceFee);
    if (isNaN(numAmount) || numAmount < 0) {
      toast.error('Please enter a valid advance payment amount');
      return;
    }

    setSavingAdvance(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_default_advance',
          amount: numAmount,
        }),
      });

      if (res.ok) {
        toast.success(`Default advance fee updated to ₹${numAmount.toFixed(2)}`);
      } else {
        toast.error('Failed to save default advance fee');
      }
    } catch {
      toast.error('Error saving advance fee setting');
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleAddSlot = () => {
    if (!newSlotInput.trim()) return;
    if (timeSlots.length >= 10) {
      toast.error('Maximum 10 time slots allowed per WhatsApp list');
      return;
    }
    const cleanSlot = newSlotInput.trim().slice(0, 24);
    if (timeSlots.includes(cleanSlot)) {
      toast.error('This slot already exists');
      return;
    }
    setTimeSlots([...timeSlots, cleanSlot]);
    setNewSlotInput('');
  };

  const handleRemoveSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const handleSaveTimeSlots = async () => {
    setSavingSlots(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_time_slots',
          slots: timeSlots,
        }),
      });

      if (res.ok) {
        toast.success('Custom booking time slots saved successfully!');
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error || 'Failed to save time slots');
      }
    } catch {
      toast.error('Error saving time slots');
    } finally {
      setSavingSlots(false);
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Booking Hub & Management</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor WhatsApp AI customer appointments, advance payments, and gateway settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBookings} disabled={loading} className="h-9 gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="monitor" value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted p-1 border border-border rounded-lg">
          <TabsTrigger value="monitor" className="flex items-center gap-2 text-xs font-semibold">
            <CalendarCheck className="h-4 w-4" /> Bookings & Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2 text-xs font-semibold">
            <Sliders className="h-4 w-4" /> Booking & Gateway Settings
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BOOKINGS MONITORING & ANALYTICS */}
        <TabsContent value="monitor" className="space-y-6 m-0">
          {/* Summary Stat Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Bookings</CardTitle>
                <CalendarCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                <p className="text-[11px] text-muted-foreground mt-1">All customer requests</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Confirmed Slots</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">{stats.confirmed}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Advance paid & confirmed</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Pending Payment</CardTitle>
                <Clock className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">{stats.pending_payment}</div>
                <p className="text-[11px] text-muted-foreground mt-1">Payment link sent to customer</p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Advance Revenue</CardTitle>
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

          {/* View Mode Switcher (Calendar vs Table) */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">View Mode:</span>
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md border border-border">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="h-7 text-xs gap-1.5 px-3"
                >
                  <CalendarIcon className="h-3.5 w-3.5" /> Calendar Schedule
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-7 text-xs gap-1.5 px-3"
                >
                  <LayoutList className="h-3.5 w-3.5" /> Table List
                </Button>
              </div>
            </div>

            {viewMode === 'table' && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                {['all', 'confirmed', 'pending_payment', 'pending_details', 'cancelled'].map((tab) => (
                  <Button
                    key={tab}
                    variant={statusFilter === tab ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(tab)}
                    className="text-xs capitalize h-7 px-2.5"
                  >
                    {tab.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* VIEW MODE 1: CALENDAR VIEW */}
          {viewMode === 'calendar' ? (
            <BookingCalendar bookings={bookings} />
          ) : (
            /* VIEW MODE 2: TABLE DATA VIEW */
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name, phone, or Ref ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 border-border bg-muted text-foreground"
                />
              </div>

              <Card className="border-border bg-card shadow-sm">
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
                                    <CalendarIcon className="h-3.5 w-3.5 text-primary" />
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
          )}
        </TabsContent>

        {/* TAB 2: BOOKING & GATEWAY SETTINGS */}
        <TabsContent value="settings" className="space-y-6 m-0">
          {/* Card 1: Default Advance Payment Amount */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-base text-foreground">Default Booking Advance Fee</CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Set the advance payment amount requested automatically by WhatsApp AI during customer booking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 max-w-md">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={defaultAdvanceFee}
                    onChange={(e) => setDefaultAdvanceFee(e.target.value)}
                    className="pl-7 pr-2 h-9 text-sm font-mono font-bold border-border bg-background"
                    placeholder="500"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveDefaultAdvance}
                  disabled={savingAdvance}
                  className="h-9 gap-1.5 text-xs font-semibold shrink-0"
                >
                  {savingAdvance ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Advance Fee
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Custom PayU Gateway Credentials */}
          <PayUConfig />

          {/* Card 3: Custom WhatsApp Booking Time Slots */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base text-foreground">Custom WhatsApp Booking Time Slots</CardTitle>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveTimeSlots}
                  disabled={savingSlots}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  {savingSlots ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Time Slots
                </Button>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Configure the time slot options sent to customers in the WhatsApp Interactive List button.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {timeSlots.map((slot, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted border border-border px-3 py-1 text-xs font-semibold text-foreground"
                  >
                    <Clock3 className="h-3 w-3 text-primary" />
                    {slot}
                    <button
                      onClick={() => handleRemoveSlot(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 max-w-md pt-2">
                <Input
                  type="text"
                  value={newSlotInput}
                  onChange={(e) => setNewSlotInput(e.target.value)}
                  placeholder="e.g. 10:00 AM - Morning"
                  className="h-9 text-xs border-border bg-muted"
                />
                <Button size="sm" variant="secondary" onClick={handleAddSlot} className="h-9 gap-1 text-xs shrink-0">
                  <Plus className="h-3.5 w-3.5" /> Add Slot
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
