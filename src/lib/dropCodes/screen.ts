export type DropCodeStatus = 'issued' | 'redeemed' | 'cancelled';

export type DropCodeScreenKind = 'code' | 'validated' | 'cancelled';

/** Chooses the client code UI from drop_codes.status. */
export function resolveDropCodeScreen(
  status: DropCodeStatus | string | null | undefined
): DropCodeScreenKind {
  if (status === 'redeemed') return 'validated';
  if (status === 'cancelled') return 'cancelled';
  return 'code';
}
