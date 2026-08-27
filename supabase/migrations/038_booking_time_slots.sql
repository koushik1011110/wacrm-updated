-- Add booking_time_slots column to accounts table for custom time slot configurations
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS booking_time_slots jsonb DEFAULT '["10:00 AM - Morning Slot", "02:00 PM - Afternoon Slot", "05:00 PM - Evening Slot", "08:00 PM - Night Slot"]'::jsonb;
