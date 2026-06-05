import { describe, it, expect } from "vitest";
import { groupNotifications, formatActorNames, type NotificationGroup } from "../groupNotifications";
import type { Notification } from "../../types";

function makeNotif(overrides: Partial<Notification> & { id: string; type: string; payload?: any }): Notification {
  return {
    id: overrides.id,
    type: overrides.type,
    status: overrides.status ?? "UNREAD",
    payload: overrides.payload ?? {},
    createdAt: overrides.createdAt ?? "2026-06-05T12:00:00.000Z",
    readAt: null,
    userId: null,
    communityId: null,
  };
}

describe("groupNotifications", () => {
  it("collapses two POST_REACTED on the same post into one group", () => {
    const items = [
      makeNotif({
        id: "n2",
        type: "POST_REACTED",
        createdAt: "2026-06-05T12:00:00.000Z",
        payload: { postId: "p1", reactorName: "Ana", reactorUsertag: "ana" },
      }),
      makeNotif({
        id: "n1",
        type: "POST_REACTED",
        createdAt: "2026-06-04T12:00:00.000Z",
        payload: { postId: "p1", reactorName: "Becky", reactorUsertag: "becky" },
      }),
    ];

    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    expect((result[0] as NotificationGroup).isGroup).toBe(true);
    const group = result[0] as NotificationGroup;
    expect(group.actors.map((a) => a.name)).toEqual(["Ana", "Becky"]);
    // Group appears at the position of the most recent notification.
    expect(group.createdAt).toBe("2026-06-05T12:00:00.000Z");
  });

  it("does not group across different posts", () => {
    const items = [
      makeNotif({ id: "n1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana" } }),
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p2", reactorName: "Becky" } }),
    ];

    const result = groupNotifications(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => !("isGroup" in r) || !r.isGroup)).toBe(true);
  });

  it("does not group non-groupable types (FRIEND_REQUEST_INBOUND)", () => {
    const items = [
      makeNotif({ id: "n1", type: "FRIEND_REQUEST_INBOUND", payload: { fromUser: { name: "Simon" } } }),
      makeNotif({ id: "n2", type: "FRIEND_REQUEST_INBOUND", payload: { fromUser: { name: "Carl" } } }),
    ];

    const result = groupNotifications(items);
    expect(result).toHaveLength(2);
  });

  it("collapses a singleton group back to a bare notification", () => {
    const items = [
      makeNotif({ id: "n1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana" } }),
    ];

    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    expect("isGroup" in result[0] && result[0].isGroup).toBeFalsy();
  });

  it("deduplicates the same actor reacting twice", () => {
    // Same person reacting to the same post twice (across edit cycles).
    const items = [
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana", reactorUsertag: "ana" } }),
      makeNotif({ id: "n1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana", reactorUsertag: "ana" } }),
    ];

    const result = groupNotifications(items);
    const group = result[0] as NotificationGroup;
    expect(group.isGroup).toBe(true);
    expect(group.actors).toHaveLength(1);
  });
});

describe("formatActorNames", () => {
  it("falls back to Someone when no actors", () => {
    expect(formatActorNames([])).toBe("Someone");
  });

  it("renders a single name plainly", () => {
    expect(formatActorNames([{ name: "Becky" }])).toBe("Becky");
  });

  it("renders two names with 'and'", () => {
    expect(formatActorNames([{ name: "Becky" }, { name: "Ana" }])).toBe("Becky and Ana");
  });

  it("renders three names with comma + 'and'", () => {
    expect(formatActorNames([{ name: "Becky" }, { name: "Ana" }, { name: "Carl" }])).toBe(
      "Becky, Ana and Carl"
    );
  });

  it("renders 4+ names with 'N others'", () => {
    expect(
      formatActorNames([{ name: "Becky" }, { name: "Ana" }, { name: "Carl" }, { name: "Dee" }])
    ).toBe("Becky, Ana and 2 others");
  });

  it("singularizes 'other' for exactly 1 other", () => {
    expect(
      formatActorNames(
        [{ name: "Becky" }, { name: "Ana" }, { name: "Carl" }, { name: "Dee" }],
        2,
      )
    ).toBe("Becky, Ana and 2 others");
  });
});
