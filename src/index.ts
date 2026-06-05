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

// Public components + utils land here in PRs 2-4. Re-exports are
// scaffolded as the work lands so consumers can pin to a working SHA
// at every checkpoint.
