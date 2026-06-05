# @cobuntu/notifications-ui

Shared React components for the Cobuntu notifications drawer (Activity + Requests tabs). Consumed by `cobuntu-community-app` and `cobuntu-frontend`.

## Why this package exists

Before this package, three separate renderers drifted out of sync:

- Legacy React panel (cobuntu-frontend) — rich, well-developed
- Legacy React drawer (cobuntu-frontend) — rich, similar but separate
- New community-app drawer — stub with `// TODO: Wire to notifications API`, generic silhouettes, "Someone" as actor name everywhere

This package owns the rendering for both React surfaces; the widget bundle (vanilla JS, mounts on whitelabel landing pages where React isn't available) reads the same payload contract so all surfaces converge.

## Install (consumer)

```json
"@cobuntu/notifications-ui": "github:cobuntuHello/cobuntu-notifications-ui#<sha>"
```

Bump the SHA **and** the version on every release — Vercel caches git-dep clones and serves stale code if the SHA changes without the version bumping.

For Tailwind v4 consumers (admin + community-app): add this package to `globals.css @source` so Tailwind generates classes used inside the package.

## API (post-PR-4 surface)

```tsx
import { NotificationsView } from "@cobuntu/notifications-ui";

<NotificationsView
  data={{ notifications, isLoading, markAsRead, refresh }}
  adapter={{ onProfileClick, onPostClick, onCommunityClick, ... }}
  currentCommunityTag={tag}
/>
```

Container (animation, drag-to-close, backdrop) stays in the consumer. Package owns only the contents.

## Develop

```bash
npm install
npm run typecheck
npm test
```
