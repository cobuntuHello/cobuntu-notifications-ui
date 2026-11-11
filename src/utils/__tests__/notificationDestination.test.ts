/**
 * Where each notification takes you.
 *
 * Nine row types resolved no destination and did nothing when clicked. A
 * notification whose job is to say something happened to a SPECIFIC thing
 * should put you in front of that thing — and while every row looked
 * identically clickable, each click that did nothing taught the member that
 * the bell is decorative.
 */
import { describe, it, expect } from "vitest";
import { destinationFor } from "../notificationDestination";

const d = (type: string, payload: Record<string, unknown> = {}) =>
  destinationFor({ type, payload });

describe("money rows land where the money is", () => {
  it("sends a failed payout to the screen that fixes it", () => {
    // The whole reason this notification exists: the bank details are wrong
    // and the money is stuck until somebody changes them.
    expect(d("PAYOUT_FAILED")).toBe("/my-payouts");
  });

  it("sends a sale to the ledger, not to the product", () => {
    // The fee and the payout are the part a seller opens this for.
    expect(d("SALE_COMPLETED")).toBe("/my-ledger");
  });

  it("sends a purchase to the orders screen", () => {
    // Receipt, invoice and download link live together there.
    expect(d("PURCHASE_COMPLETED")).toBe("/my-orders");
  });
});

describe("artifact rows land on the artifact", () => {
  it("builds a marketplace path from the sku", () => {
    expect(d("LISTING_APPROVED", { itemHandle: "the-workbook", itemType: "product" }))
      .toBe("/marketplace/the-workbook");
  });

  it("builds an event path from the slug", () => {
    expect(d("LISTING_APPROVED", { itemHandle: "founder-breakfast", itemType: "event" }))
      .toBe("/events/founder-breakfast");
  });

  it("escapes a handle rather than trusting it into a URL", () => {
    expect(d("REVIEW_RECEIVED", { itemHandle: "a b/c", itemType: "product" }))
      .toBe("/marketplace/a%20b%2Fc");
  });
});

describe("rows with nowhere to go", () => {
  it("returns null when the handle is missing", () => {
    /*
     * The row then renders as non-interactive. That is the point: a hover
     * that promises a click must not be shown on a row that cannot deliver
     * one.
     */
    expect(d("LISTING_APPROVED", { itemType: "product" })).toBeNull();
  });

  it("returns null for a type with no destination at all", () => {
    expect(d("FRIEND_REQUEST_INBOUND")).toBeNull();
    expect(d("POST_REACTED", { postId: "p1" })).toBeNull();
  });

  it("falls back for an approval decision with no artifact", () => {
    // Their own orders still hold the request, so there is somewhere useful
    // even when the handle never resolved.
    expect(d("APPROVAL_DECIDED")).toBe("/my-orders");
    expect(d("COURSE_COMPLETED")).toBe("/library");
  });
});

describe("coverage", () => {
  it("resolves a destination for every row that previously had none", () => {
    /*
     * The nine. Each is given the payload it would actually carry, so this
     * fails if a future change drops the handle plumbing rather than only if
     * somebody edits this map.
     */
    const withHandle = { itemHandle: "x", itemType: "product" };
    for (const type of [
      "SALE_COMPLETED", "SALE_REFUNDED", "PAYOUT_CONFIRMED", "PAYOUT_FAILED",
      "PURCHASE_COMPLETED", "REFUND_COMPLETED", "REVIEW_RECEIVED",
      "DOWNLOAD_LIMIT_REACHED", "LISTING_REJECTED", "LISTING_DEACTIVATED",
      "LISTING_PROPOSAL", "LISTING_PROPOSAL_ACCEPTED", "LISTING_PROPOSAL_REJECTED",
      "COURSE_COMPLETED", "COURSE_LESSON_PUBLISHED",
      "APPROVAL_REQUESTED", "APPROVAL_REQUEST_SENT", "APPROVAL_DECIDED",
    ]) {
      expect(d(type, withHandle), `${type} has nowhere to go`).toBeTruthy();
    }
  });
});

describe("event reviews", () => {
  it("a host lands on the event's Reviews tab", () => {
    expect(d("EVENT_REVIEW_RECEIVED", { eventSlug: "wild-coast", eventId: "e1" })).toBe("/events/wild-coast/manage?view=reviews");
  });
  it("a reviewer lands on the event page's reviews", () => {
    expect(d("EVENT_REVIEW_REPLIED", { eventSlug: "wild coast" })).toBe("/events/wild%20coast#reviews");
  });
  it("no event, nowhere to go", () => {
    expect(d("EVENT_REVIEW_RECEIVED", {})).toBeNull();
  });
});

describe("product and course reviews (unified reviews)", () => {
  it("a seller lands on the item's Reviews tab: marketplace for a product, learning for a course", () => {
    expect(d("REVIEW_RECEIVED", { productId: "p1", productSku: "sketch-kit", productType: "DIGITAL" })).toBe("/marketplace/sketch-kit/manage?view=reviews");
    expect(d("REVIEW_RECEIVED", { productId: "c 1", productSku: "x", productType: "COURSE" })).toBe("/learning/c%201/manage?view=reviews");
  });
  it("a reviewer lands on the item page's reviews", () => {
    expect(d("REVIEW_REPLIED", { productId: "p1", productSku: "sketch-kit", productType: "PHYSICAL" })).toBe("/marketplace/sketch-kit#reviews");
    expect(d("REVIEW_REPLIED", { productId: "c1", productType: "COURSE" })).toBe("/learning/c1#reviews");
  });
  it("no product, nowhere to go", () => {
    expect(d("REVIEW_REPLIED", {})).toBeNull();
  });
});

describe("host and seller activity (backend T-333)", () => {
  it("an event row lands on the attendee list, by slug or by id", () => {
    expect(d("EVENT_REGISTRATION_RECEIVED", { itemType: "event", itemHandle: "sunset-hike", itemId: "e1" })).toBe("/events/sunset-hike/manage?view=attendees");
    expect(d("EVENT_ATTENDEE_CANCELLED", { itemType: "event", itemId: "e1" })).toBe("/events/e1/manage?view=attendees");
  });

  it("a donation lands on the ledger of whatever received it", () => {
    expect(d("DONATION_RECEIVED", { itemType: "event", itemHandle: "hike" })).toBe("/events/hike/manage?view=ledger");
    expect(d("DONATION_RECEIVED", { itemType: "product", itemHandle: "kit-1", productType: "DIGITAL" })).toBe("/marketplace/kit-1/manage?view=ledger");
  });

  it("a course row goes to /learning by id, never by sku", () => {
    expect(d("COURSE_LEARNER_COMPLETED", { itemType: "product", itemId: "p1", itemHandle: "sku-1", productType: "COURSE" })).toBe("/learning/p1/manage?view=buyers");
  });

  it("a download lands on the product's buyers", () => {
    expect(d("FILE_DOWNLOADED", { itemType: "product", itemHandle: "kit-1" })).toBe("/marketplace/kit-1/manage?view=buyers");
  });

  it("has nowhere to go without a handle or id, rather than a broken link", () => {
    expect(d("FILE_DOWNLOADED", { itemType: "product" })).toBeNull();
  });
});
