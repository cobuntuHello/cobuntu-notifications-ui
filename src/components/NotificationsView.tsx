"use client";

import React, { useMemo } from "react";
import type { Notification, NotificationsAdapter, NotificationsDataSource } from "../types";
import { NotificationRow } from "./NotificationRow";
import { SectionHeader } from "./SectionHeader";
import { EmptyState } from "./EmptyState";
import { groupNotifications, type DisplayItem, type NotificationGroup } from "../utils/groupNotifications";
import { getTimeSection } from "../utils/getTimeSection";

/**
 * Inbound friend / membership requests share the Requests tab. Activity
 * tab gets everything else.
 */
const REQUEST_TYPES = new Set<string>([
  "FRIEND_REQUEST_INBOUND",
  "MEMBERSHIP_REQUEST",
]);

interface NotificationsViewProps {
  data: NotificationsDataSource;
  adapter?: NotificationsAdapter;
  /**
   * Which tab is active. Controlled by the consumer (the drawer
   * container also owns tab state for animation reasons). When omitted,
   * defaults to "activity". Ignored when `layout === "flat"`.
   */
  activeTab?: "activity" | "requests";
  /**
   * Overall list layout.
   *   - "tabs"  (default) — the original Activity/Requests split with
   *     time-based section headers ("Today" / "Yesterday" / …). Existing
   *     behavior, unchanged.
   *   - "flat" — a single unified list with NO tabs and NO time buckets.
   *     All notifications group together, then partition into two
   *     read-status sections: "New" (anything unread; actionable requests
   *     pinned to the top) and "Earlier" (fully read). Newest-first order
   *     is preserved within each section.
   */
  layout?: "tabs" | "flat";
  /**
   * Slot to override the avatar primitive — pass the consumer's
   * UserAvatar so the drawer's avatars match feed + chat surfaces.
   */
  renderAvatar?: (props: { name: string; imageUrl: string | null; size: number }) => React.ReactNode;
  /** Test injection for deterministic relative-time + section labels. */
  now?: Date;
  /**
   * Optional "mute this thread" callback, forwarded to post-group rows.
   * When provided, grouped post rows render an unobtrusive bell-off
   * button that calls this with the postId (no network in the package).
   * Absent ⇒ no mute button (backward compatible).
   */
  onMuteThread?: (postId: string) => void;
}

/**
 * Top-level notification list. Renders:
 *   - Loading state (skeleton)
 *   - Empty state per tab
 *   - Grouped rows (multi-actor reactions on the same post collapse to
 *     "Becky and Ana reacted to your post")
 *   - Section headers ("Today" / "Yesterday" / "This Week" / "This
 *     Month" / "Earlier") above contiguous runs
 *
 * Two layouts:
 *   - "tabs"  (default) — the Activity/Requests split with time-based
 *     section headers (everything described above).
 *   - "flat" — a single unified list, no tabs and no time buckets, split
 *     into "New" (unread; actionable requests pinned to the top) and
 *     "Earlier" (fully read) sections.
 *
 * The CONTAINER (drawer animation, drag-to-close, backdrop, header,
 * tab pills) lives in the consumer — this component only owns the
 * scrollable list and the empty/loading states. Keeping that boundary
 * makes the package reusable: cobuntu-community-app's drawer wraps it
 * in framer-motion, and a future desktop hub page can mount it in a
 * static panel without any animation deps.
 */
export function NotificationsView({
  data,
  adapter = {},
  activeTab = "activity",
  layout = "tabs",
  renderAvatar,
  now,
  onMuteThread,
}: NotificationsViewProps) {
  const { notifications, isLoading } = data;

  const { activity, requests } = useMemo(() => {
    const a: Notification[] = [];
    const r: Notification[] = [];
    for (const n of notifications) {
      if (REQUEST_TYPES.has(n.type)) r.push(n);
      else a.push(n);
    }
    return { activity: a, requests: r };
  }, [notifications]);

  const displayItems: DisplayItem[] = useMemo(() => {
    if (activeTab === "requests") return requests;
    return groupNotifications(activity);
  }, [activeTab, activity, requests]);

  // Flat layout groups the FULL list (activeTab + the Activity/Requests
  // split are ignored). Requests are non-post types, so grouping leaves
  // them as individual rows.
  const flatItems: DisplayItem[] | null = useMemo(
    () => (layout === "flat" ? groupNotifications(notifications) : null),
    [layout, notifications],
  );

  // ─── Flat New/Earlier layout ────────────────────────────────────
  if (layout === "flat") {
    const items = flatItems!;
    if (isLoading && items.length === 0) {
      return <Skeleton />;
    }
    if (items.length === 0) {
      return (
        <EmptyState
          title="You're all caught up"
          description="Nothing needs you right now."
        />
      );
    }
    const { newItems, earlierItems } = partitionNewEarlier(items);
    return (
      <div>
        {renderFlatSections(newItems, earlierItems, adapter, renderAvatar, now, onMuteThread)}
      </div>
    );
  }

  if (isLoading && displayItems.length === 0) {
    return <Skeleton />;
  }

  if (displayItems.length === 0) {
    if (activeTab === "requests") {
      return (
        <EmptyState
          icon={<RequestsIcon />}
          title="No requests"
          description="Friend and membership requests will appear here."
        />
      );
    }
    return (
      <EmptyState
        title="No activity yet"
        description="When something happens, you'll see it here."
      />
    );
  }

  // Activity tab gets section headers; Requests stays a flat list (it
  // is typically short and the section breakdown adds noise).
  if (activeTab === "requests") {
    return (
      <div>
        {displayItems.map((item) => {
          const n = item as Notification;
          return (
            <NotificationRow
              key={n.id}
              item={n}
              adapter={adapter}
              renderAvatar={renderAvatar}
              now={now}
              onMuteThread={onMuteThread}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div>
      {renderWithSections(displayItems, adapter, renderAvatar, now, onMuteThread)}
    </div>
  );
}

function renderWithSections(
  items: DisplayItem[],
  adapter: NotificationsAdapter,
  renderAvatar: NotificationsViewProps["renderAvatar"],
  now: Date | undefined,
  onMuteThread: NotificationsViewProps["onMuteThread"],
) {
  let currentSection: string | null = null;
  const out: React.ReactNode[] = [];

  for (const item of items) {
    const createdAt = (item as Notification).createdAt
      ?? (item as NotificationGroup).createdAt;
    const section = getTimeSection(createdAt, now);
    if (section !== currentSection) {
      out.push(<SectionHeader key={`section-${section}`} label={section} />);
      currentSection = section;
    }
    const key = "isGroup" in item && item.isGroup
      ? (item as NotificationGroup).id
      : (item as Notification).id;
    out.push(
      <NotificationRow
        key={key}
        item={item}
        adapter={adapter}
        renderAvatar={renderAvatar}
        now={now}
        onMuteThread={onMuteThread}
      />,
    );
  }

  return out;
}

// ─── Flat New/Earlier layout helpers ──────────────────────────────

/**
 * Unread test for a display item. A GROUP is unread if ANY child record
 * is unread; a SINGLE row is unread when its own status is "UNREAD".
 * Mirrors NotificationRow's unread treatment so the section a row lands
 * in matches the dot/weight it renders with.
 */
function isDisplayItemUnread(item: DisplayItem): boolean {
  if ("isGroup" in item && item.isGroup) {
    return (item as NotificationGroup).notifications.some((n) => n.status === "UNREAD");
  }
  return (item as Notification).status === "UNREAD";
}

/** Actionable request rows (friend / membership). Groups are never requests. */
function isRequestItem(item: DisplayItem): boolean {
  if ("isGroup" in item && item.isGroup) return false;
  return REQUEST_TYPES.has((item as Notification).type);
}

/**
 * Split grouped display items into the two flat-layout sections by read
 * status, preserving the caller's newest-first order within each. Inside
 * New, the actionable request rows are pinned to the TOP (keeping their
 * relative order) so the things needing a decision surface first.
 */
function partitionNewEarlier(items: DisplayItem[]): {
  newItems: DisplayItem[];
  earlierItems: DisplayItem[];
} {
  const unread: DisplayItem[] = [];
  const read: DisplayItem[] = [];
  for (const item of items) {
    if (isDisplayItemUnread(item)) unread.push(item);
    else read.push(item);
  }
  // filter() is stable, so relative order is preserved on both sides.
  const requests = unread.filter(isRequestItem);
  const rest = unread.filter((i) => !isRequestItem(i));
  return { newItems: [...requests, ...rest], earlierItems: read };
}

function renderFlatSections(
  newItems: DisplayItem[],
  earlierItems: DisplayItem[],
  adapter: NotificationsAdapter,
  renderAvatar: NotificationsViewProps["renderAvatar"],
  now: Date | undefined,
  onMuteThread: NotificationsViewProps["onMuteThread"],
) {
  const out: React.ReactNode[] = [];

  const pushRows = (items: DisplayItem[]) => {
    for (const item of items) {
      const key = "isGroup" in item && item.isGroup
        ? (item as NotificationGroup).id
        : (item as Notification).id;
      out.push(
        <NotificationRow
          key={key}
          item={item}
          adapter={adapter}
          renderAvatar={renderAvatar}
          now={now}
          onMuteThread={onMuteThread}
        />,
      );
    }
  };

  // Only render a header for a section that actually has rows.
  if (newItems.length > 0) {
    out.push(<SectionHeader key="section-new" label="New" />);
    pushRows(newItems);
  }
  if (earlierItems.length > 0) {
    out.push(<SectionHeader key="section-earlier" label="Earlier" />);
    pushRows(earlierItems);
  }

  return out;
}

function Skeleton() {
  return (
    <div className="px-4 py-4 space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full shrink-0"
            style={{ background: "rgba(128,128,128,0.08)" }}
          />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div
              className="h-3 rounded"
              style={{ background: "rgba(128,128,128,0.08)", width: "75%" }}
            />
            <div
              className="h-3 rounded"
              style={{ background: "rgba(128,128,128,0.06)", width: "25%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RequestsIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ opacity: 0.3 }}
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
