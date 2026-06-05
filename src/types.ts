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
