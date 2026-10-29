/**
 * The `labels` prop: translated row copy, with English as the floor.
 *
 * Three properties matter, and only the first is obvious.
 *
 *   1. A supplied template is used.
 *   2. A MISSING key falls back to this file's English, so a locale can be
 *      translated one row at a time instead of all at once. Without this,
 *      shipping a half-translated map would blank rows.
 *   3. Passing nothing changes nothing. That is what lets the package be
 *      upgraded in cobuntu-frontend, which has no translations to pass, with
 *      no visible change at all.
 */
import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NotificationRow } from "../NotificationRow";
import type { Notification, NotificationsAdapter } from "../../types";

const adapter = {} as NotificationsAdapter;

function row(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    type: "SALE_COMPLETED",
    status: "UNREAD",
    createdAt: new Date().toISOString(),
    payload: { buyerName: "Ana", productName: "The Workbook" },
    ...overrides,
  } as Notification;
}

afterEach(() => cleanup());

describe("labels", () => {
  it("renders a supplied template, substituting its slots", () => {
    render(
      <NotificationRow
        item={row()}
        adapter={adapter}
        labels={{ SALE_COMPLETED: "{buyer} comprou {product}" }}
      />,
    );
    expect(screen.getByText("comprou", { exact: false })).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("The Workbook")).toBeTruthy();
  });

  it("falls back to English for a key the map does not carry", () => {
    // A half-translated map is the normal state of a locale in progress.
    render(
      <NotificationRow
        item={row()}
        adapter={adapter}
        labels={{ COURSE_COMPLETED: "Terminaste {course}" }}
      />,
    );
    expect(screen.getByText("bought", { exact: false })).toBeTruthy();
  });

  it("renders exactly the same thing when no labels are passed", () => {
    const { container: withNone } = render(<NotificationRow item={row()} adapter={adapter} />);
    const a = withNone.innerHTML;
    cleanup();
    const { container: withEmpty } = render(
      <NotificationRow item={row()} adapter={adapter} labels={{}} />,
    );
    expect(withEmpty.innerHTML).toBe(a);
  });

  it("picks the variant template that matches the payload", () => {
    /*
     * "bought X" and "bought X for EUR 9" are two sentences, not one with an
     * empty slot: a translator needs both, and a language may order them
     * differently. So they are two keys, and the payload picks.
     */
    render(
      <NotificationRow
        item={row({ payload: { buyerName: "Ana", productName: "The Workbook", saleAmount: "EUR 24.00" } })}
        adapter={adapter}
        labels={{
          SALE_COMPLETED: "{buyer} bought {product}",
          SALE_COMPLETED_withAmount: "{buyer} paid {amount} for {product}",
        }}
      />,
    );
    expect(screen.getByText("paid", { exact: false })).toBeTruthy();
    expect(screen.getByText("EUR 24.00")).toBeTruthy();
  });

  it("leaves an unknown slot empty rather than printing its braces", () => {
    render(
      <NotificationRow
        item={row()}
        adapter={adapter}
        labels={{ SALE_COMPLETED: "{buyer} bought {nosuchslot}" }}
      />,
    );
    expect(screen.queryByText(/\{nosuchslot\}/)).toBeNull();
  });
});
