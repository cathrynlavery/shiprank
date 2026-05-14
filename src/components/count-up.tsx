"use client";

import { useEffect, useState } from "react";

function format(n: number) {
  return n > 0 ? `+${n.toLocaleString("en-US")}` : "0";
}

export function CountUp({
  value,
  durationMs = 900,
}: {
  value: number;
  durationMs?: number;
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

  return <>{format(n)}</>;
}
