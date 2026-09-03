"use client";
import { useEffect, useRef, useState } from "react";

// Briefly flashes green/red behind a number when its value changes, the
// way live-market tickers do, so an update reads as "live" rather than
// just silently re-rendering.
export default function FlashNumber({
  value,
  formatter = (v: number) => v.toLocaleString(),
  className = "",
  flashMs = 900,
}: {
  value: number | null | undefined;
  formatter?: (v: number) => string;
  className?: string;
  flashMs?: number;
}) {
  const prevRef = useRef<number | null | undefined>(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (
      prev != null &&
      value != null &&
      Number.isFinite(prev) &&
      Number.isFinite(value) &&
      value !== prev
    ) {
      setFlash(value > prev ? "up" : "down");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setFlash(null), flashMs);
    }
    prevRef.current = value;
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, flashMs]);

  return (
    <span
      className={`inline-block rounded px-0.5 -mx-0.5 transition-colors duration-700 ${
        flash === "up" ? "bg-green-500/20" : flash === "down" ? "bg-red-500/20" : "bg-transparent"
      } ${className}`}
    >
      {value != null && Number.isFinite(value) ? formatter(value) : "—"}
    </span>
  );
}
