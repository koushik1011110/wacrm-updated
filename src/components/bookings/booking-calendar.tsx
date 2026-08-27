'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  User,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  IndianRupee,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
  payment_status: string;
  created_at: string;
}

interface BookingCalendarProps {
  bookings: Booking[];
}

export function BookingCalendar({ bookings }: BookingCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month & total days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Map bookings to dates based on booking_date or created_at
  const bookingsByDateMap = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      let dateKey = '';
      if (b.created_at) {
        dateKey = new Date(b.created_at).toISOString().split('T')[0];
      }

      // Try parsing date from booking_date text (e.g. "Today 4:00 PM", "28 Aug 4:00 PM")
      if (b.booking_date) {
        const text = b.booking_date.toLowerCase();
        const bDate = new Date(b.created_at);
        if (text.includes('tomorrow')) {
          bDate.setDate(bDate.getDate() + 1);
        } else if (text.includes('day after')) {
          bDate.setDate(bDate.getDate() + 2);
        }
        dateKey = bDate.toISOString().split('T')[0];
      }

      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(b);
    });
    return map;
  }, [bookings]);

  // Selected date key
  const selectedDateKey = selectedDate ? selectedDate.toISOString().split('T')[0] : '';
  const selectedDayBookings = bookingsByDateMap[selectedDateKey] || [];

  return (
    <div className="grid gap-6 lg:grid-cols-7 items-start">
      {/* Calendar Grid (4 Cols on lg) */}
      <Card className="border-border bg-card lg:col-span-4 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-base text-foreground font-bold">
                {monthNames[month]} {year}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs font-semibold">
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Select a date to view scheduled appointments, time slots, and advance payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground pb-2 border-b border-border">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {/* Empty slots before day 1 */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 rounded-lg bg-muted/20" />
            ))}

            {/* Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(year, month, dayNum);
              const dateStr = dateObj.toISOString().split('T')[0];
              const dayBookings = bookingsByDateMap[dateStr] || [];

              const isSelected = selectedDateKey === dateStr;
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              const confirmedCount = dayBookings.filter(
                (b) => b.status === 'confirmed' || b.payment_status === 'SUCCESS'
              ).length;
              const pendingCount = dayBookings.length - confirmedCount;

              return (
                <button
                  key={dayNum}
                  onClick={() => setSelectedDate(dateObj)}
                  className={`relative flex flex-col items-center justify-between p-1.5 h-14 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : isToday
                      ? 'border-primary/40 bg-muted/60'
                      : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      isToday ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {dayBookings.length > 0 && (
                    <div className="flex items-center gap-1 w-full justify-center">
                      {confirmedCount > 0 && (
                        <span className="flex h-2 w-2 rounded-full bg-emerald-400" title={`${confirmedCount} confirmed`} />
                      )}
                      {pendingCount > 0 && (
                        <span className="flex h-2 w-2 rounded-full bg-amber-400" title={`${pendingCount} pending`} />
                      )}
                      <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                        {dayBookings.length}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Schedule Details (3 Cols on lg) */}
      <Card className="border-border bg-card lg:col-span-3 shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            {selectedDate
              ? selectedDate.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Select a Date'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {selectedDayBookings.length}{' '}
            {selectedDayBookings.length === 1 ? 'appointment' : 'appointments'} scheduled for this date.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {selectedDayBookings.length > 0 ? (
            selectedDayBookings.map((b) => {
              const isConfirmed = b.status === 'confirmed' || b.payment_status === 'SUCCESS';

              return (
                <div
                  key={b.id}
                  className="p-3 rounded-lg border border-border bg-muted/30 space-y-2 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-primary" />
                      {b.customer_name || 'Customer'}
                    </div>
                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground font-mono">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      {b.customer_phone || 'N/A'}
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 font-bold justify-end">
                      <IndianRupee className="h-3 w-3" />
                      {Number(b.advance_amount || 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="text-xs text-foreground bg-background p-2 rounded border border-border flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Slot:</span>
                    <span className="font-semibold">{b.booking_date || b.booking_time || 'Not selected'}</span>
                  </div>

                  {b.conversation_id && (
                    <div className="pt-1 flex justify-end">
                      <Button variant="ghost" size="sm" asChild className="h-7 text-xs gap-1">
                        <Link href={`/inbox?conversation=${b.conversation_id}`}>
                          <MessageSquare className="h-3 w-3 text-primary" /> Chat in Inbox
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p>No bookings scheduled for this date.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
