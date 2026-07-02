/**
 * C1 privacy gate for pipeline/CRM views on DEPLOYED builds.
 *
 * This is a client-side deterrent, not encryption: it keeps deal/contact intel
 * out of casual reach on a shared link. Real protection is structural, since
 * pipeline.json is gitignored and public builds ship only dummy sample data.
 *
 * Default passphrase: "rampview". Change it by replacing PASS_HASH with
 * sha256(yourPassphrase): node -e "console.log(require('crypto').createHash('sha256').update('yourPassphrase').digest('hex'))"
 */
const PASS_HASH = 'db1a4ed7ffcd4b067b37788f336a933b5ccce93b8ee7b7b144b45d66d9d6fd05'
const KEY = 'rv_unlocked'

/** Dev builds skip the gate; the sample data carries nothing sensitive anyway. */
export function gateRequired(): boolean {
  return import.meta.env.PROD && sessionStorage.getItem(KEY) !== '1'
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function tryUnlock(passphrase: string): Promise<boolean> {
  try {
    const hex = await sha256Hex(passphrase.trim())
    if (hex === PASS_HASH) {
      sessionStorage.setItem(KEY, '1')
      return true
    }
    return false
  } catch {
    // crypto.subtle unavailable (non-secure context): fail closed.
    return false
  }
}
