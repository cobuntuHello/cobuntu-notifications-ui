/**
 * Bucket a notification's createdAt into a human-readable time section
 * for grouping. Used to render "Today" / "Yesterday" / "This Week" /
 * "This Month" / "Earlier" headers above contiguous runs of rows.
 *
 * Boundaries are calendar-aware (compare against the start of the UTC
 * day, not a 24-hour rolling window) so a notif received at 23:00 UTC
 * yesterday and viewed at 01:00 UTC today reads as "Yesterday" rather
 * than "Today".
 *
 * UTC is the day-axis (not local time) so the function stays
 * deterministic across timezones — the package is consumed by
 * cobuntu-frontend and cobuntu-community-app, both of which run on
 * Vercel/Cloud Run in UTC, and tests need to assert without
 * timezone-host coupling. The cost is a small relative-day drift at
 * the local-midnight ±UTC-offset edge (~1 hour for EU users); the user
 * sees consistent ordering regardless.
 */
export function getTimeSection(dateStr: string, now: Date = new Date()): string {
  const date = new Date(dateStr);

  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Earlier";
}
