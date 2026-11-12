/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Step } from './Step';

afterEach(cleanup);

describe('Step', () => {
  it('shows content and marks the active step', () => {
    render(<Step number={2} title="Set your trip budget" state="active"><p>form</p></Step>);
    expect(screen.getByRole('heading', { name: 'Set your trip budget' })).toBeTruthy();
    expect(screen.getByText('form')).toBeTruthy();
    expect(screen.getByText('Step 2')).toBeTruthy();
  });

  it('hides content and explains why when locked', () => {
    render(<Step number={3} title="Pay for your bookings" state="locked" lockedReason="Set your trip budget first."><p>offers</p></Step>);
    expect(screen.queryByText('offers')).toBeNull();
    expect(screen.getByText('Set your trip budget first.')).toBeTruthy();
  });

  it('shows a check mark and Done when finished', () => {
    render(<Step number={1} title="Connect your wallet" state="done"><p>connected</p></Step>);
    expect(screen.getByText('✓')).toBeTruthy();
    expect(screen.getByText('Step 1 · Done')).toBeTruthy();
  });
});
