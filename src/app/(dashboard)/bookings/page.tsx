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
  Camera,
  Layers,
  Tag,
  Package,
  Edit2,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PayUConfig } from '@/components/settings/payu-config';
import { BookingCalendar } from '@/components/bookings/booking-calendar';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import { toast } from 'sonner';

export interface BookingCategory {
  id: string;
  account_id?: string;
  name: string;
  category_type: 'service' | 'rental';
  advance_amount: number;
  keywords: string[];
  description?: string | null;
  time_slots?: string[] | null;
  is_active: boolean;
  created_at?: string;
}

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
  service_name?: string;
  category_type?: string;
  category_id?: string;
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

const SERVICE_PRESET_SLOTS = [
  '10:00 AM - Morning Slot',
  '02:00 PM - Afternoon Slot',
  '05:00 PM - Evening Slot',
  '08:00 PM - Night Slot',
  '2 Hours Studio Slot',
  '4 Hours Studio Slot',
  'Full Day Studio',
];

const RENTAL_PRESET_SLOTS = [
  'Full Day (10 AM - 8 PM)',
  'Half Day (4 Hours)',
  '24 Hours Rental',
  '2 Days Rental',
  '3+ Days Rental',
  '1 Week Rental',
  'Per Shift (8 Hours)',
];

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'categories' | 'settings'>('monitor');
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [categories, setCategories] = useState<BookingCategory[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    confirmed: 0,
    pending_payment: 0,
    total_advance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Default Advance Fee State
  const [defaultAdvanceFee, setDefaultAdvanceFee] = useState<string>('500');
  const [savingAdvance, setSavingAdvance] = useState(false);

  // Custom Booking Time Slots State
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [newSlotInput, setNewSlotInput] = useState('');
  const [savingSlots, setSavingSlots] = useState(false);

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BookingCategory | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'service' | 'rental'>('service');
  const [catAdvance, setCatAdvance] = useState('500');
  const [catKeywords, setCatKeywords] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catSlotList, setCatSlotList] = useState<string[]>([]);
  const [newCatSlotInput, setNewCatSlotInput] = useState('');
  const [catIsActive, setCatIsActive] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const json = await res.json();
        setBookings(json.bookings || []);
        setCategories(json.categories || []);
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

  // Open Category Modal for Add / Edit
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatType('service');
    setCatAdvance('500');
    setCatKeywords('studio, photoshoot, video shoot, booking');
    setCatDescription('');
    setCatSlotList([
      '10:00 AM - Morning Slot',
      '02:00 PM - Afternoon Slot',
      '05:00 PM - Evening Slot',
      '08:00 PM - Night Slot',
    ]);
    setNewCatSlotInput('');
    setCatIsActive(true);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: BookingCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatType(cat.category_type);
    setCatAdvance(String(cat.advance_amount));
    setCatKeywords(Array.isArray(cat.keywords) ? cat.keywords.join(', ') : '');
    setCatDescription(cat.description || '');
    setCatSlotList(Array.isArray(cat.time_slots) ? cat.time_slots : []);
    setNewCatSlotInput('');
    setCatIsActive(cat.is_active);
    setIsCategoryModalOpen(true);
  };

  const handleTogglePresetSlot = (slot: string) => {
    if (catSlotList.includes(slot)) {
      setCatSlotList(catSlotList.filter((s) => s !== slot));
    } else {
      if (catSlotList.length >= 10) {
        toast.error('Maximum 10 time slots allowed per category');
        return;
      }
      setCatSlotList([...catSlotList, slot]);
    }
  };

  const handleAddCatSlot = () => {
    const clean = newCatSlotInput.trim().slice(0, 24);
    if (!clean) return;
    if (catSlotList.includes(clean)) {
      toast.error('This slot is already added');
      return;
    }
    if (catSlotList.length >= 10) {
      toast.error('Maximum 10 slots allowed per category');
      return;
    }
    setCatSlotList([...catSlotList, clean]);
    setNewCatSlotInput('');
  };

  const handleRemoveCatSlot = (idx: number) => {
    setCatSlotList(catSlotList.filter((_, i) => i !== idx));
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      toast.error('Please enter category / product name');
      return;
    }
    const numAdvance = parseFloat(catAdvance);
    if (isNaN(numAdvance) || numAdvance < 0) {
      toast.error('Please enter a valid advance fee amount');
      return;
    }

    const keywordArray = catKeywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    setSavingCategory(true);
    try {
      const payload = {
        id: editingCategory?.id,
        name: catName.trim(),
        category_type: catType,
        advance_amount: numAdvance,
        keywords: keywordArray,
        description: catDescription.trim(),
        time_slots: catSlotList.length > 0 ? catSlotList : null,
        is_active: catIsActive,
      };

      const res = await fetch('/api/bookings/categories', {
        method: editingCategory ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(
          editingCategory
            ? `Category "${catName}" updated successfully!`
            : `New Category "${catName}" created!`
        );
        setIsCategoryModalOpen(false);
        void fetchBookings();
      } else {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson.error || 'Failed to save category');
      }
    } catch {
      toast.error('Error saving category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSeedDefaults = async () => {
    const defaultItems = [
      {
        name: 'Studio Booking',
        category_type: 'service',
        advance_amount: 500,
        keywords: ['studio', 'studio booking', 'photoshoot', 'video shoot', 'recording'],
        description: 'Photo & Video Production Studio Space',
        time_slots: ['10:00 AM - Morning', '02:00 PM - Afternoon', '05:00 PM - Evening', '08:00 PM - Night'],
        is_active: true,
      },
      {
        name: 'Camera Booking',
        category_type: 'rental',
        advance_amount: 1000,
        keywords: ['camera', 'camera booking', 'camera rental', 'gear', 'lens', 'dslr', 'sony', 'canon'],
        description: 'Professional Camera & DSLR Gear Rental',
        time_slots: ['Full Day (10 AM - 8 PM)', 'Half Day (4 Hours)', '24 Hours Rental', '2 Days Rental'],
        is_active: true,
      },
      {
        name: 'Lens & Lighting Kit',
        category_type: 'rental',
        advance_amount: 500,
        keywords: ['lens', 'lighting', 'light', 'kit', 'accessories', 'tripod'],
        description: 'Prime / Zoom Lenses & Studio Lighting Kit',
        time_slots: ['Full Day (10 AM - 8 PM)', 'Half Day (4 Hours)', '24 Hours Rental'],
        is_active: true,
      },
      {
        name: 'Drone Rental',
        category_type: 'rental',
        advance_amount: 1500,
        keywords: ['drone', 'dji', 'aerial', 'drone booking', 'drone rental'],
        description: '4K Aerial Drone with Controller & Extra Batteries',
        time_slots: ['Full Day (10 AM - 8 PM)', 'Half Day (4 Hours)', '24 Hours Rental'],
        is_active: true,
      },
    ];

    setSavingCategory(true);
    try {
      for (const item of defaultItems) {
        await fetch('/api/bookings/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
      }
      toast.success('Default Studio & Rental categories initialized!');
      void fetchBookings();
    } catch {
      toast.error('Failed to initialize default categories');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"?`)) return;

    setDeletingCatId(id);
    try {
      const res = await fetch('/api/bookings/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        toast.success(`Category "${name}" deleted`);
        void fetchBookings();
      } else {
        toast.error('Failed to delete category');
      }
    } catch {
      toast.error('Error deleting category');
    } finally {
      setDeletingCatId(null);
    }
  };

  const handleToggleCategoryActive = async (cat: BookingCategory) => {
    try {
      const res = await fetch('/api/bookings/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cat.id, is_active: !cat.is_active }),
      });

      if (res.ok) {
        toast.success(`${cat.name} is now ${!cat.is_active ? 'Active' : 'Inactive'}`);
        void fetchBookings();
      } else {
        toast.error('Failed to update category status');
      }
    } catch {
      toast.error('Error updating status');
    }
  };

  // Filter bookings by search query, status tab, and category
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      (b.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.customer_phone || '').includes(searchQuery) ||
      (b.service_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.cashfree_order_id || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true : b.status === statusFilter;

    const matchesCategory =
      categoryFilter === 'all'
        ? true
        : b.service_name === categoryFilter || b.category_id === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <SubscriptionGate
      featureName="WhatsApp Booking System"
      featureDescription="Automated multi-service slot selection, rental gear bookings, and PayU advance payment collections require an active Pro subscription or free coupon grant."
    >
      <div className="min-h-screen bg-background p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Booking Hub & Services</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage Studio bookings, Rental products, WhatsApp AI customer slot reservations, and advance fees.
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
        <Tabs
          defaultValue="monitor"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full space-y-6"
        >
          <TabsList className="grid w-full grid-cols-3 max-w-xl bg-muted p-1 border border-border rounded-lg">
            <TabsTrigger value="monitor" className="flex items-center gap-2 text-xs font-semibold">
              <CalendarCheck className="h-4 w-4" /> Bookings & Calendar
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 text-xs font-semibold">
              <Layers className="h-4 w-4 text-primary" /> Categories & Rentals
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2 text-xs font-semibold">
              <Sliders className="h-4 w-4" /> Gateway & Settings
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
                  <p className="text-[11px] text-muted-foreground mt-1">Total advance collected</p>
                </CardContent>
              </Card>
            </div>

            {/* View Mode & Filters Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
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

              {/* Status Filters */}
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customer name, phone, item, or Ref ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 border-border bg-muted text-foreground"
                    />
                  </div>

                  {/* Category Filter */}
                  {categories.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-semibold">Category:</span>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-9 px-3 text-xs rounded-md bg-muted border border-border text-foreground font-medium"
                      >
                        <option value="all">All Categories</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name} ({cat.category_type === 'rental' ? 'Rental' : 'Service'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <Card className="border-border bg-card shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-foreground">
                      <CalendarCheck className="h-4 w-4 text-primary" /> Booking Records ({filteredBookings.length})
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      List of all WhatsApp AI bookings, selected category/rental items, and payment statuses.
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
                              <th className="p-3">Item / Service</th>
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
                                    <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                      {b.category_type === 'rental' ? (
                                        <Package className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                      ) : (
                                        <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
                                      )}
                                      <span>{b.service_name || 'Studio Booking'}</span>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground capitalize mt-0.5">
                                      {b.category_type === 'rental' ? 'Rental Product' : 'Service Booking'}
                                    </div>
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
                                        <Link href={`/inbox?conversation=${b.conversation_id}`}>
                                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                                            <MessageSquare className="h-3.5 w-3.5 text-primary" /> Chat
                                          </Button>
                                        </Link>
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

          {/* TAB 2: BOOKING CATEGORIES & RENTAL PRODUCTS */}
          <TabsContent value="categories" className="space-y-6 m-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" /> Booking Categories & Rental Products
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure services (like Studio Booking) and rental gear (like Camera Booking), with separate advance prices & keywords.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {categories.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={handleSeedDefaults}
                    disabled={savingCategory}
                    size="sm"
                    className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Initialize Sample Categories
                  </Button>
                )}
                <Button onClick={handleOpenAddCategory} size="sm" className="gap-1.5 text-xs font-semibold">
                  <Plus className="h-4 w-4" /> Add Service / Rental Item
                </Button>
              </div>
            </div>

            {/* Category Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.length > 0 ? (
                categories.map((cat) => {
                  const isRental = cat.category_type === 'rental';
                  return (
                    <Card
                      key={cat.id}
                      className={`border-border bg-card shadow-sm transition-all hover:border-primary/40 ${
                        !cat.is_active ? 'opacity-60 border-dashed' : ''
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                  isRental
                                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                                    : 'bg-primary/10 border border-primary/30 text-primary'
                                }`}
                              >
                                {isRental ? <Package className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
                                {isRental ? 'Rental Product' : 'Service'}
                              </span>

                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  cat.is_active
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {cat.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </div>

                            <CardTitle className="text-base font-bold text-foreground">{cat.name}</CardTitle>
                          </div>

                          <div className="text-right">
                            <div className="text-xs text-muted-foreground font-medium">Advance Fee</div>
                            <div className="text-lg font-mono font-bold text-emerald-400">
                              ₹{Number(cat.advance_amount || 500).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {cat.description && (
                          <CardDescription className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {cat.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3 pt-0">
                        {/* Trigger Keywords */}
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                            <Tag className="h-3 w-3 text-primary" /> Trigger Keywords:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray(cat.keywords) && cat.keywords.length > 0 ? (
                              cat.keywords.map((kw, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-muted border border-border px-1.5 py-0.5 rounded text-foreground font-mono"
                                >
                                  {kw}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">No custom keywords</span>
                            )}
                          </div>
                        </div>

                        {/* Time Slots / Durations */}
                        {Array.isArray(cat.time_slots) && cat.time_slots.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                              <Clock3 className="h-3 w-3 text-primary" /> Custom Slots / Durations:
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {cat.time_slots.slice(0, 3).map((slot, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] bg-muted/60 border border-border px-1.5 py-0.5 rounded text-muted-foreground"
                                >
                                  {slot}
                                </span>
                              ))}
                              {cat.time_slots.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{cat.time_slots.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleCategoryActive(cat)}
                            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                          >
                            {cat.is_active ? 'Disable' : 'Enable'}
                          </Button>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="h-7 text-xs gap-1 px-2.5"
                            >
                              <Edit2 className="h-3 w-3 text-primary" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCategory(cat.id, cat.name)}
                              disabled={deletingCatId === cat.id}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            >
                              {deletingCatId === cat.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground space-y-3 bg-muted/20 border border-dashed border-border rounded-xl">
                  <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <div>
                    <h3 className="font-semibold text-foreground">No Categories Configured</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Set up your service categories (e.g. Studio Booking) and rental equipment (e.g. Camera Booking).
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      onClick={handleSeedDefaults}
                      disabled={savingCategory}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Initialize Sample Categories
                    </Button>
                    <Button onClick={handleOpenAddCategory} size="sm" className="gap-1 text-xs">
                      <Plus className="h-3.5 w-3.5" /> Add Custom Category
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: GATEWAY & GLOBAL SETTINGS */}
          <TabsContent value="settings" className="space-y-6 m-0">
            {/* Card 1: Default Advance Payment Amount */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base text-foreground">Fallback Workspace Advance Fee</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  Default advance payment amount used if a booking does not specify a custom category price.
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
                    Save Fallback Fee
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Custom PayU Gateway Credentials */}
            <PayUConfig />

            {/* Card 3: Global WhatsApp Booking Time Slots */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base text-foreground">Global WhatsApp Booking Time Slots</CardTitle>
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
                  Configure default slot options sent to customers in the WhatsApp Interactive List button.
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

      {/* ADD / EDIT CATEGORY MODAL DIALOG */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-2 shrink-0 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {editingCategory ? <Edit2 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              {editingCategory ? 'Edit Booking Category / Product' : 'Add Booking Category / Rental Item'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure category name, type, trigger keywords, and individual advance booking fee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5 overflow-y-auto max-h-[calc(90vh-140px)] text-xs">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Category / Product Name *</label>
              <Input
                placeholder="e.g. Studio Booking or Camera Booking (Rental)"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="h-9 text-xs border-border bg-muted"
              />
            </div>

            {/* Type & Advance Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Booking Type *</label>
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-muted text-xs text-foreground font-medium"
                >
                  <option value="service">🎙️ Service (e.g. Studio)</option>
                  <option value="rental">📦 Rental Product (e.g. Camera)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Advance Booking Fee (₹) *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-bold">₹</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="500"
                    value={catAdvance}
                    onChange={(e) => setCatAdvance(e.target.value)}
                    className="pl-6 h-9 text-xs font-mono font-bold border-border bg-muted"
                  />
                </div>
              </div>
            </div>

            {/* Trigger Keywords */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground flex items-center justify-between">
                <span>WhatsApp Trigger Keywords (Comma separated)</span>
                <span className="text-[10px] text-muted-foreground font-normal">e.g. studio, camera, rental</span>
              </label>
              <Input
                placeholder="e.g. camera, camera rental, camera booking, gear, dslr"
                value={catKeywords}
                onChange={(e) => setCatKeywords(e.target.value)}
                className="h-9 text-xs border-border bg-muted"
              />
              <p className="text-[10px] text-muted-foreground">
                When a customer includes any of these words in their message, AI starts this specific booking process.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Short Description (Optional)</label>
              <Textarea
                placeholder="e.g. Professional photo & video studio slot with lighting gear"
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
                rows={2}
                className="text-xs border-border bg-muted resize-none"
              />
            </div>

            {/* Custom Slots / Durations Interactive Selector */}
            <div className="space-y-2.5 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-foreground flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {catType === 'rental' ? 'Rental Duration Options / Slots' : 'Booking Time Slots'}
                </label>
                <span className="text-[10px] text-muted-foreground font-mono font-semibold">
                  {catSlotList.length}/10 selected
                </span>
              </div>

              {/* Quick Preset Selector Buttons */}
              <div className="space-y-1">
                <span className="text-[10px] font-medium text-muted-foreground">Click presets to add / select:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(catType === 'rental' ? RENTAL_PRESET_SLOTS : SERVICE_PRESET_SLOTS).map((preset) => {
                    const isSelected = catSlotList.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleTogglePresetSlot(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-muted text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Slots Badges List */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-medium text-foreground">Selected Active Slots:</span>
                {catSlotList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-md bg-background border border-border">
                    {catSlotList.map((slot, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded bg-muted border border-border px-2 py-0.5 text-xs text-foreground font-medium"
                      >
                        <Clock className="h-3 w-3 text-primary shrink-0" />
                        {slot}
                        <button
                          type="button"
                          onClick={() => handleRemoveCatSlot(idx)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground italic p-2 rounded border border-dashed border-border bg-background/50">
                    No custom slots selected (will use workspace default time slots).
                  </div>
                )}
              </div>

              {/* Custom Slot Adder Input */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder={catType === 'rental' ? 'e.g. 3 Days (Weekend)' : 'e.g. 11:30 AM - Custom Slot'}
                  value={newCatSlotInput}
                  onChange={(e) => setNewCatSlotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCatSlot();
                    }
                  }}
                  className="h-8 text-xs border-border bg-background"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleAddCatSlot}
                  className="h-8 text-xs shrink-0 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Custom
                </Button>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/40">
              <div>
                <div className="font-semibold text-foreground text-xs">Enable this Booking Category</div>
                <div className="text-[11px] text-muted-foreground">Allow WhatsApp customers to select and book this item</div>
              </div>
              <input
                type="checkbox"
                checked={catIsActive}
                onChange={(e) => setCatIsActive(e.target.checked)}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-card shrink-0 gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoryModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCategory}
              disabled={savingCategory}
              className="gap-1.5 text-xs font-semibold"
            >
              {savingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {editingCategory ? 'Update Category' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SubscriptionGate>
  );
}
