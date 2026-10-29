import React, { ReactNode } from "react";
import { formatCount, listSeparators, pluralCategory, type TextOptions } from "../utils/intlText";
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
  maxNamesOrOptions: number | (TextOptions & { maxNames?: number }) = 2,
): ReactNode {
  /*
   * Second argument stayed positional-compatible on purpose: it is exported
   * from the package root, so cobuntu-frontend may be calling
   * renderActorNames(actors, 2) today and must keep working untouched.
   */
  const options =
    typeof maxNamesOrOptions === "number" ? { maxNames: maxNamesOrOptions } : maxNamesOrOptions;
  const maxNames = options.maxNames ?? 2;
  const { locale, labels } = options;
  const text = (key: string, fallback: string) => {
    const supplied = labels?.[key];
    return typeof supplied === "string" && supplied !== "" ? supplied : fallback;
  };

  /*
   * The names are NODES -- each carries its own verified badge -- so they
   * cannot be handed to Intl.ListFormat.format(). listSeparators() asks the
   * locale for the literal pieces it puts between list items and hands them
   * back in order, and they are interleaved here. The list ends up punctuated
   * by the locale without the package ever flattening the names to a string.
   */
  const interleave = (nodes: ReactNode[]): ReactNode => {
    const separators = listSeparators(nodes.length, locale);
    return (
      <>
        {nodes.map((node, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ opacity: 0.6 }}>{separators[i - 1]}</span>}
            {node}
          </React.Fragment>
        ))}
      </>
    );
  };
  if (actors.length === 0) {
    return <span className="font-medium">{text("actors_someone", "Someone")}</span>;
  }
  if (actors.length === 1) {
    return <NameWithBadge name={actors[0].name} isVerified={actors[0].isVerified} />;
  }

  const named = (slice: typeof actors) =>
    slice.map((a, i) => <NameWithBadge key={i} name={a.name} isVerified={a.isVerified} />);

  // Everyone fits: one list, punctuated by the locale.
  if (actors.length <= maxNames + 1) return interleave(named(actors));

  /*
   * Too many to name. The tail is "N others", whose noun agrees with N by
   * PLURAL CATEGORY rather than by "is it 1" -- Polish has three categories
   * and Arabic six, so one/many picks the wrong word in most of them.
   */
  const remaining = actors.length - maxNames;
  const others = text(
    `actors_others_${pluralCategory(remaining, locale)}`,
    remaining === 1 ? "{count} other" : "{count} others",
  ).replace("{count}", formatCount(remaining, locale));

  return interleave([
    ...named(actors.slice(0, maxNames)),
    <span key="others" style={{ opacity: 0.6 }}>{others}</span>,
  ]);
}
