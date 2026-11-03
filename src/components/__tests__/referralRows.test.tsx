import { describe, it, expect } from "vitest";
import { destinationFor } from "../../utils/notificationDestination";

/**
 * T-303: the four referral rows.
 *
 * The distinction worth pinning is WHO each row is for. One sale produces a
 * referrer's row and an owner's row, and they must not read alike or the two
 * bells become indistinguishable. The destinations encode the same split: a
 * referrer is asking "how much and when", the owner is being told about a sale
 * of their own thing.
 */
describe("referral notification destinations", () => {
  it("sends a referrer to their own tracker", () => {
    for (const t of ["REFERRAL_LINK_ASSIGNED", "REFERRAL_LINK_ACTIVATED", "REFERRAL_SALE"]) {
      expect(destinationFor({ type: t, payload: {} })).toBe("/my-referrals");
    }
  });

  it("sends the owner's copy to the money view, not to a commission tracker", () => {
    expect(destinationFor({ type: "REFERRAL_SALE_OWNER", payload: {} })).toBe("/my-ledger");
  });

  it("still has no destination for an unknown type", () => {
    expect(destinationFor({ type: "NOT_A_REAL_TYPE", payload: {} })).toBeNull();
  });
});
