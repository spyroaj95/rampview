/**
 * Cookieless visit analytics via GoatCounter (script tag in index.html;
 * dashboard at https://rampview.goatcounter.com).
 *
 * The pageload is counted automatically by count.js. This helper adds a few
 * high-signal EVENTS so the dashboard shows engagement, not just opens:
 * view switches and walkthrough starts. It no-ops safely when the script is
 * absent (localhost, ad blockers, script blocked): analytics must never
 * affect the app.
 */

interface GoatCounter {
  count: (opts: { path: string; title?: string; event?: boolean }) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

export function track(path: string, title?: string): void {
  try {
    window.goatcounter?.count({ path, title, event: true })
  } catch {
    /* never let analytics break the app */
  }
}
