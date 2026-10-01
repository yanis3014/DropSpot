const TROPHY_PROMPT_KEY = 'last_trophy_prompt_date';
export const TROPHY_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** True if the user has never seen the trophy prompt, or last saw it > 7 days ago. */
export function shouldShowTrophyPrompt(now = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(TROPHY_PROMPT_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last) || last <= 0) return true;
    return now - last >= TROPHY_PROMPT_COOLDOWN_MS;
  } catch {
    return true;
  }
}

/** Persist that we just showed the trophy prompt (starts the 7-day cooldown). */
export function markTrophyPromptShown(now = Date.now()): void {
  try {
    localStorage.setItem(TROPHY_PROMPT_KEY, String(now));
  } catch {
    // ignore private mode / quota
  }
}
