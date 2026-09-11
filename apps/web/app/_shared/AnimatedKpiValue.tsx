'use client';

import { useEffect, useMemo, useState } from 'react';

const NUMBER_PATTERN = /^\s*([+-]?[\d\s\u00a0\u202f.,]+)(.*)$/;

function parseDisplayNumber(value: string) {
  const match = value.match(NUMBER_PATTERN);
  if (!match) return null;
  const raw = match[1].trim();
  const suffix = match[2] ?? '';
  const normalized = raw
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/,(?=\d{1,2}$)/, '.')
    .replace(/,/g, '');
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  const decimalMatch = raw.match(/[,.](\d+)$/);
  return { numeric, suffix, decimals: decimalMatch?.[1].length ?? 0 };
}

export default function AnimatedKpiValue({ value }: { value: string }) {
  const parsed = useMemo(() => parseDisplayNumber(value), [value]);
  const [display, setDisplay] = useState(() => {
    if (!parsed) return value;
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: parsed.decimals }).format(0)}${parsed.suffix}`;
  });

  useEffect(() => {
    if (!parsed) {
      setDisplay(value);
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const duration = 800;
    const formatter = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: parsed.decimals,
      maximumFractionDigits: parsed.decimals,
    });

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = parsed.numeric * eased;
      setDisplay(`${formatter.format(current)}${parsed.suffix}`);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else setDisplay(value);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [parsed, value]);

  return <span aria-hidden="true">{display}</span>;
}
