"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtime(
  table: string,
  onUpdate: () => void | Promise<void>
) {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime:${table}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => void onUpdate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate, supabase, table]);
}
