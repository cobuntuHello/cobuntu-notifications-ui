/**
 * @cobuntu/notifications-ui
 *
 * Shared React components for rendering the Cobuntu notifications drawer
 * (Activity + Requests tabs). Consumed by cobuntu-community-app and
 * cobuntu-frontend so both surfaces stay visually + behaviorally
 * identical — the prior gap (mobile drawer was a stub; legacy desktop
 * was rich) drove this consolidation 2026-06-05.
 *
 * Consumer wires:
 *   - <NotificationsView />   the drawer body (tabs + list + grouping)
 *   - Adapter callbacks for navigation (router-agnostic)
 *   - DataSource for notifications + markAsRead + refresh (data-layer-agnostic)
 *
 * The CONTAINER (drawer animation, backdrop, drag-to-close) lives in
 * each consumer — the package only owns the contents.
 */
export type {
  Notification,
  NotificationActor,
  NotificationCommunity,
  NotificationStatus,
  NotificationType,
  NotificationsAdapter,
  NotificationsDataSource,
} from "./types";

// ─── Utilities (PR 2) ─────────────────────────────────────────────
export { getTimeSection } from "./utils/getTimeSection";
export { formatTimeAgo } from "./utils/formatTimeAgo";
export { cleanMentionMarkup } from "./utils/cleanMentionMarkup";
export {
  groupNotifications,
  formatActorNames,
  type DisplayItem,
  type NotificationGroup,
} from "./utils/groupNotifications";

// Components land in PRs 3-4.
