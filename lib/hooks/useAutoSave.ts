"use client";

import { useEffect, useRef } from "react";

function emitSaveStatus(status: "saving" | "saved" | "error") {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("kin-save-status", {
      detail: status,
    })
  );
}

export function useAutoSave<T>(
  value: T,
  saveFn: (value: T) => Promise<void> | void,
  delay = 300
) {
  const firstRender = useRef(true);
  const timeoutRef = useRef<number | null>(null);
  const serializedValue = JSON.stringify(value);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      try {
        emitSaveStatus("saving");
        await saveFn(value);
        emitSaveStatus("saved");
      } catch (error) {
        console.error(error);
        emitSaveStatus("error");
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [delay, saveFn, serializedValue, value]);
}
