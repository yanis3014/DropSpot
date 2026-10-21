export type RedeemStatus =
  | 'ok'
  | 'already_used'
  | 'ended'
  | 'sold_out'
  | 'not_found'
  | 'not_authenticated'
  | 'offline';

export type VerdictBand = 'ok' | 'warn' | 'danger' | 'neutral';

export interface RedeemDropCodeResult {
  ok: boolean;
  status?: string;
  title?: string;
  code_display?: string;
  flash_drop_id?: string;
  redeemed_at?: string;
  redeemed_by_name?: string;
  grains_awarded?: number;
}

export interface VerdictViewModel {
  kind: RedeemStatus;
  band: VerdictBand;
  title: string;
  body: string;
  dropTitle?: string;
  meta?: string;
  showCancelValidation: boolean;
  showAddFivePlaces: boolean;
  flashDropId?: string;
  codeDisplay?: string;
}

export function redeemStatusFromResult(
  result: RedeemDropCodeResult | null,
  offline: boolean
): RedeemStatus {
  if (offline) return 'offline';
  if (!result) return 'not_found';
  if (result.status === 'ok' || (result.ok && result.status === 'ok')) {
    return 'ok';
  }
  const s = result.status ?? 'not_found';
  if (
    s === 'already_used' ||
    s === 'ended' ||
    s === 'sold_out' ||
    s === 'not_found' ||
    s === 'not_authenticated'
  ) {
    return s;
  }
  return 'not_found';
}

export function canAddDropPlaces(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

export function buildVerdictViewModel(input: {
  status: RedeemStatus;
  result?: RedeemDropCodeResult | null;
  dropTitle?: string | null;
  metaLine?: string | null;
  endedAtLabel?: string | null;
  soldOutLabel?: string | null;
  codeTapped?: string | null;
  placeRole?: string | null;
}): VerdictViewModel {
  const {
    status,
    result,
    dropTitle,
    metaLine,
    endedAtLabel,
    soldOutLabel,
    codeTapped,
    placeRole,
  } = input;

  const codeDisplay =
    result?.code_display ??
    (codeTapped ? formatCodeFallback(codeTapped) : undefined);

  switch (status) {
    case 'ok':
      return {
        kind: 'ok',
        band: 'ok',
        title: 'Code valide',
        body: 'Tu peux servir le client.',
        dropTitle: result?.title ?? dropTitle ?? undefined,
        meta: metaLine ?? undefined,
        showCancelValidation: true,
        showAddFivePlaces: false,
        flashDropId: result?.flash_drop_id,
        codeDisplay,
      };
    case 'already_used':
      return {
        kind: 'already_used',
        band: 'warn',
        title: 'Déjà utilisé',
        body: buildAlreadyUsedBody(result),
        dropTitle: dropTitle ?? undefined,
        meta: codeDisplay ? `Code ${codeDisplay}` : undefined,
        showCancelValidation: false,
        showAddFivePlaces: false,
        codeDisplay,
      };
    case 'ended':
      return {
        kind: 'ended',
        band: 'neutral',
        title: 'Drop terminé',
        body: endedAtLabel
          ? `Ce drop a pris fin à ${endedAtLabel}, le code n'est plus valable.`
          : 'Ce drop n’est plus valable.',
        dropTitle: dropTitle ?? undefined,
        meta: codeDisplay
          ? `Code ${codeDisplay}${endedAtLabel ? ` · terminé à ${endedAtLabel}` : ''}`
          : undefined,
        showCancelValidation: false,
        showAddFivePlaces: false,
        codeDisplay,
      };
    case 'sold_out':
      return {
        kind: 'sold_out',
        band: 'danger',
        title: 'Plus de places',
        body:
          soldOutLabel ??
          'Les places de ce drop sont toutes utilisées.',
        dropTitle: dropTitle ?? undefined,
        meta: codeDisplay ? `Code ${codeDisplay}` : undefined,
        showCancelValidation: false,
        showAddFivePlaces: canAddDropPlaces(placeRole),
        flashDropId: result?.flash_drop_id,
        codeDisplay,
      };
    case 'offline':
      return {
        kind: 'offline',
        band: 'neutral',
        title: 'Pas de connexion',
        body:
          'Impossible de vérifier ce code sans réseau. Ne le valide pas : il a peut-être déjà servi.',
        dropTitle: codeTapped
          ? `Code tapé : ${formatCodeFallback(codeTapped)}`
          : undefined,
        meta: 'Il sera vérifié dès le retour du réseau.',
        showCancelValidation: false,
        showAddFivePlaces: false,
        codeDisplay: codeTapped ? formatCodeFallback(codeTapped) : undefined,
      };
    case 'not_found':
    default:
      return {
        kind: 'not_found',
        band: 'neutral',
        title: 'Code inconnu',
        body: 'Ce code ne correspond à aucun drop actif pour ce café.',
        dropTitle: dropTitle ?? undefined,
        meta: codeDisplay ? `Code ${codeDisplay}` : undefined,
        showCancelValidation: false,
        showAddFivePlaces: false,
        codeDisplay,
      };
  }
}

function formatCodeFallback(raw: string): string {
  const n = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (n.length <= 2) return n;
  return `${n.slice(0, 2)}-${n.slice(2, 6)}`;
}

function buildAlreadyUsedBody(result?: RedeemDropCodeResult | null): string {
  const name = result?.redeemed_by_name?.trim();
  const time = result?.redeemed_at
    ? formatParisTime(result.redeemed_at)
    : null;
  if (time && name) {
    return `Ce code a déjà servi à ${time}, validé par ${name}.`;
  }
  if (time) return `Ce code a déjà servi à ${time}.`;
  if (name) return `Ce code a déjà servi, validé par ${name}.`;
  return 'Ce code a déjà été utilisé.';
}

/** Europe/Paris HH:MM for ISO timestamptz strings. */
export function formatParisTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'Europe/Paris',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
