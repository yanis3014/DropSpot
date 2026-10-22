import { describe, expect, it } from 'vitest';
import {
  CONSENSUS_THRESHOLD,
  filledPips,
  formatLastConfirmationHint,
  proRowStatus,
  votesLabel,
} from '@/app/(pro)/dashboard-pro/lib/specificites/aggregate';
import { canAccessProPath, filterProNavHref } from '@/lib/pro/navAccess';
import {
  isSpecPositive,
  pickSpecQuestions,
  type PlaceSpec,
  type PlaceSpecMap,
} from '@/lib/specs';
import { placeMatchesFilter, type PlacePulse } from '@/lib/filters';
import type { Place } from '@/lib/api/places';

function spec(partial: Partial<PlaceSpec> & Pick<PlaceSpec, 'spec'>): PlaceSpec {
  return {
    place_id: 'p',
    declared: false,
    yes_votes: 0,
    no_votes: 0,
    score: 0,
    status: 'pending',
    last_vote_at: null,
    ...partial,
  };
}

describe('pouls du café', () => {
  it('affiche les statuts et les votes côté pro', () => {
    expect(CONSENSUS_THRESHOLD).toBe(3);
    expect(filledPips(5)).toBe(3);
    expect(proRowStatus('confirmed')).toBe('confirmed');
    expect(proRowStatus('declared')).toBe('pending');
    expect(proRowStatus('disputed')).toBe('contested');
    expect(votesLabel({ yes_votes: 4, no_votes: 1 })).toBe('4 oui · 1 non');
    expect(votesLabel({ yes_votes: 0, no_votes: 0 })).toBe('Aucun vote');
  });

  it('ne garde une spécificité que confirmée, annoncée ou plutôt oui', () => {
    expect(isSpecPositive(spec({ spec: 'wifi', status: 'confirmed' }))).toBe(true);
    expect(isSpecPositive(spec({ spec: 'wifi', status: 'declared' }))).toBe(true);
    expect(isSpecPositive(spec({ spec: 'wifi', yes_votes: 1 }))).toBe(true);
    expect(isSpecPositive(spec({ spec: 'wifi', yes_votes: 1, no_votes: 1 }))).toBe(false);
    expect(isSpecPositive(spec({ spec: 'wifi', status: 'disputed' }))).toBe(false);
    expect(isSpecPositive(undefined)).toBe(false);
  });

  it('pose d’abord les questions sur ce qui reste à vérifier', () => {
    const specs: PlaceSpecMap = {
      wifi: spec({ spec: 'wifi', status: 'confirmed' }),
      matcha: spec({ spec: 'matcha', status: 'declared', declared: true }),
      calm: spec({ spec: 'calm', status: 'disputed' }),
    };
    expect(pickSpecQuestions(specs, [])).toEqual(['matcha', 'calm']);
    expect(pickSpecQuestions(specs, ['matcha'])).toEqual(['calm', 'plugs']);
  });

  it('filtre la carte avec le pouls du café', () => {
    const place = { id: 'p', name: 'Café', lat: 43.7, lng: 7.26, categories: [] } as Place;
    const pulse: PlacePulse = {
      specs: { p: { matcha: spec({ spec: 'matcha', status: 'confirmed' }) } },
      vibes: {
        p: {
          place_id: 'p',
          crowd_level: 'full',
          wifi_speed: 'good',
          contributors: 2,
          latest_at: new Date().toISOString(),
        },
      },
    };
    expect(placeMatchesFilter(place, 'matcha', pulse)).toBe(true);
    // Wi-Fi rapide signalé dans les 3 dernières heures
    expect(placeMatchesFilter(place, 'wifi', pulse)).toBe(true);
    // Blindé en ce moment : pas calme
    expect(placeMatchesFilter(place, 'calme', pulse)).toBe(false);
    // Horaires inconnus : pas « ouvert maintenant »
    expect(placeMatchesFilter(place, 'open_now', pulse)).toBe(false);
  });

  it('formate le dernier vote', () => {
    const now = new Date('2026-10-22T12:00:00.000Z');
    expect(
      formatLastConfirmationHint('2026-10-22T10:00:00.000Z', now)
    ).toMatch(/il y a 2 h/);
  });
});

describe('navAccess specificites', () => {
  it('autorise tous les rôles en lecture', () => {
    expect(canAccessProPath('/specificites', 'owner')).toBe(true);
    expect(canAccessProPath('/specificites', 'manager')).toBe(true);
    expect(canAccessProPath('/specificites', 'staff')).toBe(true);
    expect(filterProNavHref('/specificites', 'staff')).toBe(true);
    expect(filterProNavHref('/specificites', 'manager')).toBe(true);
  });
});
