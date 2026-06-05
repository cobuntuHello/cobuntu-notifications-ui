import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationRow } from "../NotificationRow";
import type { Notification } from "../../types";

function makeNotif(overrides: Partial<Notification> & { type: string; payload?: any }): Notification {
  return {
    id: overrides.id ?? "n1",
    type: overrides.type,
    status: overrides.status ?? "UNREAD",
    payload: overrides.payload ?? {},
    createdAt: overrides.createdAt ?? "2026-06-05T12:00:00.000Z",
    readAt: null,
    userId: null,
    communityId: null,
  };
}

const now = new Date("2026-06-05T15:00:00.000Z");

describe("NotificationRow", () => {
  it("renders FRIEND_REQUEST_INBOUND with the actor's real name (not 'Someone')", () => {
    const item = makeNotif({
      type: "FRIEND_REQUEST_INBOUND",
      payload: { fromUser: { name: "Simon Dürnberger", usertag: "simon" } },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Simon Dürnberger")).toBeInTheDocument();
    expect(screen.getByText(/sent you a friend request/i)).toBeInTheDocument();
    expect(screen.queryByText("Someone")).not.toBeInTheDocument();
  });

  it("renders MEMBERSHIP_REQUEST with both the actor AND the community name (the pre-package mobile drawer dropped one of the two)", () => {
    const item = makeNotif({
      type: "MEMBERSHIP_REQUEST",
      payload: { byUser: { name: "Keven Andrade", usertag: "keven" }, community: { name: "Orbis", communityTag: "orbis" } },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Keven Andrade")).toBeInTheDocument();
    expect(screen.getByText("Orbis")).toBeInTheDocument();
    expect(screen.getByText(/requested to join/i)).toBeInTheDocument();
  });

  it("renders MEMBERSHIP_CONFIRMED with 'You joined <Community>' when fromCommunity is present", () => {
    const item = makeNotif({
      type: "MEMBERSHIP_CONFIRMED",
      payload: { fromCommunity: { name: "Desconversados", communityTag: "desconversados" } },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText(/You joined/i)).toBeInTheDocument();
    expect(screen.getByText("Desconversados")).toBeInTheDocument();
  });

  it("renders POST_REMOVED_FROM_COMMUNITY with a red shield icon-only tile (no actor avatar)", () => {
    const item = makeNotif({
      type: "POST_REMOVED_FROM_COMMUNITY",
      payload: { community: { name: "Desconversados" } },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText(/Your post was removed from/i)).toBeInTheDocument();
    expect(screen.getByText("Desconversados")).toBeInTheDocument();
    // Shield path lives in the SolidIcon SVG — assert by absence of any image avatar.
    expect(container.querySelector("img")).toBeNull();
  });

  it("calls adapter.onPostClick when a clickable POST_REACTED row is activated", () => {
    const onPostClick = vi.fn();
    const item = makeNotif({
      type: "POST_REACTED",
      payload: {
        postId: "p123",
        community: { communityTag: "orbis" },
        reactorName: "Ana",
        reactorUsertag: "ana",
      },
    });
    render(<NotificationRow item={item} adapter={{ onPostClick }} now={now} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPostClick).toHaveBeenCalledWith("orbis", "p123");
  });

  it("renders Accept/Decline buttons on FRIEND_REQUEST_INBOUND and wires the adapter callbacks", async () => {
    // Two separate renders rather than one + back-to-back clicks: the
    // row's pending-guard short-circuits a second click while the first
    // callback is still resolving (correct behavior; not under test).
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const item = makeNotif({
      type: "FRIEND_REQUEST_INBOUND",
      payload: { fromUser: { name: "Simon", usertag: "simon" } },
    });
    const acceptRender = render(
      <NotificationRow item={item} adapter={{ onAcceptFriendRequest: onAccept }} now={now} />,
    );
    fireEvent.click(acceptRender.getByText("Accept"));
    expect(onAccept).toHaveBeenCalledTimes(1);
    acceptRender.unmount();

    const onReject = vi.fn().mockResolvedValue(undefined);
    const rejectRender = render(
      <NotificationRow item={item} adapter={{ onRejectFriendRequest: onReject }} now={now} />,
    );
    fireEvent.click(rejectRender.getByText("Decline"));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generic activity row for an unknown type without dropping the record", () => {
    const item = makeNotif({
      type: "UNKNOWN_FUTURE_TYPE",
      payload: { actorName: "Ana" },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText(/New activity/i)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
  });

  it("renders relative time using the injected `now` for deterministic snapshots", () => {
    const item = makeNotif({
      type: "FRIEND_REQUEST_INBOUND",
      payload: { fromUser: { name: "Simon" } },
      createdAt: "2026-06-03T15:00:00.000Z", // 2 days before `now`
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
  });
});
