/**
 * Where a notification takes you.
 *
 * ── The gap ────────────────────────────────────────────────────────────────
 *
 * Nine row types resolved no destination and did nothing when clicked: every
 * listing decision, every commerce row, course completion. A notification
 * whose whole job is to say something happened to a SPECIFIC thing should put
 * you in front of that thing, and while every row looked identically
 * clickable, each click that did nothing taught the member that the bell is
 * decorative.
 *
 * ── Why a path and not a new callback ──────────────────────────────────────
 *
 * The adapter could have grown `onProductClick`, `onSaleClick`,
 * `onListingClick` and so on, and every consumer would have had to implement
 * them. But it already has `onUrlClick`, already wired, already routing an
 * in-app path through the host's router rather than a page load. Building the
 * path here and handing it over keeps the package exactly as
 * router-agnostic as it is today and asks nothing of the host.
 *
 * ── The principle ──────────────────────────────────────────────────────────
 *
 * Land on the thing, in the state that allows the next action. A failed
 * payout goes to the payouts screen where the bank details are fixed, not to
 * a generic index. A rejected listing goes to the page where it is edited and
 * resubmitted, because that is the only screen with a remedy.
 *
 * Returns null where there is genuinely nowhere to go, and the row then
 * renders as non-interactive rather than inviting a click that does nothing.
 */

export interface DestinationInput {
  type: string;
  payload: Record<string, unknown>;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

/** /marketplace/<sku> or /events/<slug>, if the row knows which thing. */
function artifactPath(payload: Record<string, unknown>): string | null {
  const handle = str(payload.itemHandle);
  if (!handle) return null;
  return str(payload.itemType) === "event"
    ? `/events/${encodeURIComponent(handle)}`
    : `/marketplace/${encodeURIComponent(handle)}`;
}

export function destinationFor({ type, payload }: DestinationInput): string | null {
  switch (type) {
    // ── The money is the point, so the ledger is the destination ──────────
    case "SALE_COMPLETED":
    case "SALE_REFUNDED":
      return "/my-ledger";

    // The screen where the bank details are fixed. For PAYOUT_FAILED this is
    // the whole reason the notification exists.
    case "PAYOUT_CONFIRMED":
    case "PAYOUT_FAILED":
      return "/my-payouts";

    // The receipt, the invoice and the download link all live together.
    case "PURCHASE_COMPLETED":
    case "REFUND_COMPLETED":
      return "/my-orders";

    // ── Land on the artifact ──────────────────────────────────────────────
    case "REVIEW_RECEIVED":
    case "LISTING_APPROVED":
    case "LISTING_REQUESTED":
    case "LISTING_WITHDRAWN":
      return artifactPath(payload);

    /*
     * A decline or a deactivation is a dead end without somewhere to act, and
     * the public page is not that place -- it is either gone or unchanged.
     * The artifact page is still the best available landing: it is one step
     * from the manage view and it is a destination that definitely exists.
     */
    case "LISTING_REJECTED":
    case "LISTING_DEACTIVATED":
      return artifactPath(payload);

    // All three proposal rows are about one negotiation on one item.
    case "LISTING_PROPOSAL":
    case "LISTING_PROPOSAL_ACCEPTED":
    case "LISTING_PROPOSAL_REJECTED":
      return artifactPath(payload);

    // ── Courses ───────────────────────────────────────────────────────────
    // The learner's own shelf, where a finished course lives.
    case "COURSE_COMPLETED":
      return "/library";
    // The course itself: the row names a lesson, and opening an index would
    // make them hunt for it.
    case "COURSE_LESSON_PUBLISHED":
      return artifactPath(payload) ?? "/library";

    // ── Approvals ─────────────────────────────────────────────────────────
    // The decider needs the thing they are deciding about.
    case "APPROVAL_REQUESTED":
      return artifactPath(payload);
    // The requester's own side of it: their orders, where the request sits.
    case "APPROVAL_REQUEST_SENT":
    case "APPROVAL_DECIDED":
      return artifactPath(payload) ?? "/my-orders";

    /*
     * Downloads. The seller's remedy is raising the cap, which lives on the
     * product's manage screen; until this package is told that route, the
     * product page is the honest landing rather than a guess at an admin URL.
     */
    case "DOWNLOAD_LIMIT_REACHED":
      return artifactPath(payload);

    default:
      return null;
  }
}
