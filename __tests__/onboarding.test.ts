import { beforeEach, describe, expect, it } from 'vitest';
import type { Place } from '@/lib/api/places';
import type { Drop } from '@/lib/api/drops';
import { clientOnboardingPath, destinationAfterAuth } from '@/lib/auth/redirect';
import {
  answersToPreferenceIds,
  emptyOnboardingAnswers,
  needsForEnvies,
  parseOnboardingAnswers,
} from '@/lib/onboarding';
import {
  hasSeenOnboarding,
  markLocalOnboardingSkipped,
  markLocalOnboardingSynced,
  pendingLocalAnswers,
  saveLocalOnboarding,
} from '@/lib/onboardingStorage';
import {
  mapFiltersForAnswers,
  pickDropForAnswers,
  rankPlaces,
  referencePoint,
} from '@/lib/onboardingSelection';

const NICE = { lat: 43.7009, lng: 7.2683 };

function place(partial: Partial<Place> & { id: string }): Place {
  return {
    name: partial.id,
    lat: NICE.lat,
    lng: NICE.lng,
    categories: [],
    ...partial,
  };
}

function drop(partial: Partial<Drop> & { id: string }): Drop {
  const hour = 60 * 60 * 1000;
  return {
    title: partial.id,
    drop_type: 'promo',
    start_time: new Date(Date.now() - hour).toISOString(),
    end_time: new Date(Date.now() + hour).toISOString(),
    place_id: 'p',
    ...partial,
  };
}

describe('réponses d’onboarding', () => {
  it('pré-coche les indispensables selon les envies, sans doublon', () => {
    expect(needsForEnvies(['work', 'chill'])).toEqual(['wifi', 'plugs', 'calm', 'laptop']);
    expect(needsForEnvies(['brunch'])).toEqual([]);
  });

  it('convertit les envies en préférences du profil', () => {
    expect(answersToPreferenceIds({ envies: ['work', 'matcha', 'specialty'] })).toEqual([
      'remote',
      'specialty',
    ]);
  });

  it('relit l’ancien format (mood unique, wifi, boissons)', () => {
    const parsed = parseOnboardingAnswers({
      mood: 'social',
      wifi: 'essential',
      ambiances: ['calm', 'terrace'],
      drinks: ['matcha'],
      zones: ['vieux', 'inconnue'],
      avatarPreset: 'leaf',
    });
    expect(parsed.envies).toEqual(['friends', 'terrace', 'matcha']);
    expect(parsed.needs).toEqual(['wifi', 'plugs', 'calm']);
    expect(parsed.zones).toEqual(['vieux']);
    expect(parsed.version).toBe(2);
  });

  it('ignore les valeurs inconnues et les doublons', () => {
    const parsed = parseOnboardingAnswers({
      envies: ['work', 'work', 'hack'],
      needs: ['wifi', 42],
      avatarColor: 'rose-fluo',
    });
    expect(parsed.envies).toEqual(['work']);
    expect(parsed.needs).toEqual(['wifi']);
    expect(parsed.avatarColor).toBeNull();
  });
});

describe('copie locale avant le compte', () => {
  beforeEach(() => localStorage.clear());

  it('garde les envies jusqu’à l’inscription, puis les oublie', () => {
    expect(hasSeenOnboarding()).toBe(false);
    saveLocalOnboarding({ ...emptyOnboardingAnswers(), envies: ['brunch'] });
    expect(hasSeenOnboarding()).toBe(true);
    expect(pendingLocalAnswers()?.envies).toEqual(['brunch']);

    markLocalOnboardingSynced();
    expect(hasSeenOnboarding()).toBe(true);
    expect(pendingLocalAnswers()).toBeNull();
  });

  it('« Passer » ne remplace pas des envies déjà choisies', () => {
    saveLocalOnboarding({ ...emptyOnboardingAnswers(), envies: ['sport'] });
    markLocalOnboardingSkipped();
    expect(pendingLocalAnswers()?.envies).toEqual(['sport']);
  });

  it('résiste à une valeur corrompue', () => {
    localStorage.setItem('dropspot_onboarding', '{pas du json');
    expect(hasSeenOnboarding()).toBe(false);
    expect(pendingLocalAnswers()).toBeNull();
  });
});

describe('sélection de cafés', () => {
  const work = place({ id: 'work', has_plugs: true, wifi_speed: 'fast', laptop_policy: 'always' });
  const brunch = place({ id: 'brunch', categories: ['brunch'] });
  const brunchFar = place({ id: 'brunch-far', categories: ['brunch'], lat: 43.75 });
  const plain = place({ id: 'plain', lat: 43.701 });

  it('classe par envies puis par distance', () => {
    const answers = { envies: ['brunch' as const], needs: [] };
    const result = rankPlaces([brunchFar, plain, brunch, work], answers, NICE);
    expect(result.fallback).toBe(false);
    expect(result.matchCount).toBe(2);
    expect(result.items.map((i) => i.place.id)).toEqual(['brunch', 'brunch-far']);
    expect(result.items[0].envies).toEqual(['brunch']);
  });

  it('ne prend pas « ordi autorisé » ou « ambiance modérée » pour du travail ou du calme', () => {
    // As in production: every café has laptop_policy=always and noise_level=ambient.
    const cafe = place({
      id: 'cafe',
      category: 'Brunch',
      categories: ['brunch', 'remote'],
      laptop_policy: 'always',
      noise_level: 'ambient',
    });
    const result = rankPlaces([cafe], { envies: ['work', 'chill'], needs: ['wifi', 'calm'] }, NICE);
    expect(result.fallback).toBe(true);
  });

  it('repère une terrasse dans la description', () => {
    const patio = place({ id: 'patio', description: 'Grande terrasse ensoleillée' });
    const result = rankPlaces([patio, plain], { envies: ['terrace'], needs: [] }, NICE);
    expect(result.items[0].place.id).toBe('patio');
    expect(result.matchCount).toBe(1);
  });

  it('une envie pèse plus qu’un indispensable', () => {
    const answers = { envies: ['brunch' as const], needs: ['wifi' as const] };
    const result = rankPlaces([work, brunch], answers, NICE);
    expect(result.items[0].place.id).toBe('brunch');
  });

  it('compte les cafés qui collent aux envies, pas aux seuls indispensables', () => {
    const answers = { envies: ['brunch' as const], needs: ['laptop' as const] };
    const result = rankPlaces([brunch, work], answers, NICE);
    expect(result.matchCount).toBe(1);
    expect(result.items.map((i) => i.place.id)).toEqual(['brunch']);
  });

  it('garde au moins un café par envie dans la sélection', () => {
    const coworkings = ['w1', 'w2', 'w3'].map((id) =>
      place({ id, has_plugs: true, wifi_speed: 'fast', laptop_policy: 'always' })
    );
    const answers = { envies: ['work' as const, 'brunch' as const], needs: needsForEnvies(['work']) };
    const ids = rankPlaces([...coworkings, brunch], answers, NICE).items.map((i) => i.place.id);
    expect(ids).toHaveLength(3);
    expect(ids).toContain('brunch');
  });

  it('montre les plus proches quand rien ne correspond', () => {
    const answers = { envies: ['sport' as const], needs: [] };
    const result = rankPlaces([brunchFar, plain], answers, NICE);
    expect(result.fallback).toBe(true);
    expect(result.matchCount).toBe(0);
    expect(result.items[0].place.id).toBe('plain');
  });

  it('part de la position, sinon du premier quartier choisi', () => {
    const here = { lat: 1, lng: 2 };
    expect(referencePoint({ zones: ['gare'] }, here)).toBe(here);
    expect(referencePoint({ zones: ['gare'] }, null)).toEqual({ lat: 43.7046, lng: 7.2619 });
    expect(referencePoint({ zones: [] }, null)).toEqual(NICE);
  });
});

describe('filtres de carte à l’arrivée', () => {
  const wifiOnly = (id: string) => place({ id, wifi_speed: 'fast' });
  const quietWifi = (id: string) => place({ id, wifi_speed: 'fast', noise_level: 'quiet' });

  it('active les puces correspondant aux indispensables', () => {
    const places = [quietWifi('a'), quietWifi('b'), quietWifi('c')];
    expect(mapFiltersForAnswers({ needs: ['plugs', 'calm', 'laptop'] }, places)).toEqual([
      'wifi',
      'calme',
    ]);
  });

  it('retire des filtres tant qu’il reste trop peu de cafés', () => {
    const places = [quietWifi('a'), wifiOnly('b'), wifiOnly('c')];
    expect(mapFiltersForAnswers({ needs: ['wifi', 'calm'] }, places)).toEqual(['wifi']);
    expect(mapFiltersForAnswers({ needs: ['matcha'] }, places)).toEqual([]);
  });

  it('n’active rien sans cafés chargés', () => {
    expect(mapFiltersForAnswers({ needs: ['wifi'] }, [])).toEqual([]);
  });
});

describe('drop mis en avant', () => {
  it('préfère un drop qui colle aux envies, ignore les drops finis', () => {
    const ended = drop({
      id: 'ended',
      drop_type: 'sport',
      start_time: new Date(Date.now() - 3 * 3600_000).toISOString(),
      end_time: new Date(Date.now() - 3600_000).toISOString(),
    });
    const promo = drop({ id: 'promo' });
    const run = drop({ id: 'run', drop_type: 'sport' });
    expect(pickDropForAnswers([ended, promo, run], { envies: ['sport'] })?.id).toBe('run');
    expect(pickDropForAnswers([ended, promo], { envies: ['sport'] })?.id).toBe('promo');
    expect(pickDropForAnswers([ended], { envies: ['sport'] })).toBeNull();
  });
});

describe('redirection vers l’onboarding client', () => {
  it('garde la page visée après le profil', () => {
    expect(
      destinationAfterAuth({ isPro: false, onboardingCompleted: false }, '/place/abc')
    ).toBe('/onboarding?next=%2Fplace%2Fabc');
  });

  it('ne garde pas une page vague ou l’onboarding lui-même', () => {
    expect(clientOnboardingPath('/')).toBe('/onboarding');
    expect(clientOnboardingPath('/map')).toBe('/onboarding');
    expect(clientOnboardingPath('/onboarding')).toBe('/onboarding');
    expect(clientOnboardingPath('/onboarding?edit=1')).toBe('/onboarding');
  });

  it('un pro n’est jamais envoyé vers l’onboarding client', () => {
    expect(
      destinationAfterAuth({ isPro: true, onboardingCompleted: false }, '/onboarding')
    ).toBe('/dashboard-pro');
  });
});
