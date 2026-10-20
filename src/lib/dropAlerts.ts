const DROP_ALERTS_KEY = 'dropspot_drop_alerts';

export function getDropAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(DROP_ALERTS_KEY);
    if (raw === null) return true;
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export function setDropAlertsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DROP_ALERTS_KEY, enabled ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}
