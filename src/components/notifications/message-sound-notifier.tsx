"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { playNotificationSound } from "@/lib/sound";
import type { Message } from "@/types";

export function MessageSoundNotifier() {
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("global-message-sound")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          // Play sound when an incoming message (from customer) arrives
          if (newMsg && newMsg.sender_type !== "agent") {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
