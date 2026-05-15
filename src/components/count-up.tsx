"use client";

import { useEffect, useState } from "react";

function format(n: number, signed: boolean, suffix?: string) {
  const formatted =
    signed && n > 0 ? `+${n.toLocaleString("en-US")}` : n.toLocaleString("en-US");
  return suffix ? `${formatted} ${suffix}` : formatted;
}

export function CountUp({
  value,
  durationMs = 900,
  signed = true,
  suffix,
}: {
  value: number;
  durationMs?: number;
  signed?: boolean;
  suffix?: string;
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(Math.max(0, value) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{format(n, signed, suffix)}</>;
}
