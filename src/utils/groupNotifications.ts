import type { Notification, NotificationType } from "../types";

/**
 * Post-activity notification types. Ambient activity on the SAME post
 * (reactions, comments, replies, comment-likes) that carry the same
 * `payload.postId` collapse into ONE group per post — e.g.
 * "12 reactions and 3 comments on your post".
 *
 * (Before PR-2 only same-TYPE reactions folded together — the group key
 * was `type + postId`. Now the fold is per-post ACROSS kinds, so the key
 * is post-only and the row summarizes the mix by kind.)
 *
 * POST_MENTIONED is DELIBERATELY excluded: a mention of the user is a
 * direct, personal signal (someone @-tagged you), not ambient reactions —
 * so it NEVER collapses into a post's grouped row and always renders as
 * its own standalone notification, even when reactions/comments exist on
 * the same post.
 */
const POST_ACTIVITY_TYPES: NotificationType[] = [
  "POST_REACTED",
  "POST_COMMENTED",
  "POST_COMMENT_REPLY",
  "POST_COMMENT_LIKED",
];

/** Coarse buckets used for the grouped-row summary line. */
export type PostActivityKind = "reaction" | "comment" | "mention";

const TYPE_TO_KIND: Record<string, PostActivityKind> = {
  POST_REACTED: "reaction",
  POST_COMMENT_LIKED: "reaction",
  POST_COMMENTED: "comment",
  POST_COMMENT_REPLY: "comment",
  POST_MENTIONED: "mention",
};

/** Display order + singular/plural nouns for each bucket. */
const KIND_ORDER: PostActivityKind[] = ["reaction", "comment", "mention"];
const KIND_NOUN: Record<PostActivityKind, { one: string; many: string }> = {
  reaction: { one: "reaction", many: "reactions" },
  comment: { one: "comment", many: "comments" },
  mention: { one: "mention", many: "mentions" },
};

export interface GroupActor {
  name: string;
  usertag?: string;
  isVerified?: boolean;
  /** Added PR-2 so grouped stacked avatars can show real images, not just initials. */
  imageUrl?: string | null;
}

export interface KindCount {
  kind: PostActivityKind;
  count: number;
}

export interface NotificationGroup {
  isGroup: true;
  id: string;
  groupType: NotificationType;
  notifications: Notification[];
  actors: GroupActor[];
  /**
   * Per-kind event counts (reactions / comments / mentions) in display
   * order, only kinds with count > 0. `length > 1` ⇒ MIXED group ⇒ the
   * row renders the "N reactions and M comments on your post" summary
   * instead of the single-kind "<names> reacted to your post" phrasing.
   */
  kindCounts: KindCount[];
  postId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

export type DisplayItem = (Notification & { isGroup?: false }) | NotificationGroup;

function getGroupKey(n: Notification): string | null {
  if (!POST_ACTIVITY_TYPES.includes(n.type)) return null;
  const postId = (n.payload as any)?.postId;
  if (!postId) return null;
  // Post-only key (NOT type + post) so reactions, comments, replies,
  // comment-likes and mentions on the same post fold into ONE group.
  return `post_${postId}`;
}

/**
 * Resolve the actor display fields for a single notification. Different
 * notification types stash the actor under different keys (the BE never
 * normalized these), so the dispatcher reads the type-specific keys
 * then falls back to "Someone" if all of them are null — the prior
 * mobile-drawer "Someone everywhere" symptom came from rendering with
 * no per-type dispatch at all. Mirrors NotificationRow's per-type actor
 * resolution so grouped avatars match the ungrouped rows.
 */
function extractActor(n: Notification): GroupActor {
  const p = (n.payload || {}) as any;
  switch (n.type) {
    case "POST_REACTED":
      return {
        name: p.reactorName || p.likerName || "Someone",
        usertag: p.reactorUsertag || p.likerUsertag,
        isVerified: p.reactorIsVerified || p.likerIsVerified,
        imageUrl: p.reactorAvatarUrl || p.likerAvatarUrl || null,
      };
    case "POST_COMMENTED":
      return {
        name: p.commenterName || "Someone",
        usertag: p.commenterUsertag,
        isVerified: p.commenterIsVerified,
        imageUrl: p.commenterAvatarUrl || null,
      };
    case "POST_COMMENT_REPLY":
      return {
        name: p.replierName || "Someone",
        usertag: p.replierUsertag,
        isVerified: p.replierIsVerified,
        imageUrl: p.replierAvatarUrl || null,
      };
    case "POST_COMMENT_LIKED":
      return {
        name: p.likerName || "Someone",
        usertag: p.likerUsertag,
        isVerified: p.likerIsVerified,
        imageUrl: p.likerAvatarUrl || null,
      };
    case "POST_MENTIONED": {
      const a = (p.author || {}) as any;
      return {
        name: a.name || "Someone",
        usertag: a.usertag,
        isVerified: a.isVerified,
        imageUrl: a.avatarUrl || a.profileImage || null,
      };
    }
    default:
      return { name: "Someone" };
  }
}

/**
 * Groups post-activity notifications by postId. The group appears at the
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

    // Deduplicate actors by name — the same person acting on a post
    // more than once (e.g. reacting then commenting) shouldn't show up
    // twice in the stacked avatars.
    const seen = new Set<string>();
    const actors: GroupActor[] = [];
    for (const n of group) {
      const actor = extractActor(n);
      if (!seen.has(actor.name)) {
        seen.add(actor.name);
        actors.push(actor);
      }
    }

    // Tally EVENTS (not actors) per coarse kind for the summary line.
    const tally = new Map<PostActivityKind, number>();
    for (const n of group) {
      const kind = TYPE_TO_KIND[n.type];
      if (!kind) continue;
      tally.set(kind, (tally.get(kind) || 0) + 1);
    }
    const kindCounts: KindCount[] = KIND_ORDER
      .filter((k) => (tally.get(k) || 0) > 0)
      .map((k) => ({ kind: k, count: tally.get(k)! }));

    result[idx] = {
      isGroup: true,
      id: `group_${key}`,
      groupType: latest.type as NotificationType,
      notifications: group,
      actors,
      kindCounts,
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

/**
 * Human summary line for a MIXED post group, e.g.
 *   [{reaction,12},{comment,3}]           → "12 reactions and 3 comments"
 *   [{reaction,1},{comment,2},{mention,1}] → "1 reaction, 2 comments and 1 mention"
 *
 * Single-kind groups keep the "<names> reacted to your post" phrasing
 * and don't use this. Nouns pluralize on the individual count.
 */
export function formatGroupSummary(kindCounts: KindCount[]): string {
  const parts = kindCounts.map(({ kind, count }) => {
    const noun = count === 1 ? KIND_NOUN[kind].one : KIND_NOUN[kind].many;
    return `${count} ${noun}`;
  });
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
