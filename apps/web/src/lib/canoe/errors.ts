import { CATEGORIES, type Category } from './types';

export type FriendlyErrorKey =
  | 'overLimit' | 'quoteExpired' | 'tripExpired' | 'tripClosed' | 'alreadyPaid'
  | 'notOwner' | 'budgetInvalid' | 'cancelled' | 'generic';

export interface FriendlyError {
  key: FriendlyErrorKey;
  category?: Category;
  details?: string;
}

/** Ordered: "Trip is closed" must match before the generic wallet "closed" rule. */
const RULES: ReadonlyArray<[RegExp, FriendlyErrorKey]> = [
  [/Quote expired/, 'quoteExpired'],
  [/Trip expired/, 'tripExpired'],
  [/Trip is closed/, 'tripClosed'],
  [/Quote already paid/, 'alreadyPaid'],
  [/Only the trip owner/, 'notOwner'],
  [/Attached deposit must equal|Budget must be greater than zero|Expiry must be in the future/, 'budgetInvalid'],
  [/reject|cancel|denied|closed/i, 'cancelled'],
];

/** Maps contract panics and wallet errors to a message key a non-crypto user understands. */
export function friendlyError(message: string): FriendlyError {
  const over = /Over category limit: (\w+)/.exec(message);
  const category = CATEGORIES.find((c) => c === over?.[1]?.toLowerCase());
  if (category) return { key: 'overLimit', category };
  const rule = RULES.find(([pattern]) => pattern.test(message));
  return rule ? { key: rule[1] } : { key: 'generic', details: message };
}
