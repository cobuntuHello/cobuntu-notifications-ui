import React, { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { VerifiedBadge } from "./VerifiedBadge";

export interface NotificationActorView {
  name: string;
  usertag?: string | null;
  imageUrl?: string | null;
  isVerified?: boolean | null;
}

interface NotificationAvatarBadgeProps {
  actors: NotificationActorView[];
  /** Small overlay (e.g. heart icon for reactions, check for joins). */
  overlay?: ReactNode;
  overlayClassName?: string;
  renderAvatar?: (props: { name: string; imageUrl: string | null; size: number }) => React.ReactNode;
}

/**
 * Avatar tile for a notification row. Single actor → one round avatar;
 * multi-actor groups → up to THREE stacked avatars with a hairline ring
 * so the stacking reads as overlap, plus a "+N" chip when more actors
 * remain. Optional overlay badge sits bottom-right (heart for reactions,
 * etc.) — same pattern as the legacy renderer.
 */
export function NotificationAvatarBadge({
  actors,
  overlay,
  overlayClassName = "",
  renderAvatar,
}: NotificationAvatarBadgeProps) {
  if (actors.length === 0) return null;

  const isMultiple = actors.length > 1;
  const shown = actors.slice(0, 3);
  const overflow = actors.length - shown.length;

  return (
    <div className={`relative shrink-0 h-10 ${isMultiple ? "" : "w-10"}`}>
      {isMultiple ? (
        <div className="flex items-center -space-x-2 h-10">
          {shown.map((a, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                boxShadow: "0 0 0 2px var(--bg-color, #fff)",
                position: "relative",
                zIndex: shown.length - i,
              }}
            >
              <Avatar
                name={a.name}
                imageUrl={a.imageUrl}
                size={24}
                renderAvatar={renderAvatar}
              />
            </div>
          ))}
          {overflow > 0 && (
            <div
              className="rounded-full flex items-center justify-center shrink-0"
              style={{
                width: 24,
                height: 24,
                position: "relative",
                background: "rgba(128,128,128,0.16)",
                color: "var(--text-color, currentColor)",
                fontSize: 10,
                fontWeight: 600,
                boxShadow: "0 0 0 2px var(--bg-color, #fff)",
              }}
            >
              +{overflow}
            </div>
          )}
        </div>
      ) : (
        <Avatar
          name={actors[0].name}
          imageUrl={actors[0].imageUrl}
          size={40}
          renderAvatar={renderAvatar}
        />
      )}
      {overlay && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center ${overlayClassName}`}
          style={{
            width: 18,
            height: 18,
            boxShadow: "0 0 0 2px var(--bg-color, #fff)",
          }}
        >
          {overlay}
        </div>
      )}
    </div>
  );
}

/** Render a single name with optional verified badge. */
function NameWithBadge({ name, isVerified }: { name: string; isVerified?: boolean | null }) {
  return (
    <>
      <span className="font-medium">{name}</span>
      {isVerified ? <VerifiedBadge /> : null}
    </>
  );
}

/**
 * Format actor names as JSX with bold names + muted connectors.
 *   1     → <strong>Becky</strong>
 *   2     → <strong>Becky</strong> and <strong>Ana</strong>
 *   3     → <strong>Becky</strong>, <strong>Ana</strong> and <strong>Carl</strong>
 *   4+    → <strong>Becky</strong>, <strong>Ana</strong> and 2 others
 *
 * Connector words are wrapped in a span with `opacity-60` so they fade
 * into the secondary-text tone. Verified actors get an inline badge.
 */
export function renderActorNames(
  actors: { name: string; isVerified?: boolean | null }[],
  maxNames = 2,
): ReactNode {
  if (actors.length === 0) return <span className="font-medium">Someone</span>;
  if (actors.length === 1) return <NameWithBadge name={actors[0].name} isVerified={actors[0].isVerified} />;

  if (actors.length === 2) {
    return (
      <>
        <NameWithBadge name={actors[0].name} isVerified={actors[0].isVerified} />
        <span style={{ opacity: 0.6 }}> and </span>
        <NameWithBadge name={actors[1].name} isVerified={actors[1].isVerified} />
      </>
    );
  }

  if (actors.length <= maxNames + 1) {
    return (
      <>
        {actors.slice(0, -1).map((a, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ opacity: 0.6 }}>, </span>}
            <NameWithBadge name={a.name} isVerified={a.isVerified} />
          </React.Fragment>
        ))}
        <span style={{ opacity: 0.6 }}> and </span>
        <NameWithBadge
          name={actors[actors.length - 1].name}
          isVerified={actors[actors.length - 1].isVerified}
        />
      </>
    );
  }

  const remaining = actors.length - maxNames;
  return (
    <>
      {actors.slice(0, maxNames).map((a, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ opacity: 0.6 }}>, </span>}
          <NameWithBadge name={a.name} isVerified={a.isVerified} />
        </React.Fragment>
      ))}
      <span style={{ opacity: 0.6 }}>
        {" "}and {remaining} other{remaining > 1 ? "s" : ""}
      </span>
    </>
  );
}
