/** Small presentation helpers. Kept pure so they're trivial to test. */

/** 104700000 -> "104.7M", 1300000 -> "1.3M", 8500 -> "8.5K". */
export function compactNumber(n?: number): string {
  if (n == null || Number.isNaN(n)) return 'n/a'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

/** 104700000 -> "104,700,000". */
export function fullNumber(n?: number): string {
  if (n == null || Number.isNaN(n)) return 'n/a'
  return n.toLocaleString('en-US')
}

/** 1800000 -> "$1.8M". */
export function money(n?: number): string {
  if (n == null || Number.isNaN(n)) return 'n/a'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

/** Turn a snake_case enum into "Title Case". */
export function humanize(s?: string): string {
  if (!s) return 'n/a'
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** ISO date -> "Jun 2026". */
export function shortDate(iso?: string): string {
  if (!iso) return 'n/a'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

/** ISO date -> "Jun 24". */
export function dayDate(iso?: string): string {
  if (!iso) return 'n/a'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Is an ISO due date in the past (strictly before today)? */
export function isOverdue(due: string | undefined, today: string): boolean {
  return !!due && due < today
}
