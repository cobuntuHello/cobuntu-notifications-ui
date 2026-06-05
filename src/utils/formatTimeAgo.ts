/**
 * Format a date as a relative-time string ("3 min ago", "2 weeks ago").
 *
 * Simpler than the legacy frontend's `formatTimeAgo` (which accepted
 * Firestore timestamps) — the BE notifications API always returns
 * ISO date strings, so the input type is narrowed accordingly.
 *
 * The buckets match the legacy renderer 1:1 so notifications read
 * identically across the two consumer surfaces post-migration.
 */
export function formatTimeAgo(dateStr: string, now: Date = new Date()): string {
  const ms = new Date(dateStr).getTime();
  if (Number.isNaN(ms)) return "";

  const diff = now.getTime() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;

  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;

  const months = Math.max(1, Math.floor(days / 30));
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}
