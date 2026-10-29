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

  it("does NOT group POST_MENTIONED — a mention stays a bare notification even when reactions/comments exist on the same post", () => {
    const items = [
      makeNotif({ id: "n3", type: "POST_MENTIONED", payload: { postId: "p9", author: { name: "Zoe" } } }),
      makeNotif({ id: "n2", type: "POST_REACTED", payload: { postId: "p9", reactorName: "Ana" } }),
      makeNotif({ id: "n1", type: "POST_COMMENTED", payload: { postId: "p9", commenterName: "Becky" } }),
    ];

    const result = groupNotifications(items);
    // The mention is standalone; the reaction + comment still fold → 2 items.
    expect(result).toHaveLength(2);

    // The mention renders as its own bare notification, NOT folded in.
    const mention = result.find(
      (r) => !("isGroup" in r && r.isGroup) && (r as Notification).type === "POST_MENTIONED",
    ) as Notification | undefined;
    expect(mention).toBeDefined();
    expect(mention!.id).toBe("n3");

    // The ambient reaction/comment group carries NO mention kind.
    const group = result.find((r) => "isGroup" in r && r.isGroup) as NotificationGroup;
    expect(group).toBeDefined();
    expect(group.notifications).toHaveLength(2);
    expect(group.kindCounts).toEqual([
      { kind: "reaction", count: 1 },
      { kind: "comment", count: 1 },
    ]);
    expect(group.kindCounts.some((k) => k.kind === "mention")).toBe(false);
    expect(formatGroupSummary(group.kindCounts)).toBe("1 reaction and 1 comment");
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

  it("joins three kinds the way the locale joins a list", () => {
    /*
     * Pinned against an EXPLICIT locale, not the runtime default. These used
     * to assert the hand-rolled ", " + " and ", which is the en-GB form; the
     * joining is Intl.ListFormat's job now, and `en` (like en-US) takes the
     * Oxford comma while en-GB does not. Asserting the runtime default would
     * make this test pass or fail depending on the machine it runs on.
     */
    const counts = [
      { kind: "reaction" as const, count: 5 },
      { kind: "comment" as const, count: 2 },
      { kind: "mention" as const, count: 1 },
    ];
    expect(formatGroupSummary(counts, { locale: "en-GB" })).toBe(
      "5 reactions, 2 comments and 1 mention",
    );
    expect(formatGroupSummary(counts, { locale: "en-US" })).toBe(
      "5 reactions, 2 comments, and 1 mention",
    );
  });

  it("takes its nouns per plural category, not per one/many", () => {
    /*
     * The whole reason for the change. A host supplies a noun for each plural
     * category its language has; English has two, so two keys cover it.
     */
    const labels = {
      group_reaction_one: "rea\u00e7\u00e3o",
      group_reaction_other: "rea\u00e7\u00f5es",
      group_countedNoun: "{count} {noun}",
    };
    expect(formatGroupSummary([{ kind: "reaction", count: 1 }], { locale: "pt-PT", labels })).toBe(
      "1 rea\u00e7\u00e3o",
    );
    expect(formatGroupSummary([{ kind: "reaction", count: 5 }], { locale: "pt-PT", labels })).toBe(
      "5 rea\u00e7\u00f5es",
    );
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

  it("renders three names the way the locale joins a list", () => {
    const actors = [{ name: "Becky" }, { name: "Ana" }, { name: "Carl" }];
    expect(formatActorNames(actors, 2, { locale: "en-GB" })).toBe("Becky, Ana and Carl");
    // Not an English assumption any more: the conjunction comes from the locale.
    expect(formatActorNames(actors, 2, { locale: "pt-PT" })).toBe("Becky, Ana e Carl");
  });

  it("renders 4+ names with 'N others'", () => {
    expect(
      formatActorNames(
        [{ name: "Becky" }, { name: "Ana" }, { name: "Carl" }, { name: "Dee" }],
        2,
        { locale: "en-GB" },
      )
    ).toBe("Becky, Ana and 2 others");
  });

  it("names the last person rather than calling them '1 other'", () => {
    /*
     * This test used to be called "singularizes 'other' for exactly 1 other"
     * and passed maxNames=2 with four actors, so `remaining` was 2 and it
     * never exercised a singular at all.
     *
     * It cannot: "1 other" is unreachable by construction. For `remaining` to
     * be 1 you need actors.length === maxNames + 1, and that hits the
     * name-everyone branch first -- deliberately, because naming the last
     * person is strictly better than counting them. The singular noun is kept
     * for hosts whose plural rules put a different category at 1 and for
     * anyone calling the helper directly, but this path never produces it.
     */
    expect(
      formatActorNames([{ name: "Becky" }, { name: "Ana" }, { name: "Carl" }, { name: "Dee" }], 3, {
        locale: "en-GB",
      })
    ).toBe("Becky, Ana, Carl and Dee");
  });
});
