/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TripCreateForm } from './TripCreateForm';
import type { Rate } from '@/lib/canoe/types';

afterEach(cleanup);
const NEAR = 10n ** 24n;
const usd: Rate = { currency: 'USD', nearPrice: 2.5, fetchedAt: '2026-11-12T00:00:00Z', source: 'coingecko' };

describe('TripCreateForm', () => {
  it('shows how much NEAR the USD budget sets aside', () => {
    render(<TripCreateForm disabled={false} usdRate={usd} rateError={false} onCreate={vi.fn()} />);
    // $100 + $100 + $50 = $250 → 100 NEAR real → 1 NEAR at the 1% demo scale
    expect(screen.getByRole('button', { name: 'Set aside 1 NEAR' })).toBeTruthy();
    expect(screen.getByText(/demo price for \$250/)).toBeTruthy();
  });

  it('submits yocto limits per category', () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<TripCreateForm disabled={false} usdRate={usd} rateError={false} onCreate={onCreate} />);
    // The label also contains the "$" prefix, so match by pattern.
    fireEvent.change(screen.getByLabelText(/Car rental budget \(USD\)/), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Set aside/ }));
    expect(onCreate).toHaveBeenCalledWith({ flight: (4n * NEAR) / 10n, hotel: (4n * NEAR) / 10n, car: NEAR / 10n }, 30);
  });

  it('waits for the price before allowing a budget', () => {
    render(<TripCreateForm disabled={false} usdRate={null} rateError={false} onCreate={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Loading price…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('explains when the price cannot load', () => {
    render(<TripCreateForm disabled={false} usdRate={null} rateError onCreate={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Can't load the NEAR price/);
  });
});
