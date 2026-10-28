import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationRow } from "../NotificationRow";
import { groupNotifications, type NotificationGroup } from "../../utils/groupNotifications";
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

/**
 * Click a row the way a member would, and report whether it was interactive.
 *
 * The row carries `role="button"` (plus tabIndex and the click handler) ONLY
 * when its type resolved to `isClickable`; a non-clickable row is an inert div.
 * Going through this helper means a "does not navigate" assertion cannot pass
 * merely because the click landed on the wrong element -- which is what
 * happened when the 1.2.0 redesign moved the handler off the container root and
 * left the click hitting the outer wrapper.
 *
 * Returns false when the row was inert, so a caller can assert the stronger
 * property: not just "nothing fired" but "there was nothing to fire".
 */
function clickRow(container: HTMLElement): boolean {
  const target = container.querySelector('[role="button"]');
  fireEvent.click(target ?? container.firstElementChild!);
  return target !== null;
}

/**
 * Commerce rows (notifications v2, PR3).
 *
 * These are the bell's first money rows. The trap they share is not layout, it
 * is arithmetic: every amount arrives ALREADY FORMATTED by the backend, with a
 * currency symbol, because money on the platform is stored in the smallest
 * unit and the sender has already converted. A row that "helpfully" divided by
 * 100 again would show a hundredth of the real figure, and would look
 * plausible enough to ship.
 */
describe("NotificationRow — reviews and downloads", () => {
  it("leads a review row with who and what, and carries the rating", () => {
    const item = makeNotif({
      type: "REVIEW_RECEIVED",
      payload: { reviewerName: "Carla Mendes", productName: "Guide", rating: 4, snippet: "Really useful." },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Carla Mendes")).toBeInTheDocument();
    expect(screen.getByText("Guide")).toBeInTheDocument();
    expect(container.textContent).toContain("4/5");
    expect(container.textContent).toContain("Really useful.");
  });

  it("omits the rating rather than inventing one when it is absent", () => {
    const item = makeNotif({
      type: "REVIEW_RECEIVED",
      payload: { reviewerName: "Carla", productName: "Guide" },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(container.textContent).not.toMatch(/undefined|null|NaN|\/5/);
  });

  it("renders a 0/5 review, which is falsy and must not vanish", () => {
    // The obvious `rating ? ... : null` would silently drop the worst review
    // a seller can get — the one they most need to see.
    const item = makeNotif({
      type: "REVIEW_RECEIVED",
      payload: { reviewerName: "Carla", productName: "Guide", rating: 0 },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(container.textContent).toContain("0/5");
  });

  it("tells the seller what a download lockout means for them", () => {
    const item = makeNotif({
      type: "DOWNLOAD_LIMIT_REACHED",
      payload: { buyerName: "Bruno Costa", fileName: "guide.pdf", productName: "Guide" },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();
    expect(container.textContent).toMatch(/raise the limit/i);
  });

  it("never falls back to the generic row", () => {
    for (const type of ["REVIEW_RECEIVED", "DOWNLOAD_LIMIT_REACHED"]) {
      const { container, unmount } = render(
        <NotificationRow item={makeNotif({ type, payload: {} })} adapter={{}} now={now} />,
      );
      expect(container.textContent, type).not.toMatch(/New activity from/i);
      unmount();
    }
  });
});

describe("NotificationRow — commerce", () => {
  it("renders SALE_COMPLETED naming the buyer, the product and the amount", () => {
    const item = makeNotif({
      type: "SALE_COMPLETED",
      payload: { buyerName: "Alice Rivera", productName: "Seller Tracking Guide", saleAmount: "€25.00" },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Alice Rivera")).toBeInTheDocument();
    expect(screen.getByText("Seller Tracking Guide")).toBeInTheDocument();
    expect(screen.getByText(/€25\.00/)).toBeInTheDocument();
  });

  it("prints the amount it was given, untouched", () => {
    // The whole failure mode in one assertion: 2500 cents was formatted to
    // "€25.00" by the sender. If this row ever shows €0.25, something started
    // doing maths it should not.
    const item = makeNotif({
      type: "SALE_COMPLETED",
      payload: { buyerName: "Alice", productName: "Guide", saleAmount: "€25.00" },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(container.textContent).toContain("€25.00");
    expect(container.textContent).not.toContain("0.25");
  });

  it("still says something useful when the amount is missing", () => {
    const item = makeNotif({
      type: "SALE_COMPLETED",
      payload: { buyerName: "Alice", productName: "Guide" },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("Guide");
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });

  it("renders PURCHASE_COMPLETED from the buyer's side", () => {
    const item = makeNotif({
      type: "PURCHASE_COMPLETED",
      payload: { productName: "Brunch ticket", community: { name: "PBN", communityTag: "pbn" } },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Brunch ticket")).toBeInTheDocument();
    expect(screen.getByText(/You bought/i)).toBeInTheDocument();
  });

  it("says a refund was ISSUED, not that it has arrived", () => {
    // The money has left us; when it lands is the card issuer's business.
    // Promising arrival here is how support tickets get made.
    const item = makeNotif({
      type: "REFUND_COMPLETED",
      payload: { productName: "Workshop", refundAmount: "€40.00" },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(container.textContent).toMatch(/issued/i);
    expect(container.textContent).not.toMatch(/in your account|arrived|received/i);
  });

  it("keeps SALE_REFUNDED and REFUND_COMPLETED distinct", () => {
    // Seller and buyer read different sentences about the same refund.
    const seller = render(
      <NotificationRow
        item={makeNotif({ type: "SALE_REFUNDED", payload: { buyerName: "Bruno", productName: "Guide" } })}
        adapter={{}}
        now={now}
      />,
    );
    expect(seller.container.textContent).toContain("Bruno");
    expect(seller.container.textContent).toMatch(/was refunded/i);
    seller.unmount();

    const buyer = render(
      <NotificationRow
        item={makeNotif({ type: "REFUND_COMPLETED", payload: { productName: "Guide" } })}
        adapter={{}}
        now={now}
      />,
    );
    expect(buyer.container.textContent).toMatch(/your refund/i);
  });

  it("renders PAYOUT_CONFIRMED with the amount", () => {
    const item = makeNotif({ type: "PAYOUT_CONFIRMED", payload: { payoutAmount: "€120.50 EUR" } });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("€120.50 EUR")).toBeInTheDocument();
  });

  it("carries the failure reason on PAYOUT_FAILED, because it is the actionable part", () => {
    const item = makeNotif({
      type: "PAYOUT_FAILED",
      payload: { payoutAmount: "€120.50", failureReason: "Bank account closed" },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(container.textContent).toContain("Bank account closed");
    expect(container.textContent).toMatch(/could not be sent/i);
  });

  it("never falls back to the generic row for a commerce type", () => {
    // The fallback is what the coverage test in the consuming app forbids;
    // assert it here too, where the renderer actually lives.
    for (const type of [
      "SALE_COMPLETED", "PURCHASE_COMPLETED", "REFUND_COMPLETED",
      "SALE_REFUNDED", "PAYOUT_CONFIRMED", "PAYOUT_FAILED",
    ]) {
      const { container, unmount } = render(
        <NotificationRow item={makeNotif({ type, payload: {} })} adapter={{}} now={now} />,
      );
      expect(container.textContent, type).not.toMatch(/New activity from/i);
      unmount();
    }
  });
});

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

  it("gives UNREAD rows a bolder weight + a neutral unread dot", () => {
    const item = makeNotif({
      type: "FRIEND_REQUEST_INBOUND",
      status: "UNREAD",
      payload: { fromUser: { name: "Simon" } },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    // Neutral unread dot is exposed to a11y as "Unread".
    expect(screen.getByLabelText("Unread")).toBeInTheDocument();
    // Message text is bolder on unread rows.
    expect(container.querySelector("p.font-semibold")).not.toBeNull();
  });

  it("renders READ rows without the unread dot or bolder weight", () => {
    const item = makeNotif({
      type: "FRIEND_REQUEST_INBOUND",
      status: "READ",
      payload: { fromUser: { name: "Simon" } },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.queryByLabelText("Unread")).not.toBeInTheDocument();
    expect(container.querySelector("p.font-semibold")).toBeNull();
  });

  it("renders system (non-social) icons on a NEUTRAL grey circle, not a brand/semantic tint", () => {
    const item = makeNotif({
      type: "POST_REMOVED_FROM_COMMUNITY",
      payload: { community: { name: "Desconversados" } },
    });
    const { container } = render(<NotificationRow item={item} adapter={{}} now={now} />);
    const iconSvg = container.querySelector("svg");
    const circle = iconSvg?.parentElement as HTMLElement;
    // Neutral grey fill (128,128,128); NOT the old red 239,68,68 tint.
    expect(circle.style.background).toMatch(/128,\s*128,\s*128/);
    expect(circle.style.background).not.toContain("239");
  });

  it("shows the mute button on a post-group ONLY when onMuteThread is provided, and fires it with the postId", () => {
    const groups = groupNotifications([
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana" } }),
      makeNotif({ id: "n1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Becky" } }),
    ]);
    const group = groups[0] as NotificationGroup;
    expect(group.isGroup).toBe(true);

    const onMuteThread = vi.fn();
    const onPostClick = vi.fn();
    const { rerender } = render(
      <NotificationRow item={group} adapter={{ onPostClick }} onMuteThread={onMuteThread} now={now} />,
    );
    const muteBtn = screen.getByLabelText("Mute this thread");
    fireEvent.click(muteBtn);
    expect(onMuteThread).toHaveBeenCalledWith("p1");
    // Clicking mute must NOT also trigger the row's deep-link.
    expect(onPostClick).not.toHaveBeenCalled();

    // Prop absent → no mute button (backward compatible).
    rerender(<NotificationRow item={group} adapter={{ onPostClick }} now={now} />);
    expect(screen.queryByLabelText("Mute this thread")).not.toBeInTheDocument();
  });

  it("stacks at most 3 grouped avatars and shows a '+N' overflow chip", () => {
    const groups = groupNotifications([
      makeNotif({ id: "n5", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana" } }),
      makeNotif({ id: "n4", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Becky" } }),
      makeNotif({ id: "n3", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Carl" } }),
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Dee" } }),
      makeNotif({ id: "n1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Eve" } }),
    ]);
    const group = groups[0] as NotificationGroup;
    render(<NotificationRow item={group} adapter={{}} now={now} />);
    // 5 distinct actors → 3 avatars shown + "+2".
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  // ─── APP_NOTIFICATION (app platform P2.6) ────────────────────────
  //
  // The only type whose copy comes from a third party rather than from the
  // platform, which makes it the only one where the payload is untrusted input
  // rather than data we produced. Two things matter: the app's words reach the
  // member intact and attributed, and the app's LINK cannot become script
  // execution inside the community's own UI.

  it("renders an app's own title and names the app that sent it", () => {
    const item = makeNotif({
      type: "APP_NOTIFICATION",
      payload: { title: "Your check-in is ready", body: "Two minutes, promise.", appName: "Start Here" },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Your check-in is ready")).toBeInTheDocument();
    expect(screen.getByText(/Start Here/)).toBeInTheDocument();
    expect(screen.getByText(/Two minutes, promise\./)).toBeInTheDocument();
    // Never the generic fallback — that was the whole point of adding a case.
    expect(screen.queryByText(/New activity/i)).not.toBeInTheDocument();
  });

  it("renders without an appName rather than printing an empty separator", () => {
    const item = makeNotif({
      type: "APP_NOTIFICATION",
      payload: { title: "Heads up" },
    });
    render(<NotificationRow item={item} adapter={{}} now={now} />);
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.queryByText(/·\s*$/)).not.toBeInTheDocument();
  });

  it("navigates to the app's link via the adapter when one is wired", () => {
    const onUrlClick = vi.fn();
    const item = makeNotif({
      type: "APP_NOTIFICATION",
      payload: { title: "Step 2 unlocked", url: "/apps/start-here/step/2" },
    });
    const { container } = render(
      <NotificationRow item={item} adapter={{ onUrlClick }} now={now} />,
    );
    clickRow(container);
    expect(onUrlClick).toHaveBeenCalledWith("/apps/start-here/step/2");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "//evil.com/phish",
  ])("refuses to navigate to %s", (badUrl) => {
    // The write endpoint rejects these too. This is the second gate: payloads
    // are free-form JSON in the DB, so the renderer cannot assume every row
    // came through that endpoint.
    const onUrlClick = vi.fn();
    const item = makeNotif({
      type: "APP_NOTIFICATION",
      payload: { title: "Click me", url: badUrl },
    });
    const { container } = render(
      <NotificationRow item={item} adapter={{ onUrlClick }} now={now} />,
    );
    // Inert, not merely unlistened-to: a refused URL must leave the row with
    // no click affordance at all, so it does not even look actionable.
    expect(clickRow(container)).toBe(false);
    expect(onUrlClick).not.toHaveBeenCalled();
  });

  it("does not navigate when the app supplied no link at all", () => {
    const onUrlClick = vi.fn();
    const item = makeNotif({
      type: "APP_NOTIFICATION",
      payload: { title: "Just so you know" },
    });
    const { container } = render(
      <NotificationRow item={item} adapter={{ onUrlClick }} now={now} />,
    );
    expect(clickRow(container)).toBe(false);
    expect(onUrlClick).not.toHaveBeenCalled();
  });

  it("never routes an app notification to a profile or community, even if the payload smuggles those keys", () => {
    // An app controls its payload. Without the early return in handleClick it
    // could set `communityTag` or an actor usertag and steer the click into a
    // platform destination it was never given a link to.
    const onCommunityClick = vi.fn();
    const onProfileClick = vi.fn();
    const item = makeNotif({
      type: "APP_NOTIFICATION",
      payload: { title: "Hi", communityTag: "some-community", actorUsertag: "someone" },
    });
    const { container } = render(
      <NotificationRow
        item={item}
        adapter={{ onCommunityClick, onProfileClick }}
        now={now}
      />,
    );
    clickRow(container);
    expect(onCommunityClick).not.toHaveBeenCalled();
    expect(onProfileClick).not.toHaveBeenCalled();
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
