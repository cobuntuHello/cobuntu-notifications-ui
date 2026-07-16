import { describe, it, expect } from "vitest";
import {
  groupNotifications,
  formatActorNames,
  formatGroupSummary,
  type NotificationGroup,
} from "../groupNotifications";
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

  it("collapses MIXED activity (reactions + comments) on the same post into ONE group", () => {
    // PR-2: the fold is now per-post ACROSS kinds, not per type+post.
    const items = [
      makeNotif({ id: "n4", type: "POST_COMMENTED", createdAt: "2026-06-05T12:03:00.000Z", payload: { postId: "p1", commenterName: "Dee" } }),
      makeNotif({ id: "n3", type: "POST_REACTED", createdAt: "2026-06-05T12:02:00.000Z", payload: { postId: "p1", reactorName: "Carl" } }),
      makeNotif({ id: "n2", type: "POST_COMMENTED", createdAt: "2026-06-05T12:01:00.000Z", payload: { postId: "p1", commenterName: "Becky" } }),
      makeNotif({ id: "n1", type: "POST_REACTED", createdAt: "2026-06-05T12:00:00.000Z", payload: { postId: "p1", reactorName: "Ana" } }),
    ];

    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    const group = result[0] as NotificationGroup;
    expect(group.isGroup).toBe(true);
    expect(group.notifications).toHaveLength(4);
    // Kind counts drive the summary — 2 reactions, 2 comments.
    expect(group.kindCounts).toEqual([
      { kind: "reaction", count: 2 },
      { kind: "comment", count: 2 },
    ]);
    expect(formatGroupSummary(group.kindCounts)).toBe("2 reactions and 2 comments");
  });

  it("groups POST_MENTIONED on the same post alongside reactions/comments", () => {
    const items = [
      makeNotif({ id: "n3", type: "POST_MENTIONED", payload: { postId: "p9", author: { name: "Zoe" } } }),
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p9", reactorName: "Ana" } }),
      makeNotif({ id: "n1", type: "POST_COMMENTED", payload: { postId: "p9", commenterName: "Becky" } }),
    ];

    const result = groupNotifications(items);
    expect(result).toHaveLength(1);
    const group = result[0] as NotificationGroup;
    expect(group.kindCounts).toEqual([
      { kind: "reaction", count: 1 },
      { kind: "comment", count: 1 },
      { kind: "mention", count: 1 },
    ]);
    expect(formatGroupSummary(group.kindCounts)).toBe("1 reaction, 1 comment and 1 mention");
  });

  it("keeps a single-kind group's kindCounts to one entry (no mixed summary)", () => {
    const items = [
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Ana" } }),
      makeNotif({ id: "n1", type: "POST_REACTED", payload: { postId: "p1", reactorName: "Becky" } }),
    ];
    const group = groupNotifications(items)[0] as NotificationGroup;
    expect(group.kindCounts).toEqual([{ kind: "reaction", count: 2 }]);
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

describe("formatGroupSummary", () => {
  it("pluralizes each kind independently", () => {
    expect(formatGroupSummary([{ kind: "reaction", count: 12 }, { kind: "comment", count: 3 }])).toBe(
      "12 reactions and 3 comments",
    );
  });

  it("uses singular nouns for a count of 1", () => {
    expect(formatGroupSummary([{ kind: "reaction", count: 1 }, { kind: "comment", count: 1 }])).toBe(
      "1 reaction and 1 comment",
    );
  });

  it("joins three kinds with commas + 'and'", () => {
    expect(
      formatGroupSummary([
        { kind: "reaction", count: 5 },
        { kind: "comment", count: 2 },
        { kind: "mention", count: 1 },
      ]),
    ).toBe("5 reactions, 2 comments and 1 mention");
  });

  it("renders a single kind without a connector", () => {
    expect(formatGroupSummary([{ kind: "comment", count: 4 }])).toBe("4 comments");
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
