# @cobuntu/notifications-ui

Shared React components for the Cobuntu notifications drawer (Activity + Requests tabs). Consumed by `cobuntu-community-app`; the vanilla-JS widget bundle at `cobuntu-community-app/packages/widgets/src/components/notifications.ts` mirrors the same payload contract for non-React landing-page mount points.

## Why this package exists

Two surfaces render the same `notifications.payload` jsonb from `/api/users/me/notifications`:

- The community-app drawer (mobile bottom-bar Alerts) — needs React.
- The widget bundle that mounts on whitelabel landing pages — vanilla JS only, no React runtime available.

Before this package, a third React renderer lived inline in the drawer: a 518-line `formatNotification(record)` function that flattened every BE payload into a `${actorName} did X` string. That gave us generic-silhouette avatars, no bold-name typography, no type-specific icons, no time-section headers, no multi-actor grouping. The widget bundle on the same payload had all of those.

This package owns the React rendering so the drawer + any future React surface (admin app, hub page) stay in lockstep with the widget bundle via a single source of truth. The widget bundle remains separate (different runtime) but its `case "TYPE":` coverage + payload-key vocabulary are pinned via the `notifications-renderer-parity` test in the consumer.

## Install

```json
"@cobuntu/notifications-ui": "github:cobuntuHello/cobuntu-notifications-ui#<sha>"
```

### Critical install gotchas

1. **Bump the SHA AND `package.json` version every release.** Vercel caches git-dep clones — if the SHA changes without the version bumping, consumer builds may serve stale code. Same gotcha hit `@cobuntu/event-management-ui` (see `feedback_bump_git_dep_version_each_release` in the team's auto-memory).
2. **Public repo.** The repo must stay public so Vercel can clone it on consumer builds without an auth token.
3. **Tailwind v4 `@source`.** If the consumer uses Tailwind v4 AND has classes unique to this package (arbitrary-value classes like `h-[640px]`, `z-[60]` — none of those exist today, but might in future PRs), the consumer's `globals.css` must `@source "./node_modules/@cobuntu/notifications-ui/src/**/*.{ts,tsx}"`. Without that, Tailwind silently misses the classes.
4. **`transpilePackages` in next.config.ts.** The package ships TS source unbuilt; Next must be told to compile it.

## API

```tsx
import { NotificationsView, type Notification } from "@cobuntu/notifications-ui";

<NotificationsView
  data={{
    notifications,        // Notification[] from /api/users/me/notifications
    isLoading,            // shows skeleton when true and notifications=[]
    markAsRead: () => {}, // optional; consumer's own mark-read API
    refresh: () => {},    // optional; consumer's own refresh hook
  }}
  adapter={{
    onProfileClick: (usertag) => router.push(`/members/${usertag}`),
    onPostClick: (communityTag, postId) => router.push(`/feed/post/${postId}`),
    onCommunityClick: (communityTag) => router.push(`/`),
    onAcceptFriendRequest: async (n) => { /* call accept API */ },
    onRejectFriendRequest: async (n) => { /* call reject API */ },
    onClose: () => setOpen(false),
  }}
  activeTab={activeTab}   // "activity" | "requests" — controlled by consumer
  renderAvatar={({ name, imageUrl, size }) => (
    <YourUserAvatar user={{ name, imageUrl }} className={size === 24 ? "h-6 w-6" : "h-10 w-10"} />
  )}
/>
```

### What the package owns

- Per-type JSX dispatch — 22 BE types covered + generic fallback for forward-compat.
- Bold actor + bold community + muted connector typography.
- Multi-actor grouping for POST_REACTED / POST_COMMENTED / POST_COMMENT_REPLY / POST_COMMENT_LIKED on the same post ("Becky and Ana reacted to your post").
- Time-section headers via UTC day-axis ("Today" / "Yesterday" / "This Week" / "This Month" / "Earlier").
- Type-specific icon tiles (green check for joined-community, red shield for post-removed, heart overlay for reactions, etc.).
- Inline Accept/Decline buttons on FRIEND_REQUEST_INBOUND with pending-guard against double-tap.
- Loading skeleton + per-tab empty states.

### What the consumer owns

- Drawer container (animation, drag-to-close, backdrop, header).
- Tab pills + animated underline.
- Fetching `/api/users/me/notifications` (the package doesn't know your API client).
- Mark-read API call on close.
- Avatar slot — consumer passes its own `UserAvatar` for visual continuity with feed + chat.

This boundary lets the package be reused across surfaces that pick different shells (mobile drawer with framer-motion vs. a static desktop panel vs. an embedded modal).

## Theming

All colours via CSS variables consumed at render time:

| Variable | Used for |
|---|---|
| `--bg-color` | Backgrounds, avatar stack rings |
| `--text-color` | Body text, tab underline |
| `--brand-color` | Primary button background, request badge, verified badge |
| `--primary-btn-text` | Primary button text |
| `--heading-font` | Tab labels, section headers, drawer title |

This keeps whitelabel theming working without prop-threading colours through every component.

## Develop

```bash
npm install
npm run typecheck
npm test
```

## File layout

```
src/
├── types.ts                              # Notification, Adapter, DataSource interfaces
├── index.ts                              # Public exports
├── components/
│   ├── NotificationsView.tsx             # top-level — sections + grouping + empty states
│   ├── NotificationRow.tsx               # type dispatcher (22 BE types + fallback)
│   ├── NotificationAvatarBadge.tsx       # stacked avatars + overlay (heart, etc.)
│   ├── Avatar.tsx                        # default; consumer can override via slot
│   ├── VerifiedBadge.tsx                 # inline checkmark for premium users
│   ├── SectionHeader.tsx                 # "Today" / "Yesterday" / "Earlier"
│   ├── EmptyState.tsx                    # per-tab empty UI
│   └── __tests__/                        # vitest + happy-dom + react-testing-library
└── utils/
    ├── getTimeSection.ts                 # UTC day-axis
    ├── formatTimeAgo.ts                  # "2 weeks ago"
    ├── cleanMentionMarkup.ts             # @[name](user:tag) → @name
    ├── groupNotifications.ts             # multi-actor collapse
    └── __tests__/
```

## When you add a new BE NotificationType

1. Add the case branch in `src/components/NotificationRow.tsx`.
2. Also add the SAME case in `cobuntu-community-app/packages/widgets/src/components/notifications.ts` (the vanilla-JS twin on landing pages).
3. The consumer's `__tests__/notifications-renderer-parity.test.ts` will fail until both sides cover the new type — that's the tripwire.
