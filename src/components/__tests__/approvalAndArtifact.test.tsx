/**
 * The approval rows, the artifact thumbnail, and the person coming back to
 * the rows that name one.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NotificationRow } from "../NotificationRow";
import type { Notification } from "../../types";

function makeNotif(type: string, payload: Record<string, unknown> = {}): Notification {
  return {
    id: "n1", type, status: "UNREAD", payload,
    createdAt: "2026-10-29T12:00:00.000Z", readAt: null, userId: null, communityId: null,
  } as Notification;
}

afterEach(() => cleanup());

describe("approval rows", () => {
  it("tells the decider somebody is waiting, not that something happened", () => {
    /*
     * This row is a job, not news: nothing moves until the reader acts, and
     * at fourteen days the request cancels and charges them the processing
     * fee. The snippet says so rather than leaving it to be inferred.
     */
    render(
      <NotificationRow
        item={makeNotif("APPROVAL_REQUESTED", {
          requesterName: "Ana Ribeiro",
          itemName: "Founder Breakfast",
          itemType: "event",
        })}
        adapter={{}}
      />,
    );
    expect(screen.getByText("Ana Ribeiro")).toBeTruthy();
    expect(screen.getByText(/Waiting on your answer/)).toBeTruthy();
  });

  it("renders a decision that predates the type", () => {
    /*
     * Decisions used to arrive as APP_NOTIFICATION with a pre-written title
     * and body. Those rows are still in people's bells, and they must not go
     * blank now that the sentence is composed here.
     */
    render(
      <NotificationRow
        item={makeNotif("APPROVAL_DECIDED", {
          title: "Your request was approved",
          body: "You can open it now.",
        })}
        adapter={{}}
      />,
    );
    expect(screen.getByText("Your request was approved")).toBeTruthy();
  });

  it("composes the decision when the structured fields are there", () => {
    render(
      <NotificationRow
        item={makeNotif("APPROVAL_DECIDED", { decision: "approved", itemName: "The Workbook" })}
        adapter={{}}
      />,
    );
    expect(screen.getByText(/was approved/)).toBeTruthy();
    expect(screen.getByText("The Workbook")).toBeTruthy();
  });
});

describe("the artifact thumbnail", () => {
  it("shows the thing the notification is about", () => {
    /*
     * The leading tile answers "who", this one answers "which thing". A
     * member with four listings reading "your product X was approved" would
     * otherwise have to parse a name to work out which of their things moved.
     */
    const { container } = render(
      <NotificationRow
        item={makeNotif("LISTING_APPROVED", {
          itemName: "The Workbook",
          itemImageUrl: "https://example.test/cover.jpg",
        })}
        adapter={{}}
      />,
    );
    const img = container.querySelector('img[src="https://example.test/cover.jpg"]') as HTMLImageElement;
    expect(img).toBeTruthy();
    // Squircle, not a circle: a circle reads as a person, and the round
    // avatar on the left is already doing that job.
    expect(img.style.borderRadius).toBe("8px");
    // Decorative: the sentence already names the item, so a screen reader
    // announcing the cover again would be noise.
    expect(img.getAttribute("aria-hidden")).toBe("true");
  });

  it("reserves no space when there is no image", () => {
    const { container } = render(
      <NotificationRow item={makeNotif("LISTING_APPROVED", { itemName: "X" })} adapter={{}} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("the person in rows that name one", () => {
  it("draws their avatar with the glyph as a badge", () => {
    /*
     * Six rows named somebody in their sentence and drew an anonymous grey
     * tile: "Ana Ribeiro requested to list Founder Breakfast" beside a tile
     * with no Ana in it.
     */
    const { container } = render(
      <NotificationRow
        item={makeNotif("LISTING_REQUESTED", {
          requesterName: "Ana Ribeiro",
          requesterAvatarUrl: "https://example.test/ana.jpg",
          itemName: "Founder Breakfast",
        })}
        adapter={{}}
      />,
    );
    expect(container.querySelector('img[src="https://example.test/ana.jpg"]')).toBeTruthy();
  });

  it("falls back to the plain tile for a row with no avatar", () => {
    // Every row written before the backend resolved one. These must keep
    // rendering exactly as they did rather than showing a blank circle.
    const { container } = render(
      <NotificationRow
        item={makeNotif("LISTING_REQUESTED", {
          requesterName: "Ana Ribeiro",
          itemName: "Founder Breakfast",
        })}
        adapter={{}}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
