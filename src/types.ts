/**
 * Shape of one notification row as returned by the cobuntu-notifications
 * service (`GET /api/users/me/notifications`). Mirrors the prisma
 * `notifications` table plus the runtime enrichment InAppService
 * performs (verified flags, message-media thumbnails). Consumer-side
 * renderers read structured fields directly — no pre-flattened
 * `message` string.
 */
export interface NotificationActor {
  id?: string | null;
  name?: string | null;
  usertag?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
  isVerified?: boolean | null;
}

export interface NotificationCommunity {
  id?: string | null;
  name?: string | null;
  communityTag?: string | null;
  iconUrl?: string | null;
}

export type NotificationStatus = "UNREAD" | "READ";

/**
 * Every notification type the BE may fan-in. Kept open-ended (string)
 * so a new type added on the BE doesn't fail the renderer at the type
 * boundary; the row dispatcher renders a no-op for unknown types.
 */
export type NotificationType = string;

export interface Notification {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  /**
   * Free-form jsonb from the BE. Rendering branches read the fields
   * they care about per type — `payload.fromUser`, `payload.byUser`,
   * `payload.community`, `payload.reactorName`, `payload.commenterName`,
   * `payload.postSnippet`, `payload.postMediaUrl`, etc.
   */
  payload: Record<string, unknown> | null;
  /**
   * Optional row-root actor projection. Some consumers' API layer flatten
   * the actor onto the row for FE convenience; the row dispatcher falls
   * back to this when type-specific payload keys (e.g. `reactorName`)
   * aren't populated. Strictly optional — the BE may not emit it.
   */
  actor?: { id?: string | null; name?: string | null; profileImage?: string | null; avatarUrl?: string | null; usertag?: string | null; isVerified?: boolean | null } | null;
  createdAt: string;
  readAt?: string | null;
  userId?: string | null;
  communityId?: string | null;
}

/**
 * Adapter callbacks the consumer wires for navigation. Keeps the
 * package router-agnostic so it can be used by react-router (legacy
 * cobuntu-frontend) and next/router (cobuntu-community-app) without
 * branching inside the package.
 */
export interface NotificationsAdapter {
  onProfileClick?: (usertag: string) => void;
  onPostClick?: (communityTag: string | undefined, postId: string) => void;
  onCommunityClick?: (communityTag: string) => void;
  onMembersListClick?: (communityTag: string) => void;
  /**
   * Navigate to an arbitrary link carried by a notification's payload —
   * currently only APP_NOTIFICATION, where an installed app supplies its own
   * destination rather than pointing at a platform entity.
   *
   * Optional: when a consumer does not wire it, the row falls back to a plain
   * `window.location` assignment, which is correct for a site-relative path and
   * for an off-site link alike. Wire it in a Next.js consumer to keep an
   * in-app link a client-side transition.
   *
   * The URL is re-validated before either path runs — see `safeNotificationUrl`.
   * The backend already rejects anything that is not http/https/site-relative,
   * but payloads are free-form JSON in the DB and this package cannot assume
   * every row came through that endpoint.
   */
  onUrlClick?: (url: string) => void;
  onClose?: () => void;
  onAcceptFriendRequest?: (notification: Notification) => Promise<void>;
  onRejectFriendRequest?: (notification: Notification) => Promise<void>;
  onRemoveFriend?: (notification: Notification) => Promise<void>;
}

/**
 * Data + actions the consumer provides via its own data layer (SWR /
 * react-query / fetch in useEffect — package stays agnostic).
 */
export interface NotificationsDataSource {
  notifications: Notification[];
  isLoading: boolean;
  markAsRead: () => void | Promise<void>;
  refresh: () => void | Promise<void>;
}
