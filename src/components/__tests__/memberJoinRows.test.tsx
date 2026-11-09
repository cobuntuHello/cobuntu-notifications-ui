/**
 * A community's membership reviewers: "X joined" and "X requested to join".
 *
 * A request from an account can be decided in the row. One from someone with
 * no account (a form or landing-page request) has no profile and no account to
 * admit, so the row opens the members page instead.
 */
import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NotificationRow } from "../NotificationRow";
import type { Notification, NotificationsAdapter } from "../../types";

afterEach(() => cleanup());

function item(type: string, payload: Record<string, unknown>): Notification {
  return { id: "n1", type, status: "UNREAD", createdAt: new Date().toISOString(), payload } as Notification;
}

const community = { communityTag: "pbn", communityName: "PBN" };

describe("MEMBER_JOINED", () => {
  it("says who joined which community, and opens their profile", () => {
    const onProfileClick = vi.fn();
    render(
      <NotificationRow
        item={item("MEMBER_JOINED", { ...community, fromUser: { id: "u1", name: "Ana", usertag: "ana" } })}
        adapter={{ onProfileClick } as NotificationsAdapter}
      />,
    );
    expect(screen.getByText("joined", { exact: false })).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    fireEvent.click(screen.getByText("Ana"));
    expect(onProfileClick).toHaveBeenCalledWith("ana");
  });
});

describe("MEMBERSHIP_REQUEST", () => {
  const fromAccount = { ...community, requestId: "r1", applicant: { id: "u1", name: "Ana", usertag: "ana" } };
  const noAccount = { ...community, requestId: "r2", applicant: { id: null, name: "Newcomer", usertag: null } };

  it("offers Accept and Decline for a request from an account", async () => {
    const onAcceptMembershipRequest = vi.fn().mockResolvedValue(undefined);
    const onRejectMembershipRequest = vi.fn().mockResolvedValue(undefined);
    render(
      <NotificationRow
        item={item("MEMBERSHIP_REQUEST", fromAccount)}
        adapter={{ onAcceptMembershipRequest, onRejectMembershipRequest } as NotificationsAdapter}
      />,
    );
    expect(screen.getByText("requested to join", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByText("Accept"));
    expect(onAcceptMembershipRequest).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
  });

  it("offers no buttons for a request without an account, and opens the members page", () => {
    const onMembersListClick = vi.fn();
    render(
      <NotificationRow
        item={item("MEMBERSHIP_REQUEST", noAccount)}
        adapter={{
          onMembersListClick,
          onAcceptMembershipRequest: vi.fn(),
          onRejectMembershipRequest: vi.fn(),
        } as unknown as NotificationsAdapter}
      />,
    );
    expect(screen.queryByText("Accept")).toBeNull();
    expect(screen.getByText("Newcomer")).toBeTruthy();
    fireEvent.click(screen.getByText("Newcomer"));
    expect(onMembersListClick).toHaveBeenCalledWith("pbn");
  });

  it("offers no buttons when the app has not wired the decision", () => {
    render(<NotificationRow item={item("MEMBERSHIP_REQUEST", fromAccount)} adapter={{} as NotificationsAdapter} />);
    expect(screen.queryByText("Accept")).toBeNull();
  });
});
