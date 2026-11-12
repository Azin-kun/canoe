'use client';
import { useEffect, useState } from 'react';
import type { Rate } from '@/lib/canoe/types';

type RateResponse = { ok: true; data: { rate: Rate } } | { ok: false; error: string };
interface RatesState { rates: Record<string, Rate>; failed: boolean }

/** Live NEAR prices for USD plus every currency in `currencies`; `failed` when USD is unavailable. */
export function useNearRates(currencies: readonly string[]): RatesState {
  const key = [...new Set(['USD', ...currencies])].sort().join(',');
  const [state, setState] = useState<RatesState>({ rates: {}, failed: false });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      key.split(',').map(async (currency) => {
        const body = (await (await fetch(`/api/canoe/rate?currency=${currency}`)).json()) as RateResponse;
        return body.ok ? body.data.rate : null;
      }),
    )
      .then((list) => {
        if (cancelled) return;
        const rates = Object.fromEntries(list.filter((r): r is Rate => r !== null).map((r) => [r.currency, r]));
        setState({ rates, failed: !rates.USD });
      })
      .catch(() => { if (!cancelled) setState((prev) => ({ ...prev, failed: true })); });
    return () => { cancelled = true; };
  }, [key]);

  return state;
}
