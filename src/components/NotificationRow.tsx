import React, { ReactNode } from "react";
import type { Notification, NotificationsAdapter } from "../types";
import { Avatar } from "./Avatar";
import {
  NotificationAvatarBadge,
  renderActorNames,
  type NotificationActorView,
} from "./NotificationAvatarBadge";
import { VerifiedBadge } from "./VerifiedBadge";
import { formatTimeAgo } from "../utils/formatTimeAgo";
import { cleanMentionMarkup } from "../utils/cleanMentionMarkup";
import type { NotificationGroup } from "../utils/groupNotifications";

interface NotificationRowProps {
  item: Notification | NotificationGroup;
  adapter: NotificationsAdapter;
  renderAvatar?: (props: { name: string; imageUrl: string | null; size: number }) => React.ReactNode;
  /** Test-injection hook for deterministic relative-time formatting. */
  now?: Date;
}

/**
 * Type-aware notification row. Replaces the cobuntu-community-app
 * pre-package pattern that flattened every type to a single `message`
 * string — this dispatcher keeps the BE payload structured, bolds
 * actor + community names, attaches type-specific icon overlays, and
 * wires per-type click destinations through the adapter callbacks.
 *
 * Keep the type coverage in sync with services/core/prisma/schema.prisma
 * `NotificationType` enum + packages/widgets vanilla-JS formatter.
 */
export function NotificationRow({ item, adapter, renderAvatar, now }: NotificationRowProps) {
  const isGroup = "isGroup" in item && item.isGroup === true;
  const n = isGroup ? (item as NotificationGroup).notifications[0] : (item as Notification);
  const payload = (n.payload || {}) as Record<string, unknown>;
  const groupActors = isGroup ? (item as NotificationGroup).actors : null;

  // ─── Actor resolution ───────────────────────────────────────────
  // Each notification type stores actor fields under different keys.
  // The legacy panel + the widget bundle resolve via the same per-type
  // dispatch, so this branch is the canonical source of truth.

  // Some consumers' API layer flattens a `n.actor` projection onto the
  // row for FE convenience. When type-specific payload keys aren't
  // populated we fall back to it before settling on "Someone".
  const rowActor = (n as any).actor as
    | { name?: string | null; usertag?: string | null; profileImage?: string | null; avatarUrl?: string | null; isVerified?: boolean | null }
    | null
    | undefined;
  const fallbackName = rowActor?.name || (payload.actorName as string | undefined) || "Someone";
  const fallbackUsertag = rowActor?.usertag || (payload.actorUsertag as string | undefined) || null;
  const fallbackImage = rowActor?.profileImage || rowActor?.avatarUrl
    || (payload.actorImage as string | undefined)
    || (payload.actorImageUrl as string | undefined)
    || null;
  const fallbackVerified = rowActor?.isVerified ?? null;

  const actor: NotificationActorView = (() => {
    switch (n.type) {
      case "FRIEND_REQUEST_INBOUND": {
        const u = payload.fromUser as Record<string, unknown> | undefined;
        return {
          name: (u?.name as string) || (u?.usertag as string) || fallbackName,
          usertag: (u?.usertag as string) || fallbackUsertag,
          imageUrl: (u?.avatarUrl as string) || (u?.profileImage as string) || fallbackImage,
          isVerified: (u?.isVerified as boolean) ?? fallbackVerified,
        };
      }
      case "FRIEND_REQUEST_ACCEPTED":
      case "FRIENDSHIP_CONFIRMED": {
        const u = payload.byUser as Record<string, unknown> | undefined;
        return {
          name: (u?.name as string) || (u?.usertag as string) || fallbackName,
          usertag: (u?.usertag as string) || fallbackUsertag,
          imageUrl: (u?.avatarUrl as string) || (u?.profileImage as string) || fallbackImage,
          isVerified: (u?.isVerified as boolean) ?? fallbackVerified,
        };
      }
      case "MEMBERSHIP_REQUEST":
      case "MEMBERSHIP_CONFIRMED": {
        const u = (payload.byUser as Record<string, unknown> | undefined)
          || (payload.applicant as Record<string, unknown> | undefined);
        return {
          name: (u?.name as string) || fallbackName,
          usertag: (u?.usertag as string) || fallbackUsertag,
          imageUrl: (u?.avatarUrl as string) || (u?.profileImage as string) || fallbackImage,
          isVerified: (u?.isVerified as boolean) ?? fallbackVerified,
        };
      }
      case "POST_REACTED":
        return {
          name: (payload.reactorName as string) || (payload.likerName as string) || fallbackName,
          usertag: (payload.reactorUsertag as string) || (payload.likerUsertag as string) || fallbackUsertag,
          imageUrl: (payload.reactorAvatarUrl as string) || (payload.likerAvatarUrl as string) || fallbackImage,
          isVerified: (payload.reactorIsVerified as boolean) || (payload.likerIsVerified as boolean) || fallbackVerified,
        };
      case "POST_COMMENTED":
        return {
          name: (payload.commenterName as string) || fallbackName,
          usertag: (payload.commenterUsertag as string) || fallbackUsertag,
          imageUrl: (payload.commenterAvatarUrl as string) || fallbackImage,
          isVerified: (payload.commenterIsVerified as boolean) ?? fallbackVerified,
        };
      case "POST_COMMENT_REPLY":
        return {
          name: (payload.replierName as string) || fallbackName,
          usertag: (payload.replierUsertag as string) || fallbackUsertag,
          imageUrl: (payload.replierAvatarUrl as string) || fallbackImage,
          isVerified: (payload.replierIsVerified as boolean) ?? fallbackVerified,
        };
      case "POST_COMMENT_LIKED":
        return {
          name: (payload.likerName as string) || fallbackName,
          usertag: (payload.likerUsertag as string) || fallbackUsertag,
          imageUrl: (payload.likerAvatarUrl as string) || fallbackImage,
          isVerified: (payload.likerIsVerified as boolean) ?? fallbackVerified,
        };
      case "POST_MENTIONED":
      case "FEED_MENTIONED": {
        const author = payload.author as Record<string, unknown> | undefined;
        return {
          name: (author?.name as string) || fallbackName,
          usertag: (author?.usertag as string) || fallbackUsertag,
          imageUrl: (author?.avatarUrl as string) || (author?.profileImage as string) || fallbackImage,
          isVerified: (author?.isVerified as boolean) ?? fallbackVerified,
        };
      }
      default:
        return {
          name: fallbackName,
          usertag: fallbackUsertag,
          imageUrl: fallbackImage,
          isVerified: fallbackVerified,
        };
    }
  })();

  // ─── Community resolution ───────────────────────────────────────
  const community: { name?: string | null; communityTag?: string | null; iconUrl?: string | null } = (() => {
    const c = payload.community as Record<string, unknown> | undefined;
    const from = payload.fromCommunity as Record<string, unknown> | undefined;
    const src = from || c;
    return {
      name: (src?.name as string) || (payload.communityName as string) || null,
      communityTag: (src?.communityTag as string) || (payload.communityTag as string) || null,
      iconUrl: (src?.iconUrl as string) || null,
    };
  })();

  // ─── Routing target ─────────────────────────────────────────────
  const postId = (payload.postId as string) || (payload.messageId as string) || null;
  const handleClick = () => {
    if (postId && community.communityTag && adapter.onPostClick) {
      adapter.onPostClick(community.communityTag, postId);
      return;
    }
    if (postId && adapter.onPostClick) {
      adapter.onPostClick(undefined, postId);
      return;
    }
    if (actor.usertag && adapter.onProfileClick && shouldRouteToProfile(n.type)) {
      adapter.onProfileClick(actor.usertag);
      return;
    }
    if (community.communityTag && adapter.onCommunityClick) {
      adapter.onCommunityClick(community.communityTag);
      return;
    }
  };

  // ─── Build the message JSX ──────────────────────────────────────
  const { messageNode, snippet, overlay, overlayTone, iconOnly, isClickable } = buildMessage({
    type: n.type,
    actor,
    actorImage: actor.imageUrl,
    community,
    payload,
    groupActors,
  });

  // ─── Friend-request rows get inline accept/reject actions ───────
  const isFriendRequestInbound = n.type === "FRIEND_REQUEST_INBOUND";

  return (
    <Row
      onClick={isClickable ? handleClick : undefined}
      leadingIcon={
        iconOnly ?? (
          <NotificationAvatarBadge
            actors={groupActors ? toActorViews(groupActors) : [actor]}
            overlay={overlay}
            overlayClassName={overlayTone ? overlayToneClass(overlayTone) : ""}
            renderAvatar={renderAvatar}
          />
        )
      }
      message={messageNode}
      snippet={snippet}
      createdAt={n.createdAt}
      now={now}
      footer={
        isFriendRequestInbound ? (
          <FriendRequestActions
            notification={n}
            onAccept={adapter.onAcceptFriendRequest}
            onReject={adapter.onRejectFriendRequest}
          />
        ) : null
      }
    />
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function Row({
  onClick,
  leadingIcon,
  message,
  snippet,
  createdAt,
  now,
  footer,
}: {
  onClick?: () => void;
  leadingIcon: ReactNode;
  message: ReactNode;
  snippet?: string;
  createdAt: string;
  now?: Date;
  footer?: ReactNode;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={`block px-4 py-2.5 transition-colors ${interactive ? "cursor-pointer" : ""}`}
      style={{ background: "transparent" }}
    >
      <div className="flex items-center gap-3">
        {leadingIcon}
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug line-clamp-2">{message}</p>
          {snippet && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ opacity: 0.55 }}>
              &ldquo;{snippet}&rdquo;
            </p>
          )}
          <p className="text-xs mt-0.5" style={{ opacity: 0.45 }}>
            {formatTimeAgo(createdAt, now)}
          </p>
        </div>
      </div>
      {footer}
    </div>
  );
}

function FriendRequestActions({
  notification,
  onAccept,
  onReject,
}: {
  notification: Notification;
  onAccept?: (n: Notification) => Promise<void>;
  onReject?: (n: Notification) => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const wrap = async (fn?: (n: Notification) => Promise<void>) => {
    if (!fn || pending) return;
    setPending(true);
    try {
      await fn(notification);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="flex items-center gap-2 mt-3 mb-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={pending}
        onClick={() => wrap(onAccept)}
        className="h-7 px-3 text-xs font-semibold rounded-md disabled:opacity-50 cursor-pointer"
        style={{
          background: "var(--brand-color, #1d9bf0)",
          color: "var(--primary-btn-text, #fff)",
        }}
      >
        Accept
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => wrap(onReject)}
        className="h-7 px-3 text-xs font-semibold rounded-md disabled:opacity-50 cursor-pointer"
        style={{
          background: "rgba(128,128,128,0.12)",
          color: "var(--text-color, currentColor)",
        }}
      >
        Decline
      </button>
    </div>
  );
}

// ─── Per-type message builder ──────────────────────────────────────

interface BuildMessageInput {
  type: string;
  actor: NotificationActorView;
  actorImage: string | null | undefined;
  community: { name?: string | null; communityTag?: string | null; iconUrl?: string | null };
  payload: Record<string, unknown>;
  groupActors: NotificationActorView[] | null;
}

interface BuiltMessage {
  messageNode: ReactNode;
  snippet?: string;
  /** Optional overlay icon for the avatar (heart, etc.). */
  overlay?: ReactNode;
  overlayTone?: "red" | "green" | "yellow" | "blue";
  /** If set, the row renders this in place of the avatar tile (single icon, no actor). */
  iconOnly?: ReactNode;
  isClickable: boolean;
}

function buildMessage({
  type,
  actor,
  community,
  payload,
  groupActors,
}: BuildMessageInput): BuiltMessage {
  const muted = (text: string) => <span style={{ opacity: 0.6 }}>{text}</span>;
  const bold = (text: string) => <span className="font-medium">{text}</span>;

  switch (type) {
    case "FRIEND_REQUEST_INBOUND":
      return {
        messageNode: (
          <>
            {bold(actor.name)}
            {actor.isVerified ? <VerifiedBadge /> : null}
            {muted(" sent you a friend request")}
          </>
        ),
        isClickable: true,
      };

    case "FRIEND_REQUEST_ACCEPTED":
      return {
        messageNode: (
          <>
            {bold(actor.name)}
            {actor.isVerified ? <VerifiedBadge /> : null}
            {muted(" accepted your friend request")}
          </>
        ),
        isClickable: true,
      };

    case "FRIENDSHIP_CONFIRMED":
      return {
        messageNode: (
          <>
            {muted("You and ")}
            {bold(actor.name)}
            {actor.isVerified ? <VerifiedBadge /> : null}
            {muted(" are now friends")}
          </>
        ),
        isClickable: true,
      };

    case "MEMBERSHIP_CONFIRMED":
      return {
        messageNode: community.name
          ? (
            <>
              {muted("You joined ")}
              {bold(community.name)}
            </>
          )
          : <>{muted("Your membership was confirmed")}</>,
        overlay: <Glyph type="check" />,
        overlayTone: "green",
        isClickable: true,
      };

    case "MEMBERSHIP_REQUEST":
      return {
        messageNode: (
          <>
            {bold(actor.name)}
            {actor.isVerified ? <VerifiedBadge /> : null}
            {community.name ? (
              <>
                {muted(" requested to join ")}
                {bold(community.name)}
              </>
            ) : (
              muted(" requested to join")
            )}
          </>
        ),
        overlay: <Glyph type="people" />,
        overlayTone: "blue",
        isClickable: true,
      };

    case "MEMBERSHIP_KICKED_USER":
      return {
        messageNode: (
          <>
            {muted("You were removed from ")}
            {bold(community.name || "the community")}
          </>
        ),
        iconOnly: <SolidIcon type="shield" tone="red" />,
        isClickable: !!community.communityTag,
      };

    case "POST_REACTED":
      return {
        messageNode: (
          <>
            {groupActors ? renderActorNames(groupActors) : <>
              {bold(actor.name)}
              {actor.isVerified ? <VerifiedBadge /> : null}
            </>}
            {muted(" reacted to your post")}
          </>
        ),
        snippet: maybe(payload.postSnippet),
        overlay: <Glyph type="heart" />,
        overlayTone: "red",
        isClickable: true,
      };

    case "POST_COMMENTED":
      return {
        messageNode: (
          <>
            {groupActors ? renderActorNames(groupActors) : <>
              {bold(actor.name)}
              {actor.isVerified ? <VerifiedBadge /> : null}
            </>}
            {muted(" commented on your post")}
          </>
        ),
        snippet: maybe(payload.commentSnippet),
        isClickable: true,
      };

    case "POST_COMMENT_REPLY":
      return {
        messageNode: (
          <>
            {groupActors ? renderActorNames(groupActors) : <>
              {bold(actor.name)}
              {actor.isVerified ? <VerifiedBadge /> : null}
            </>}
            {muted(" replied to your comment")}
          </>
        ),
        snippet: maybe(payload.replySnippet),
        isClickable: true,
      };

    case "POST_COMMENT_LIKED":
      return {
        messageNode: (
          <>
            {groupActors ? renderActorNames(groupActors) : <>
              {bold(actor.name)}
              {actor.isVerified ? <VerifiedBadge /> : null}
            </>}
            {muted(" liked your comment")}
          </>
        ),
        snippet: maybe(payload.commentSnippet),
        overlay: <Glyph type="heart" />,
        overlayTone: "red",
        isClickable: true,
      };

    case "POST_MENTIONED":
      return {
        messageNode: (
          <>
            {bold(actor.name)}
            {actor.isVerified ? <VerifiedBadge /> : null}
            {muted(" mentioned you in a post")}
          </>
        ),
        snippet: maybe(payload.postText),
        isClickable: true,
      };

    case "FEED_MENTIONED":
      return {
        messageNode: (
          <>
            {bold(actor.name)}
            {actor.isVerified ? <VerifiedBadge /> : null}
            {muted(" mentioned you")}
          </>
        ),
        snippet: maybe(payload.text),
        isClickable: true,
      };

    case "POST_STAR_ACHIEVED": {
      const lvl = (payload.starLevel as number | undefined) ?? 1;
      return {
        messageNode: (
          <>
            {muted("Your post reached ")}
            {bold(`${lvl} star${lvl === 1 ? "" : "s"}`)}
          </>
        ),
        iconOnly: <SolidIcon type="star" tone="yellow" />,
        isClickable: true,
      };
    }

    case "POST_REMOVED_FROM_COMMUNITY":
      return {
        messageNode: (
          <>
            {muted("Your post was removed from ")}
            {bold(community.name || "the community")}
          </>
        ),
        iconOnly: <SolidIcon type="shield" tone="red" />,
        isClickable: false,
      };

    // Listings (marketplace + events)
    case "LISTING_REQUESTED": {
      const requesterName = (payload.requesterName as string) || actor.name;
      const itemName = (payload.itemName as string) || "an item";
      return {
        messageNode: (
          <>
            {bold(requesterName)}
            {muted(" requested to list ")}
            {bold(itemName)}
          </>
        ),
        iconOnly: <SolidIcon type="package" tone="blue" />,
        isClickable: true,
      };
    }

    case "LISTING_APPROVED": {
      const itemName = (payload.itemName as string) || "your listing";
      const itemType = (payload.itemType as string) || "listing";
      return {
        messageNode: (
          <>
            {muted(`Your ${itemType} `)}
            {bold(itemName)}
            {muted(community.name ? ` was approved in ${community.name}` : " was approved")}
          </>
        ),
        iconOnly: <SolidIcon type="check" tone="green" />,
        isClickable: false,
      };
    }

    case "LISTING_REJECTED": {
      const itemName = (payload.itemName as string) || "your listing";
      const itemType = (payload.itemType as string) || "listing";
      return {
        messageNode: (
          <>
            {muted(`Your ${itemType} `)}
            {bold(itemName)}
            {muted(community.name ? ` was declined in ${community.name}` : " was declined")}
          </>
        ),
        iconOnly: <SolidIcon type="x" tone="red" />,
        isClickable: false,
      };
    }

    case "LISTING_DEACTIVATED": {
      const itemName = (payload.itemName as string) || "your listing";
      const itemType = (payload.itemType as string) || "listing";
      return {
        messageNode: (
          <>
            {muted(`Your ${itemType} `)}
            {bold(itemName)}
            {muted(community.name ? ` was deactivated in ${community.name}` : " was deactivated")}
          </>
        ),
        iconOnly: <SolidIcon type="ban" tone="yellow" />,
        isClickable: false,
      };
    }

    case "LISTING_WITHDRAWN": {
      const ownerName = (payload.ownerName as string) || actor.name;
      const itemName = (payload.itemName as string) || "a listing";
      return {
        messageNode: (
          <>
            {bold(ownerName)}
            {muted(" withdrew ")}
            {bold(itemName)}
          </>
        ),
        iconOnly: <SolidIcon type="arrow-left" tone="yellow" />,
        isClickable: false,
      };
    }

    case "LISTING_PROPOSAL":
      return {
        messageNode: (
          <>
            {muted("New commission proposal for ")}
            {bold((payload.itemName as string) || "your listing")}
          </>
        ),
        iconOnly: <SolidIcon type="coin" tone="blue" />,
        isClickable: false,
      };

    case "LISTING_PROPOSAL_ACCEPTED":
      return {
        messageNode: (
          <>
            {muted("Commission agreed for ")}
            {bold((payload.itemName as string) || "your listing")}
          </>
        ),
        iconOnly: <SolidIcon type="check" tone="green" />,
        isClickable: false,
      };

    case "LISTING_PROPOSAL_REJECTED":
      return {
        messageNode: (
          <>
            {muted("Commission proposal declined for ")}
            {bold((payload.itemName as string) || "your listing")}
          </>
        ),
        iconOnly: <SolidIcon type="x" tone="red" />,
        isClickable: false,
      };

    default:
      // Unknown type — render a generic activity row rather than dropping
      // the record silently. Mirrors the legacy renderer's fall-through.
      return {
        messageNode: (
          <>
            {muted("New activity")}
            {actor.name !== "Someone" ? <> {muted("from ")}{bold(actor.name)}</> : null}
          </>
        ),
        isClickable: false,
      };
  }
}

function shouldRouteToProfile(type: string): boolean {
  return (
    type === "FRIEND_REQUEST_INBOUND"
    || type === "FRIEND_REQUEST_ACCEPTED"
    || type === "FRIENDSHIP_CONFIRMED"
    || type === "MEMBERSHIP_REQUEST"
  );
}

function toActorViews(actors: { name: string; usertag?: string; isVerified?: boolean }[]): NotificationActorView[] {
  return actors.map((a) => ({
    name: a.name,
    usertag: a.usertag ?? null,
    imageUrl: null,
    isVerified: a.isVerified ?? null,
  }));
}

function maybe(v: unknown): string | undefined {
  if (typeof v !== "string" || !v) return undefined;
  return cleanMentionMarkup(v);
}

function overlayToneClass(tone: "red" | "green" | "yellow" | "blue"): string {
  switch (tone) {
    case "red": return "bg-red-500";
    case "green": return "bg-green-500";
    case "yellow": return "bg-yellow-500";
    case "blue": return "bg-blue-500";
  }
}

// ─── Inline glyph primitives ───────────────────────────────────────
// Tiny SVG icons so the package has no lucide-react runtime dep at
// the row level — keeps the bundle slim. Consumers can swap via the
// slot pattern in future PRs if needed.

function Glyph({ type }: { type: "heart" | "check" | "people" }) {
  const props = { width: 10, height: 10, viewBox: "0 0 24 24", fill: "currentColor" } as const;
  if (type === "heart") {
    return (
      <svg {...props} style={{ color: "white" }}>
        <path d="M12 21s-7-4.35-9.5-9.5C1 8 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4 4.5 7.5C19 16.65 12 21 12 21z" />
      </svg>
    );
  }
  if (type === "check") {
    return (
      <svg {...props} style={{ color: "white" }}>
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...props} style={{ color: "white" }}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function SolidIcon({
  type,
  tone,
}: {
  type: "shield" | "star" | "package" | "ban" | "arrow-left" | "coin" | "x" | "check";
  tone: "red" | "green" | "yellow" | "blue";
}) {
  const toneToBg: Record<typeof tone, string> = {
    red: "rgba(239,68,68,0.15)",
    green: "rgba(34,197,94,0.15)",
    yellow: "rgba(234,179,8,0.15)",
    blue: "rgba(59,130,246,0.15)",
  };
  const toneToFg: Record<typeof tone, string> = {
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#eab308",
    blue: "#3b82f6",
  };
  const path = (() => {
    switch (type) {
      case "shield":
        return <path d="M12 2L4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3z" />;
      case "star":
        return <path d="M12 2l3 6.5L22 10l-5.5 4.5L18 22l-6-3.5L6 22l1.5-7.5L2 10l7-1.5z" />;
      case "package":
        return <path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "ban":
        return <><circle cx="12" cy="12" r="10" /><path d="M5 5l14 14" stroke="white" strokeWidth="2" /></>;
      case "arrow-left":
        return <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "coin":
        return <><circle cx="12" cy="12" r="10" /><path d="M8 12h8M12 8v8" stroke="white" strokeWidth="2" /></>;
      case "x":
        return <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "check":
        return <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }
  })();

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: toneToBg[tone], color: toneToFg[tone] }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        {path}
      </svg>
    </div>
  );
}
