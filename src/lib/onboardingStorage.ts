import {
  parseOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/onboarding';

/**
 * Guest copy of the onboarding answers. Envies are chosen before any account
 * exists; they stay on the device until sign-up, then move to
 * `profiles.onboarding_answers`. Nothing here is trusted server-side.
 */
export const ONBOARDING_STORAGE_KEY = 'dropspot_onboarding';

/**
 * - `done`: the guest finished the questionnaire, answers wait for sign-up.
 * - `skipped`: the guest left without answering.
 * - `synced`: answers were saved to the profile and removed from the device.
 */
export type LocalOnboardingStatus = 'done' | 'skipped' | 'synced';

export interface LocalOnboarding {
  status: LocalOnboardingStatus;
  answers: OnboardingAnswers | null;
}

export function readLocalOnboarding(): LocalOnboarding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const status = parsed.status;
    if (status !== 'done' && status !== 'skipped' && status !== 'synced') {
      return null;
    }
    return {
      status,
      answers: parsed.answers ? parseOnboardingAnswers(parsed.answers) : null,
    };
  } catch {
    return null;
  }
}

function writeLocalOnboarding(value: LocalOnboarding): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Private mode / quota: the guest simply sees the questionnaire again.
  }
}

export function saveLocalOnboarding(answers: OnboardingAnswers): void {
  writeLocalOnboarding({ status: 'done', answers });
}

export function markLocalOnboardingSkipped(): void {
  if (readLocalOnboarding()) return;
  writeLocalOnboarding({ status: 'skipped', answers: null });
}

export function markLocalOnboardingSynced(): void {
  writeLocalOnboarding({ status: 'synced', answers: null });
}

/** True once this device has been through the welcome flow (any outcome). */
export function hasSeenOnboarding(): boolean {
  return readLocalOnboarding() !== null;
}

/** Guest answers still waiting to be copied to a profile. */
export function pendingLocalAnswers(): OnboardingAnswers | null {
  const local = readLocalOnboarding();
  if (local?.status !== 'done' || !local.answers) return null;
  return local.answers.envies.length > 0 ? local.answers : null;
}
