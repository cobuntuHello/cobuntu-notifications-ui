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
import { formatGroupSummary, type NotificationGroup } from "../utils/groupNotifications";

interface NotificationRowProps {
  item: Notification | NotificationGroup;
  adapter: NotificationsAdapter;
  renderAvatar?: (props: { name: string; imageUrl: string | null; size: number }) => React.ReactNode;
  /** Test-injection hook for deterministic relative-time formatting. */
  now?: Date;
  /**
   * Optional "mute this thread" affordance. When provided AND the row is
   * a post-group (carries a postId), a small bell-off icon-button renders
   * that calls this with the postId (network is the consumer's concern —
   * the package only fires the callback). Absent ⇒ no button (backward
   * compatible; existing consumers keep today's behavior untouched).
   */
  onMuteThread?: (postId: string) => void;
  /**
   * Translated message templates, keyed by notification type. Optional: with
   * none, the rows read exactly as they do today. See NotificationLabels.
   */
  labels?: NotificationLabels;
}

/** Unread if the record's status says so, else fall back to readAt absence. */
function isRecordUnread(n: Notification): boolean {
  if (n.status) return n.status === "UNREAD";
  return !n.readAt;
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
export function NotificationRow({ item, adapter, renderAvatar, now, onMuteThread, labels }: NotificationRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const isGroup = "isGroup" in item && item.isGroup === true;
  const group = isGroup ? (item as NotificationGroup) : null;
  const n = group ? group.notifications[0] : (item as Notification);
  const payload = (n.payload || {}) as Record<string, unknown>;
  const groupActors = group ? group.actors : null;

  // Unread from the record's status (group = unread if ANY child is).
  const isUnread = group ? group.notifications.some(isRecordUnread) : isRecordUnread(n);

  // A MIXED group (reactions + comments + …) summarizes by kind counts;
  // a single-kind group keeps the existing "<names> reacted …" phrasing.
  const kindCounts = group?.kindCounts ?? [];
  const isMixedGroup = kindCounts.length > 1;

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
    // An app-supplied destination wins over the platform routing below: the
    // row has no post, profile, or community to fall back to, and the app is
    // the only thing that knows where its notification points.
    if (n.type === "APP_NOTIFICATION") {
      const target = safeNotificationUrl(payload.url);
      if (!target) return;
      if (adapter.onUrlClick) {
        adapter.onUrlClick(target);
      } else if (typeof window !== "undefined") {
        window.location.assign(target);
      }
      return;
    }
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
  // Mixed groups get a count summary ("12 reactions and 3 comments on
  // your post"); everything else goes through the per-type builder.
  const built: BuiltMessage = isMixedGroup
    ? {
        messageNode: (
          <>
            <span className="font-medium">{formatGroupSummary(kindCounts)}</span>
            <span style={{ opacity: 0.6 }}> on your post</span>
          </>
        ),
        isClickable: true,
      }
    : buildMessage({
        type: n.type,
        actor,
        actorImage: actor.imageUrl,
        community,
        payload,
        groupActors,
        labels,
      });
  const { messageNode, snippet, overlay, overlayTone, iconOnly, isClickable } = built;

  // ─── Friend-request rows get inline accept/reject actions ───────
  const isFriendRequestInbound = n.type === "FRIEND_REQUEST_INBOUND";

  // ─── Mute affordance (UI + callback only, no network) ───────────
  const showMute = !!group && !!postId && !!onMuteThread;
  const muteButton = showMute ? (
    <button
      type="button"
      aria-label="Mute this thread"
      onClick={(e) => {
        e.stopPropagation();
        onMuteThread!(postId!);
      }}
      className="shrink-0 rounded-full p-1 cursor-pointer"
      style={{ color: "var(--text-color, currentColor)", opacity: 0.4, background: "transparent" }}
    >
      <BellOffIcon />
    </button>
  ) : null;

  const trailing = muteButton || isUnread ? (
    <div className="flex items-center gap-2 shrink-0">
      {muteButton}
      {isUnread && (
        <span
          role="img"
          aria-label="Unread"
          className="rounded-full shrink-0"
          style={{ width: 8, height: 8, background: "rgba(128,128,128,0.9)" }}
        />
      )}
    </div>
  ) : null;

  // ─── Expandable sub-rows ("Show all") ───────────────────────────
  const canExpand = !!group && group.notifications.length > 1;

  return (
    <div>
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
        isUnread={isUnread}
        trailing={trailing}
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
      {canExpand && (
        <div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="text-xs font-medium py-1 cursor-pointer"
            style={{
              paddingLeft: "3.25rem",
              paddingRight: "1rem",
              color: "var(--text-color, currentColor)",
              opacity: 0.6,
              background: "transparent",
            }}
          >
            {expanded ? "Hide" : `Show all ${group!.notifications.length}`}
          </button>
          {expanded && (
            <div
              className="mt-1"
              style={{ marginLeft: "1.25rem", borderLeft: "2px solid rgba(128,128,128,0.15)" }}
            >
              {group!.notifications.map((sub) => (
                <NotificationRow
                  key={sub.id}
                  item={sub}
                  adapter={adapter}
                  renderAvatar={renderAvatar}
                  now={now}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
  trailing,
  isUnread,
}: {
  onClick?: () => void;
  leadingIcon: ReactNode;
  message: ReactNode;
  snippet?: string;
  createdAt: string;
  now?: Date;
  footer?: ReactNode;
  trailing?: ReactNode;
  isUnread?: boolean;
}) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={`block px-4 py-2.5 transition-colors ${interactive ? "cursor-pointer" : ""}`}
      // Unread treatment is NEUTRAL (no brand color): a subtle grey fill
      // + bolder text + a grey dot, so it also reads on mobile.
      style={{ background: isUnread ? "rgba(128,128,128,0.06)" : "transparent" }}
    >
      <div className="flex items-center gap-3">
        {leadingIcon}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug line-clamp-2 ${isUnread ? "font-semibold" : ""}`}>{message}</p>
          {snippet && (
            <p className="text-xs mt-0.5 line-clamp-1" style={{ opacity: 0.55 }}>
              &ldquo;{snippet}&rdquo;
            </p>
          )}
          <p className="text-xs mt-0.5" style={{ opacity: 0.45 }}>
            {formatTimeAgo(createdAt, now)}
          </p>
        </div>
        {trailing}
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
  labels?: NotificationLabels;
}

/**
 * Message templates for the bell rows, keyed by notification type.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * Every row in this file was hardcoded English. The community app ships in 24
 * locales and its notification SETTINGS screen is fully translated, so a
 * Portuguese member could read "A new lesson in a course you bought" in
 * settings and then open the bell and be told "was added to" in English. The
 * package was the one place in that loop with no way in for copy.
 *
 * A template is a sentence with {named} slots:
 *
 *   SALE_COMPLETED: "{buyer} bought {product}"
 *
 * Literal text renders muted, a slot renders emphasised, and a slot whose
 * value is already a node (an actor name followed by a verified badge) renders
 * as-is. That is the whole contract -- no ICU, no plurals -- because every
 * string here is one short sentence with substitutions and anything richer
 * belongs in the host app, not in a shared row renderer.
 *
 * Entirely optional. A consumer that passes nothing gets exactly the English
 * it gets today, and a map missing a key falls back to that key's English, so
 * a locale can be translated a row at a time rather than all at once.
 *
 * Keys carry a variant suffix where one sentence has two shapes -- a sale with
 * a known amount and one without are different sentences, not one sentence
 * with an empty slot, and translators need both.
 *
 * ── Still English, and known to be ──────────────────────────────────────────
 *
 * Two aggregate surfaces are NOT covered here, deliberately rather than by
 * oversight:
 *
 *   - `formatGroupSummary` in utils/groupNotifications ("3 reactions and 2
 *     comments on your post"), whose nouns live in a one/many table.
 *   - `renderActorNames` in NotificationAvatarBadge (the " and " joiner, the
 *     "N others" tail, and the "Someone" fallback).
 *
 * Both need real plural rules, and a one/many split is already wrong for any
 * language with more than two forms. Wiring them through this template system
 * would hardcode the English plural model into two more places and make the
 * eventual correct fix harder. They want Intl.PluralRules and a list
 * formatter, which is its own change.
 */
export type NotificationLabels = Record<string, string>;

/**
 * Render one template.
 *
 * Splits on the {slot} tokens and keeps the literal chunks muted, which is
 * what preserves the existing look: before this, each case hand-assembled the
 * same muted/bold alternation inline.
 */
function renderTemplate(
  template: string,
  values: Record<string, ReactNode>,
  muted: (text: string) => ReactNode,
  bold: (text: string) => ReactNode,
): ReactNode {
  const parts = template.split(/(\{[A-Za-z0-9_]+\})/g).filter((part) => part !== "");
  return (
    <>
      {parts.map((part, i) => {
        const slot = part.match(/^\{([A-Za-z0-9_]+)\}$/);
        if (!slot) return <React.Fragment key={i}>{muted(part)}</React.Fragment>;
        const value = values[slot[1]];
        return (
          <React.Fragment key={i}>
            {typeof value === "string" ? bold(value) : (value ?? null)}
          </React.Fragment>
        );
      })}
    </>
  );
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
  labels,
}: BuildMessageInput): BuiltMessage {
  const muted = (text: string) => <span style={{ opacity: 0.6 }}>{text}</span>;
  const bold = (text: string) => <span className="font-medium">{text}</span>;

  /** A row's sentence: the host's template if it has one, else this file's. */
  const line = (key: string, fallback: string, values: Record<string, ReactNode> = {}) =>
    renderTemplate(labels?.[key] ?? fallback, values, muted, bold);

  /** The actor's name plus their verified badge, as one substitutable slot. */
  const actorSlot = (
    <>
      {bold(actor.name)}
      {actor.isVerified ? <VerifiedBadge /> : null}
    </>
  );

  switch (type) {
    case "FRIEND_REQUEST_INBOUND":
      return {
        messageNode: line("FRIEND_REQUEST_INBOUND", "{actor} sent you a friend request", {
          actor: actorSlot,
        }),
        isClickable: true,
      };

    case "FRIEND_REQUEST_ACCEPTED":
      return {
        messageNode: line("FRIEND_REQUEST_ACCEPTED", "{actor} accepted your friend request", {
          actor: actorSlot,
        }),
        isClickable: true,
      };

    case "FRIENDSHIP_CONFIRMED":
      return {
        messageNode: line("FRIENDSHIP_CONFIRMED", "You and {actor} are now friends", {
          actor: actorSlot,
        }),
        isClickable: true,
      };

    case "MEMBERSHIP_CONFIRMED":
      return {
        messageNode: community.name
          ? line("MEMBERSHIP_CONFIRMED", "You joined {community}", { community: community.name })
          : line("MEMBERSHIP_CONFIRMED_noCommunity", "Your membership was confirmed"),
        overlay: <Glyph type="check" />,
        overlayTone: "green",
        isClickable: true,
      };

    case "MEMBERSHIP_REQUEST":
      return {
        messageNode: community.name
          ? line("MEMBERSHIP_REQUEST", "{actor} requested to join {community}", {
              actor: actorSlot,
              community: community.name,
            })
          : line("MEMBERSHIP_REQUEST_noCommunity", "{actor} requested to join", {
              actor: actorSlot,
            }),
        overlay: <Glyph type="people" />,
        overlayTone: "blue",
        isClickable: true,
      };

    case "MEMBERSHIP_KICKED_USER":
      return {
        messageNode: line("MEMBERSHIP_KICKED_USER", "You were removed from {community}", {
          community: community.name || "the community",
        }),
        iconOnly: <SolidIcon type="shield" tone="red" />,
        isClickable: !!community.communityTag,
      };

    case "POST_REACTED":
      return {
        messageNode: line("POST_REACTED", "{actor} reacted to your post", {
          actor: groupActors ? renderActorNames(groupActors) : actorSlot,
        }),
        snippet: maybe(payload.postSnippet),
        overlay: <Glyph type="heart" />,
        overlayTone: "red",
        isClickable: true,
      };

    case "POST_COMMENTED":
      return {
        messageNode: line("POST_COMMENTED", "{actor} commented on your post", {
          actor: groupActors ? renderActorNames(groupActors) : actorSlot,
        }),
        snippet: maybe(payload.commentSnippet),
        isClickable: true,
      };

    case "POST_COMMENT_REPLY":
      return {
        messageNode: line("POST_COMMENT_REPLY", "{actor} replied to your comment", {
          actor: groupActors ? renderActorNames(groupActors) : actorSlot,
        }),
        snippet: maybe(payload.replySnippet),
        isClickable: true,
      };

    case "POST_COMMENT_LIKED":
      return {
        messageNode: line("POST_COMMENT_LIKED", "{actor} liked your comment", {
          actor: groupActors ? renderActorNames(groupActors) : actorSlot,
        }),
        snippet: maybe(payload.commentSnippet),
        overlay: <Glyph type="heart" />,
        overlayTone: "red",
        isClickable: true,
      };

    case "POST_MENTIONED":
      return {
        messageNode: line("POST_MENTIONED", "{actor} mentioned you in a post", {
          actor: actorSlot,
        }),
        snippet: maybe(payload.postText),
        isClickable: true,
      };

    case "FEED_MENTIONED":
      return {
        messageNode: line("FEED_MENTIONED", "{actor} mentioned you", { actor: actorSlot }),
        snippet: maybe(payload.text),
        isClickable: true,
      };

    case "POST_STAR_ACHIEVED": {
      const lvl = (payload.starLevel as number | undefined) ?? 1;
      return {
        messageNode: line(
          lvl === 1 ? "POST_STAR_ACHIEVED_one" : "POST_STAR_ACHIEVED_other",
          lvl === 1 ? "Your post reached {count} star!" : "Your post reached {count} stars!",
          { count: String(lvl) },
        ),
        iconOnly: <SolidIcon type="star" tone="yellow" />,
        isClickable: true,
      };
    }

    case "POST_REMOVED_FROM_COMMUNITY":
      return {
        messageNode: line("POST_REMOVED_FROM_COMMUNITY", "Your post was removed from {community}", {
          community: community.name || "the community",
        }),
        iconOnly: <SolidIcon type="shield" tone="red" />,
        isClickable: false,
      };

    // Listings (marketplace + events)
    case "LISTING_REQUESTED": {
      const requesterName = (payload.requesterName as string) || actor.name;
      const itemName = (payload.itemName as string) || "an item";
      return {
        messageNode: line("LISTING_REQUESTED", "{requester} requested to list {item}", {
          requester: requesterName,
          item: itemName,
        }),
        iconOnly: <SolidIcon type="package" tone="blue" />,
        isClickable: true,
      };
    }

    /* ── Commerce (notifications v2, PR3) ────────────────────────────────
     *
     * The bell's first money rows. Until these, a seller making a sale got an
     * email and nothing here, because there was no NotificationType to write.
     *
     * Every amount in these payloads arrives ALREADY FORMATTED by the sender
     * (`fmt()` / `formatPriceFromSmallestUnit`), currency symbol included.
     * This package must not reformat or do arithmetic on them: money on the
     * platform is stored in the smallest unit, and a row that divided by 100 a
     * second time would quietly show a hundredth of the real figure. Print
     * what you are given, and fall back to naming the thing rather than
     * printing a wrong number.
     *
     * `iconOnly` rather than an avatar: the actor is the platform, not a
     * person. The buyer's name belongs in the sentence, not in the tile.
     */

    /* ── Courses (notifications v2, PR6) ─────────────────────────────────
     *
     * The courses module emitted nothing before this, so a learner on a drip
     * course found out a lesson existed by opening it and looking.
     */

    case "COURSE_LESSON_PUBLISHED": {
      const productName = (payload.productName as string) || "a course you bought";
      const lessonTitle = (payload.lessonTitle as string) || "A new lesson";
      return {
        messageNode: line("COURSE_LESSON_PUBLISHED", "{lesson} was added to {course}", {
          lesson: lessonTitle,
          course: productName,
        }),
        /* Lesson first, course second: a learner on several courses is
           scanning for whether THIS is something they want to open now, and
           the lesson title is what answers that. */
        iconOnly: <SolidIcon type="package" tone="blue" />,
        isClickable: false,
      };
    }

    case "COURSE_COMPLETED": {
      const productName = (payload.productName as string) || "your course";
      return {
        messageNode: line("COURSE_COMPLETED", "You finished {course}", { course: productName }),
        /* No exclamation mark and no "congratulations". The row is a record
           of something they did, and the house copy rules keep celebration
           out of a notification list that also carries refunds and failed
           payouts. */
        iconOnly: <SolidIcon type="check" tone="green" />,
        isClickable: false,
      };
    }

    /* ── Reviews and downloads (notifications v2, PR5) ───────────────────
     *
     * Both seller-facing. Both are rows the seller could not previously have
     * seen at all: reviews notified nobody, and a buyer locked out of a file
     * they had paid for was invisible to the only person who could help.
     */

    case "REVIEW_RECEIVED": {
      const productName = (payload.productName as string) || "your product";
      const reviewerName = (payload.reviewerName as string) || "Someone";
      const rating = typeof payload.rating === "number" ? payload.rating : null;
      const snippet = (payload.snippet as string) || undefined;
      return {
        /* The star count is the first thing a seller wants, and it is the
           difference between a row worth opening now and one that can wait.
           Rendered as "4/5" rather than glyphs: a row of stars at this size
           reads as decoration, and the number does not depend on colour to be
           legible. Its own template, because where a rating sits in the
           sentence is a language's business. */
        messageNode:
          rating !== null
            ? line("REVIEW_RECEIVED_rated", "{reviewer} reviewed {product}, {rating}/5", {
                reviewer: reviewerName,
                product: productName,
                rating: String(rating),
              })
            : line("REVIEW_RECEIVED", "{reviewer} reviewed {product}", {
                reviewer: reviewerName,
                product: productName,
              }),
        snippet,
        iconOnly: <SolidIcon type="star" tone="yellow" />,
        isClickable: false,
      };
    }

    case "DOWNLOAD_LIMIT_REACHED": {
      const productName = (payload.productName as string) || "your product";
      const fileName = (payload.fileName as string) || "a file";
      const buyerName = (payload.buyerName as string) || "A buyer";
      return {
        messageNode: line(
          "DOWNLOAD_LIMIT_REACHED",
          "{buyer} used up their downloads of {file} on {product}",
          { buyer: buyerName, file: fileName, product: productName },
        ),
        /* Says what to DO, because the row exists for the seller's decision
           and the platform has already told the buyer to ask them. */
        snippet: labels?.DOWNLOAD_LIMIT_REACHED_snippet
          ?? "They cannot download it again until you raise the limit.",
        iconOnly: <SolidIcon type="ban" tone="yellow" />,
        isClickable: false,
      };
    }

    case "SALE_COMPLETED": {
      const productName = (payload.productName as string) || "your product";
      const buyerName = (payload.buyerName as string) || "Someone";
      const saleAmount = payload.saleAmount as string | undefined;
      return {
        messageNode: saleAmount
          ? line("SALE_COMPLETED_withAmount", "{buyer} bought {product} for {amount}", {
              buyer: buyerName,
              product: productName,
              amount: saleAmount,
            })
          : line("SALE_COMPLETED", "{buyer} bought {product}", {
              buyer: buyerName,
              product: productName,
            }),
        iconOnly: <SolidIcon type="coin" tone="green" />,
        isClickable: false,
      };
    }

    case "PURCHASE_COMPLETED": {
      const productName = (payload.productName as string) || "your purchase";
      return {
        messageNode: community.name
          ? line("PURCHASE_COMPLETED_inCommunity", "You bought {product} in {community}", {
              product: productName,
              community: community.name,
            })
          : line("PURCHASE_COMPLETED", "You bought {product}", { product: productName }),
        iconOnly: <SolidIcon type="package" tone="green" />,
        isClickable: false,
      };
    }

    case "REFUND_COMPLETED": {
      const productName = (payload.productName as string) || "your purchase";
      const refundAmount = payload.refundAmount as string | undefined;
      return {
        /* "has been issued", not "is in your account": the money has left us,
           but when it lands is the card issuer's business, and promising
           arrival here is how support tickets are made. */
        messageNode: refundAmount
          ? line("REFUND_COMPLETED_withAmount", "Your refund for {product} has been issued, {amount}", {
              product: productName,
              amount: refundAmount,
            })
          : line("REFUND_COMPLETED", "Your refund for {product} has been issued", {
              product: productName,
            }),
        iconOnly: <SolidIcon type="arrow-left" tone="blue" />,
        isClickable: false,
      };
    }

    case "SALE_REFUNDED": {
      const productName = (payload.productName as string) || "a sale";
      const buyerName = (payload.buyerName as string) || "A buyer";
      const refundAmount = payload.refundAmount as string | undefined;
      return {
        messageNode: refundAmount
          ? line("SALE_REFUNDED_withAmount", "{buyer} was refunded for {product}, {amount}", {
              buyer: buyerName,
              product: productName,
              amount: refundAmount,
            })
          : line("SALE_REFUNDED", "{buyer} was refunded for {product}", {
              buyer: buyerName,
              product: productName,
            }),
        iconOnly: <SolidIcon type="arrow-left" tone="yellow" />,
        isClickable: false,
      };
    }

    case "PAYOUT_CONFIRMED": {
      const payoutAmount = payload.payoutAmount as string | undefined;
      return {
        messageNode: line("PAYOUT_CONFIRMED", "Your payout of {amount} is on its way to your bank", {
          amount: payoutAmount || "your earnings",
        }),
        iconOnly: <SolidIcon type="coin" tone="green" />,
        isClickable: false,
      };
    }

    case "PAYOUT_FAILED": {
      const payoutAmount = payload.payoutAmount as string | undefined;
      const reason = payload.failureReason as string | undefined;
      return {
        messageNode: payoutAmount
          ? line(
              "PAYOUT_FAILED_withAmount",
              "Your payout of {amount} could not be sent. {action}",
              { amount: payoutAmount, action: labels?.PAYOUT_FAILED_action ?? "Check your payment details" },
            )
          : line("PAYOUT_FAILED", "Your payout could not be sent. {action}", {
              action: labels?.PAYOUT_FAILED_action ?? "Check your payment details",
            }),
        /* The reason is the actionable part and is often the only thing that
           tells a seller what to change, so it goes in the snippet rather than
           being dropped. */
        snippet: reason,
        iconOnly: <SolidIcon type="x" tone="red" />,
        isClickable: false,
      };
    }

    case "LISTING_APPROVED": {
      const itemName = (payload.itemName as string) || "your listing";
      const itemType = (payload.itemType as string) || "listing";
      return {
        messageNode: community.name
          ? line("LISTING_APPROVED_inCommunity", "Your {itemType} {item} was approved in {community}", {
              itemType,
              item: itemName,
              community: community.name,
            })
          : line("LISTING_APPROVED", "Your {itemType} {item} was approved", {
              itemType,
              item: itemName,
            }),
        iconOnly: <SolidIcon type="check" tone="green" />,
        isClickable: false,
      };
    }

    case "LISTING_REJECTED": {
      const itemName = (payload.itemName as string) || "your listing";
      const itemType = (payload.itemType as string) || "listing";
      return {
        messageNode: community.name
          ? line("LISTING_REJECTED_inCommunity", "Your {itemType} {item} was declined in {community}", {
              itemType,
              item: itemName,
              community: community.name,
            })
          : line("LISTING_REJECTED", "Your {itemType} {item} was declined", {
              itemType,
              item: itemName,
            }),
        iconOnly: <SolidIcon type="x" tone="red" />,
        isClickable: false,
      };
    }

    case "LISTING_DEACTIVATED": {
      const itemName = (payload.itemName as string) || "your listing";
      const itemType = (payload.itemType as string) || "listing";
      return {
        messageNode: community.name
          ? line("LISTING_DEACTIVATED_inCommunity", "Your {itemType} {item} was deactivated in {community}", {
              itemType,
              item: itemName,
              community: community.name,
            })
          : line("LISTING_DEACTIVATED", "Your {itemType} {item} was deactivated", {
              itemType,
              item: itemName,
            }),
        iconOnly: <SolidIcon type="ban" tone="yellow" />,
        isClickable: false,
      };
    }

    case "LISTING_WITHDRAWN": {
      const ownerName = (payload.ownerName as string) || actor.name;
      const itemName = (payload.itemName as string) || "a listing";
      return {
        messageNode: line("LISTING_WITHDRAWN", "{owner} withdrew {item}", {
          owner: ownerName,
          item: itemName,
        }),
        iconOnly: <SolidIcon type="arrow-left" tone="yellow" />,
        isClickable: false,
      };
    }

    case "LISTING_PROPOSAL":
      return {
        messageNode: line("LISTING_PROPOSAL", "New commission proposal for {item}", {
          item: (payload.itemName as string) || "your listing",
        }),
        iconOnly: <SolidIcon type="coin" tone="blue" />,
        isClickable: false,
      };

    case "LISTING_PROPOSAL_ACCEPTED":
      return {
        messageNode: line("LISTING_PROPOSAL_ACCEPTED", "Commission agreed for {item}", {
          item: (payload.itemName as string) || "your listing",
        }),
        iconOnly: <SolidIcon type="check" tone="green" />,
        isClickable: false,
      };

    case "LISTING_PROPOSAL_REJECTED":
      return {
        messageNode: line("LISTING_PROPOSAL_REJECTED", "Commission proposal declined for {item}", {
          item: (payload.itemName as string) || "your listing",
        }),
        iconOnly: <SolidIcon type="x" tone="red" />,
        isClickable: false,
      };

    case "APP_NOTIFICATION": {
      // The only type whose copy the platform did not author. An installed app
      // supplies title + body, so there is nothing to look up and nothing to
      // phrase — the row's job is to render the app's words and say who sent
      // them, so a member is never left guessing what is talking to them.
      const title = (payload.title as string) || "";
      const appName = (payload.appName as string) || "";
      const bodyText = maybe(payload.body);
      return {
        messageNode: appName
          ? line("APP_NOTIFICATION_withApp", "{title} \u00b7 {app}", { title, app: appName })
          : line("APP_NOTIFICATION", "{title}", { title }),
        snippet: bodyText,
        // A box, not a checkmark: this is "an app is telling you something",
        // not "something completed".
        iconOnly: <SolidIcon type="package" tone="blue" />,
        // Only clickable when the app actually gave us somewhere to go, and
        // only when that somewhere survives validation.
        isClickable: safeNotificationUrl(payload.url) !== null,
      };
    }

    default:
      // Unknown type — render a generic activity row rather than dropping
      // the record silently. Mirrors the legacy renderer's fall-through.
      return {
        messageNode:
          actor.name !== "Someone"
            ? line("UNKNOWN_withActor", "New activity from {actor}", { actor: actor.name })
            : line("UNKNOWN", "New activity"),
        isClickable: false,
      };
  }
}

/**
 * Return a notification payload's link only if it is safe to navigate to.
 *
 * `APP_NOTIFICATION` payloads carry a destination chosen by a third party, and
 * this row turns it into a click. A `javascript:` or `data:` URL here would be
 * script execution inside the community's own UI, wearing its branding.
 *
 * The write endpoint (POST /api/v1/communities/:tag/notifications) already
 * rejects those, so this is the second of two gates rather than the only one.
 * It exists because notification payloads are free-form JSON in the database:
 * this package cannot verify that a given row was written by that endpoint, and
 * a renderer that trusts its input is one bad writer away from being an XSS
 * sink. Accepts https, http, and single-slash site-relative paths; `//host` is
 * refused because it reads like a path and navigates off-origin.
 */
export function safeNotificationUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url) return null;

  if (url.startsWith("/")) {
    return url.startsWith("//") ? null : url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
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

function toActorViews(
  actors: { name: string; usertag?: string; isVerified?: boolean; imageUrl?: string | null }[],
): NotificationActorView[] {
  return actors.map((a) => ({
    name: a.name,
    usertag: a.usertag ?? null,
    imageUrl: a.imageUrl ?? null,
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
}: {
  type: "shield" | "star" | "package" | "ban" | "arrow-left" | "coin" | "x" | "check";
  // `tone` is still accepted from call sites for readability but is no
  // longer used for color — system icons are NEUTRAL (muted grey), not
  // brand/semantic-tinted, per the PR-2 redesign.
  tone?: "red" | "green" | "yellow" | "blue";
}) {
  const path = (() => {
    switch (type) {
      case "shield":
        return <path d="M12 2L4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3z" />;
      case "star":
        return <path d="M12 2l3 6.5L22 10l-5.5 4.5L18 22l-6-3.5L6 22l1.5-7.5L2 10l7-1.5z" />;
      case "package":
        return <path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "ban":
        return <><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 5l14 14" stroke="currentColor" strokeWidth="2" /></>;
      case "arrow-left":
        return <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "coin":
        return <><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" /></>;
      case "x":
        return <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "check":
        return <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    }
  })();

  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "rgba(128,128,128,0.10)" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ color: "var(--text-color, currentColor)", opacity: 0.6 }}
      >
        {path}
      </svg>
    </div>
  );
}

/** Inline bell-off glyph for the mute affordance (no lucide runtime dep). */
function BellOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.9 17.9 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <path d="M1 1l22 22" />
    </svg>
  );
}
