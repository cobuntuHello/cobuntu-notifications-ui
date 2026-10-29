# Changelog

All notable changes to `@cobuntu/notifications-ui`.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [Semver](https://semver.org/spec/v2.0.0.html).

## 1.7.0 — 2026-10-29

Every row in this package was hardcoded English. The community app ships in 24 locales and its notification SETTINGS screen is fully translated, so a Portuguese member could read a translated row name in settings, open the bell, and be told "was added to" in English. The package was the one place in that loop with no way in for copy.

### Added
- `NotificationLabels`: an optional `labels` prop on `NotificationsView` and `NotificationRow`, mapping a notification type to a message template. Templates are sentences with `{named}` slots (`"{buyer} bought {product}"`); literal text renders muted, a slot renders emphasised, and a slot whose value is already a node (an actor name followed by a verified badge) renders as-is.
- Variant keys where one sentence has two shapes. A sale with a known amount and one without are different sentences, not one sentence with an empty slot, and a translator needs both: `SALE_COMPLETED` and `SALE_COMPLETED_withAmount`.

### Changed
- All 56 `buildMessage` cases now build their sentence from a template instead of hand-assembling muted/bold fragments inline.
- `COURSE_LESSON_PUBLISHED`'s fallback course name: "a course you own" read as "a course you authored", which is the opposite party. This row only ever goes to the learner, so it is "a course you bought".

### Compatibility
Entirely additive. A consumer that passes no `labels` gets byte-identical output: the host app's 99 renderer-parity and type-coverage tests pass unchanged against this version. A map missing a key falls back to that key's English, so a locale can be translated one row at a time.

### Not covered, deliberately
`formatGroupSummary` ("3 reactions and 2 comments on your post") and `renderActorNames` (the " and " joiner, the "N others" tail, the "Someone" fallback) stay English. Both need real plural rules; a one/many table is already wrong for any language with more than two forms, and routing them through this template system would hardcode the English plural model into two more places. They want `Intl.PluralRules` and a list formatter, which is its own change.

## 1.3.0 — 2026-08-07

App platform P2.6: installed apps can now send a member a bell notification, so the row renderer has to handle copy it did not author.

### Added
- `NotificationRow` case for `APP_NOTIFICATION`. The app supplies `title`, `body`, `url`, and `appName` in the payload; the row renders the app's own words and attributes them, instead of falling through to the generic "New activity" row.
- `NotificationsAdapter.onUrlClick?: (url: string) => void` — navigation for a payload-supplied destination. Optional; without it the row falls back to `window.location.assign`, so existing consumers need no change. Wire it in a Next.js consumer to keep an in-app link a client-side transition.
- `safeNotificationUrl(raw: unknown): string | null` — exported so consumers (notably the vanilla widget twin) validate identically.

### Security
- `APP_NOTIFICATION` payloads are the first notification content authored by a third party, so the link is treated as untrusted. Only `https:`, `http:`, and single-slash site-relative paths navigate; `javascript:`, `data:`, and protocol-relative `//host` are refused. The backend write endpoint rejects the same set, making this the second of two gates rather than the only one — notification payloads are free-form JSON in the database and this package cannot verify which writer produced a given row.
- An app notification never falls through to profile / community routing, so a payload cannot smuggle a `communityTag` or actor usertag to steer the click somewhere the app was not given a link to.
## 1.2.0 — 2026-07-16

Notifications redesign, PR-3. Backward-compatible: all existing exports and props preserved; the new prop is optional and defaults to today's behavior.

### Changed
- **Mentions no longer fold into post groups.** `groupNotifications` no longer treats `POST_MENTIONED` as ambient post activity — a mention of the user is a direct, personal signal, so it NEVER collapses into a post's grouped row and always renders as its own standalone notification, even when reactions/comments exist on the same post. Reaction / comment / reply / comment-like grouping is unchanged.

### Added
- **Flat New/Earlier layout.** New optional `layout?: "tabs" | "flat"` on `NotificationsView` (default `"tabs"` ⇒ existing Activity/Requests tabs + time-based section headers, unchanged). With `layout="flat"`, the component ignores `activeTab` and the Activity/Requests split, groups the FULL list, and renders a single unified list split into two read-status sections: **New** (any unread item; actionable requests — `FRIEND_REQUEST_INBOUND` / `MEMBERSHIP_REQUEST` — pinned to the top) and **Earlier** (fully read). Newest-first order is preserved within each section, there are NO time buckets ("Today" / "Yesterday" / …), and the empty state reads "You're all caught up". `onMuteThread`, `renderAvatar`, and `now` are forwarded to rows exactly as in the tabs path.

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
