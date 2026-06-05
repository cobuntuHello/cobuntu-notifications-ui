import type { Notification, NotificationType } from "../types";

/**
 * Notification types that should be grouped when multiple notifications
 * target the same post. e.g. "Becky, Ana and 3 others reacted to your post"
 */
const GROUPABLE_TYPES: NotificationType[] = [
  "POST_REACTED",
  "POST_COMMENTED",
  "POST_COMMENT_REPLY",
  "POST_COMMENT_LIKED",
];

export interface NotificationGroup {
  isGroup: true;
  id: string;
  groupType: NotificationType;
  notifications: Notification[];
  actors: { name: string; usertag?: string; isVerified?: boolean }[];
  postId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export type DisplayItem = (Notification & { isGroup?: false }) | NotificationGroup;

function getGroupKey(n: Notification): string | null {
  if (!GROUPABLE_TYPES.includes(n.type)) return null;
  const postId = (n.payload as any)?.postId;
  if (!postId) return null;
  return `${n.type}_${postId}`;
}

/**
 * Resolve the actor display fields for a single notification. Different
 * notification types stash the actor under different keys (the BE never
 * normalized these), so the dispatcher reads the type-specific keys
 * then falls back to "Someone" if all of them are null — the prior
 * mobile-drawer "Someone everywhere" symptom came from rendering with
 * no per-type dispatch at all.
 */
function extractActor(n: Notification): { name: string; usertag?: string; isVerified?: boolean } {
  const p = (n.payload || {}) as any;
  switch (n.type) {
    case "POST_REACTED":
      return {
        name: p.reactorName || p.likerName || "Someone",
        usertag: p.reactorUsertag || p.likerUsertag,
        isVerified: p.reactorIsVerified || p.likerIsVerified,
      };
    case "POST_COMMENTED":
      return { name: p.commenterName || "Someone", usertag: p.commenterUsertag, isVerified: p.commenterIsVerified };
    case "POST_COMMENT_REPLY":
      return { name: p.replierName || "Someone", usertag: p.replierUsertag, isVerified: p.replierIsVerified };
    case "POST_COMMENT_LIKED":
      return { name: p.likerName || "Someone", usertag: p.likerUsertag, isVerified: p.likerIsVerified };
    default:
      return { name: "Someone" };
  }
}

/**
 * Groups notifications by type + postId. The group appears at the
 * position of the most recent notification (input must already be
 * sorted most-recent-first by the caller — the BE's
 * `/api/users/me/notifications` returns rows ordered by createdAt desc,
 * so consumers can pass the BE response through unchanged).
 *
 * Singleton groups (only one notification with that key) collapse back
 * to a bare Notification — the row dispatcher renders them the same as
 * an ungrouped row.
 */
export function groupNotifications(notifications: Notification[]): DisplayItem[] {
  const groupMap = new Map<string, Notification[]>();
  const result: DisplayItem[] = [];
  const groupIndex = new Map<string, number>();

  for (const n of notifications) {
    const key = getGroupKey(n);
    if (key) {
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groupIndex.set(key, result.length);
        result.push(null as any); // placeholder, replaced below
      }
      groupMap.get(key)!.push(n);
    } else {
      result.push(n);
    }
  }

  for (const [key, group] of groupMap) {
    const idx = groupIndex.get(key)!;

    if (group.length === 1) {
      result[idx] = group[0];
      continue;
    }

    const latest = group[0]; // input is sorted most-recent-first

    // Deduplicate actors by name — the same person reacting to a post
    // twice (rare but possible across edit cycles) shouldn't show up
    // twice in the grouped display.
    const seen = new Set<string>();
    const actors: { name: string; usertag?: string; isVerified?: boolean }[] = [];
    for (const n of group) {
      const actor = extractActor(n);
      if (!seen.has(actor.name)) {
        seen.add(actor.name);
        actors.push(actor);
      }
    }

    result[idx] = {
      isGroup: true,
      id: `group_${key}`,
      groupType: latest.type as NotificationType,
      notifications: group,
      actors,
      postId: (latest.payload as any).postId,
      createdAt: latest.createdAt,
      payload: latest.payload as Record<string, unknown>,
    };
  }

  return result;
}

/**
 * Format actor names for display:
 *   1     → "Becky"
 *   2     → "Becky and Ana"
 *   3     → "Becky, Ana and Carl"
 *   4+    → "Becky, Ana and 2 others"
 */
export function formatActorNames(actors: { name: string }[], maxNames = 2): string {
  if (actors.length === 0) return "Someone";
  if (actors.length === 1) return actors[0].name;
  if (actors.length === 2) return `${actors[0].name} and ${actors[1].name}`;
  if (actors.length <= maxNames + 1) {
    const leading = actors.slice(0, -1).map((a) => a.name).join(", ");
    return `${leading} and ${actors[actors.length - 1].name}`;
  }
  const leading = actors.slice(0, maxNames).map((a) => a.name).join(", ");
  const remaining = actors.length - maxNames;
  return `${leading} and ${remaining} other${remaining > 1 ? "s" : ""}`;
}
