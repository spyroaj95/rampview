/** Small presentation helpers. Kept pure so they're trivial to test. */

/** 104700000 -> "104.7M", 1300000 -> "1.3M", 8500 -> "8.5K". */
export function compactNumber(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

/** 104700000 -> "104,700,000". */
export function fullNumber(n?: number): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US')
}

/** Turn a snake_case enum into "Title Case". */
export function humanize(s?: string): string {
  if (!s) return '—'
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** ISO date -> "Jun 2026". Returns em-dash-free placeholder when missing. */
export function shortDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}
