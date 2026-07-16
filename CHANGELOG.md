# Changelog

All notable changes to `@cobuntu/notifications-ui`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [Semver](https://semver.org/spec/v2.0.0.html).

## 1.1.0 — 2026-07-16

Notifications redesign, PR-2 (row-level). Backward-compatible: all existing exports and props preserved; new props are optional.

### Added
- **Collapse-per-post.** `groupNotifications` now folds ALL activity on the same post (reactions, comments, replies, comment-likes, mentions sharing `payload.postId`) into ONE group, summarized by kind ("12 reactions and 3 comments on your post"). Single-kind groups keep the existing "\<names\> reacted to your post" phrasing. New exports: `formatGroupSummary`, types `GroupActor` / `KindCount` / `PostActivityKind`; `NotificationGroup` gains `kindCounts`.
- **Expandable groups.** Grouped rows render a "Show all N" toggle that reveals the individual notifications as sub-rows (collapsed by default).
- **Weight-based unread.** Unread rows get a neutral grey fill + bolder weight + a neutral unread dot (works on mobile, which had no unread state before). No brand color.
- **Neutral system icons.** Listing / membership / moderation icons render on a neutral grey circle instead of brand/semantic tint. Social avatar overlays unchanged.
- **Mute affordance.** Optional `onMuteThread?: (postId: string) => void` on `NotificationsView` and `NotificationRow`. When provided, grouped post rows show an unobtrusive bell-off button that calls it with the postId (UI + callback only, no network). Absent ⇒ no button (unchanged).

## 1.0.0 — 2026-06-05

Initial production release. Consumed by `cobuntu-community-app` mobile drawer ([PR #466](https://github.com/cobuntuHello/cobuntu-community-app/pull/466)).

### Added
- `NotificationsView` — top-level drawer body. Tabs split (Activity vs. Requests), section headers, multi-actor grouping, loading skeleton, empty states.
- `NotificationRow` — per-type dispatcher covering all 22 prisma `NotificationType` enum values + generic fallback for forward-compat.
- `NotificationAvatarBadge` + `Avatar` + `VerifiedBadge` — avatar primitives with consumer-overridable slot.
- `SectionHeader`, `EmptyState` — list furniture.
- Utils: `getTimeSection` (UTC day-axis), `formatTimeAgo`, `groupNotifications`, `formatActorNames`, `cleanMentionMarkup`.
- `Notification` type with optional `actor` row-root fallback for consumers whose API layer flattens actor info onto the row.

### Notes
- TypeScript source ships unbuilt; consumers must add the package to `next.config.ts` `transpilePackages`.
- Theming via CSS variables (`--bg-color`, `--text-color`, `--brand-color`, `--primary-btn-text`, `--heading-font`).
- Vanilla-JS twin lives at `cobuntu-community-app/packages/widgets/src/components/notifications.ts`. The two surfaces must stay aligned — `__tests__/notifications-renderer-parity.test.ts` in the consumer enforces case-branch + payload-key parity.
