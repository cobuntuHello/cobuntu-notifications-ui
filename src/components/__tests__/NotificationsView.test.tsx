import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationsView } from "../NotificationsView";
import type { Notification } from "../../types";

const now = new Date("2026-06-05T15:00:00.000Z");

function makeNotif(overrides: Partial<Notification> & { type: string; payload?: any }): Notification {
  return {
    id: overrides.id ?? `n-${Math.random()}`,
    type: overrides.type,
    status: overrides.status ?? "UNREAD",
    payload: overrides.payload ?? {},
    createdAt: overrides.createdAt ?? "2026-06-05T12:00:00.000Z",
    readAt: null,
    userId: null,
    communityId: null,
  };
}

describe("NotificationsView", () => {
  it("shows the loading skeleton when isLoading is true and there are no rows yet", () => {
    const { container } = render(
      <NotificationsView
        data={{ notifications: [], isLoading: true, markAsRead: () => {}, refresh: () => {} }}
        now={now}
      />,
    );
    // Skeleton renders 5 placeholder rows — assert there are 5 round
    // grey circles where avatars would land.
    const placeholders = container.querySelectorAll('div[class*="rounded-full"]');
    expect(placeholders.length).toBeGreaterThanOrEqual(5);
  });

  it("renders the Activity empty state when no rows are present and not loading", () => {
    render(
      <NotificationsView
        data={{ notifications: [], isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        now={now}
      />,
    );
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders the Requests empty state when activeTab=requests and no requests are present", () => {
    render(
      <NotificationsView
        data={{ notifications: [], isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="requests"
        now={now}
      />,
    );
    expect(screen.getByText("No requests")).toBeInTheDocument();
  });

  it("splits FRIEND_REQUEST_INBOUND + MEMBERSHIP_REQUEST into the Requests tab, everything else into Activity", () => {
    const items: Notification[] = [
      makeNotif({ id: "a1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana" } }),
      makeNotif({ id: "r1", type: "FRIEND_REQUEST_INBOUND", payload: { fromUser: { name: "Simon", usertag: "simon" } } }),
      makeNotif({ id: "r2", type: "MEMBERSHIP_REQUEST", payload: { byUser: { name: "Keven" }, community: { name: "Orbis" } } }),
    ];

    const activity = render(
      <NotificationsView
        data={{ notifications: items, isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="activity"
        now={now}
      />,
    );
    expect(activity.getByText(/reacted to your post/i)).toBeInTheDocument();
    expect(activity.queryByText(/sent you a friend request/i)).not.toBeInTheDocument();
    expect(activity.queryByText(/requested to join/i)).not.toBeInTheDocument();
    activity.unmount();

    const requests = render(
      <NotificationsView
        data={{ notifications: items, isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="requests"
        now={now}
      />,
    );
    expect(requests.getByText(/sent you a friend request/i)).toBeInTheDocument();
    expect(requests.getByText(/requested to join/i)).toBeInTheDocument();
    expect(requests.queryByText(/reacted to your post/i)).not.toBeInTheDocument();
  });

  it("renders section headers above contiguous runs of notifications when in Activity tab", () => {
    const items: Notification[] = [
      // Two from "Today" (relative to anchored `now`)
      makeNotif({ id: "1", type: "POST_REACTED", createdAt: "2026-06-05T14:00:00.000Z", payload: { postId: "p1", reactorName: "Ana" } }),
      makeNotif({ id: "2", type: "POST_COMMENTED", createdAt: "2026-06-05T10:00:00.000Z", payload: { postId: "p1", commenterName: "Becky" } }),
      // One from "This Month"
      makeNotif({ id: "3", type: "FRIENDSHIP_CONFIRMED", createdAt: "2026-05-22T10:00:00.000Z", payload: { byUser: { name: "Carl" } } }),
      // One from "Earlier"
      makeNotif({ id: "4", type: "MEMBERSHIP_CONFIRMED", createdAt: "2026-02-01T10:00:00.000Z", payload: { fromCommunity: { name: "Desconversados" } } }),
    ];

    render(
      <NotificationsView
        data={{ notifications: items, isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="activity"
        now={now}
      />,
    );

    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();
    expect(screen.getByText("Earlier")).toBeInTheDocument();
  });

  it("collapses two POST_REACTED on the same post into a single grouped row", () => {
    const items: Notification[] = [
      makeNotif({
        id: "2",
        type: "POST_REACTED",
        createdAt: "2026-06-05T12:00:00.000Z",
        payload: { postId: "p1", reactorName: "Ana", reactorUsertag: "ana" },
      }),
      makeNotif({
        id: "1",
        type: "POST_REACTED",
        createdAt: "2026-06-04T12:00:00.000Z",
        payload: { postId: "p1", reactorName: "Becky", reactorUsertag: "becky" },
      }),
    ];

    render(
      <NotificationsView
        data={{ notifications: items, isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="activity"
        now={now}
      />,
    );
    // Both names appear, but only ONE "reacted to your post" string —
    // the grouped row renders "Ana and Becky reacted to your post".
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Becky")).toBeInTheDocument();
    const reactedCount = screen.queryAllByText(/reacted to your post/i);
    expect(reactedCount).toHaveLength(1);
  });

  it("collapses MIXED activity on one post into a single grouped row with a combined summary", () => {
    const items: Notification[] = [
      makeNotif({ id: "2", type: "POST_COMMENTED", createdAt: "2026-06-05T12:01:00.000Z", payload: { postId: "p1", commenterName: "Becky" } }),
      makeNotif({ id: "1", type: "POST_REACTED", createdAt: "2026-06-05T12:00:00.000Z", payload: { postId: "p1", reactorName: "Ana" } }),
    ];

    render(
      <NotificationsView
        data={{ notifications: items, isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="activity"
        now={now}
      />,
    );

    // Collapsed: one combined summary, and NO per-item phrasing yet.
    expect(screen.getByText(/1 reaction and 1 comment/i)).toBeInTheDocument();
    expect(screen.queryByText(/reacted to your post/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/commented on your post/i)).not.toBeInTheDocument();

    // Expand reveals the underlying individual notifications as sub-rows.
    fireEvent.click(screen.getByText(/Show all/i));
    expect(screen.getByText(/reacted to your post/i)).toBeInTheDocument();
    expect(screen.getByText(/commented on your post/i)).toBeInTheDocument();
  });

  it("forwards onMuteThread to grouped post rows so the mute button fires with the postId", () => {
    const onMuteThread = vi.fn();
    const items: Notification[] = [
      makeNotif({ id: "2", type: "POST_REACTED", createdAt: "2026-06-05T12:01:00.000Z", payload: { postId: "p7", reactorName: "Ana" } }),
      makeNotif({ id: "1", type: "POST_REACTED", createdAt: "2026-06-05T12:00:00.000Z", payload: { postId: "p7", reactorName: "Becky" } }),
    ];

    render(
      <NotificationsView
        data={{ notifications: items, isLoading: false, markAsRead: () => {}, refresh: () => {} }}
        activeTab="activity"
        now={now}
        onMuteThread={onMuteThread}
      />,
    );

    fireEvent.click(screen.getByLabelText("Mute this thread"));
    expect(onMuteThread).toHaveBeenCalledWith("p7");
  });
});
