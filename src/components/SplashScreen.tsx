const SESSION_KEY = 'dropspot_splash_seen';

/**
 * Runs in <head> before first paint: the splash is shown once per browser
 * session, then hidden via html[data-splash="seen"].
 */
export const splashBootScript = `(function(){try{var s=sessionStorage;if(s.getItem('${SESSION_KEY}')){document.documentElement.dataset.splash='seen';}else{s.setItem('${SESSION_KEY}','1');}}catch(e){}})();`;

/**
 * Launch screen. Server component: the entrance and the exit are pure CSS
 * (see .ds-splash in globals.css), so it never waits for hydration to leave.
 */
export default function SplashScreen() {
  return (
    <div className="ds-splash" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="ds-splash-mark">
        <ellipse className="ds-splash-shadow" cx="32" cy="62" rx="9" ry="2.2" />
        <ellipse className="ds-splash-ring" cx="32" cy="61" rx="8" ry="2.4" />
        <g className="ds-splash-pin">
          <path d="M32 61C26.5 52.5 11 40.5 11 26A21 21 0 0 1 53 26C53 40.5 37.5 52.5 32 61Z" />
          <g transform="rotate(28 32 26)">
            <g className="ds-splash-bean">
              <ellipse cx="32" cy="26" rx="10.5" ry="14" />
              <path d="M32 15C28.2 21 35.8 31 32 37" />
            </g>
          </g>
        </g>
      </svg>
      <span className="ds-splash-word">dropspot</span>
      <span className="ds-splash-tagline">Ton spot. Ta vibe.</span>
    </div>
  );
}
