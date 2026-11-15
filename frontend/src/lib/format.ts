/** "12 min ago", "3 hours ago", "Yesterday", ... from a minutes offset. */
export function formatRelative(minutesAgo: number): string {
  if (minutesAgo < 1) return 'Just now'
  if (minutesAgo < 60) return `${Math.round(minutesAgo)} min ago`
  const hours = Math.round(minutesAgo / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.round(days / 7)
  return weeks === 1 ? 'Last week' : `${weeks} weeks ago`
}

/** Megabytes to a short human string: 86 -> "86 MB", 2048 -> "2 GB". */
export function formatSize(mb: number): string {
  if (mb >= 1024) return `${+(mb / 1024).toFixed(1)} GB`
  if (mb >= 1) return `${Math.round(mb)} MB`
  return `${Math.max(1, Math.round(mb * 1024))} KB`
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
