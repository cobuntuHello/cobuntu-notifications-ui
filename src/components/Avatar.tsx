import React from "react";

interface AvatarProps {
  name?: string | null;
  imageUrl?: string | null;
  /** Override the rendered element (e.g. consumer's UserAvatar). */
  renderAvatar?: (props: { name: string; imageUrl: string | null; size: number }) => React.ReactNode;
  size?: number;
  className?: string;
}

/**
 * Default avatar primitive. Renders an `<img>` if `imageUrl` is set,
 * otherwise a circular initial-letter chip styled via CSS variables
 * (`--bg-color`, `--text-color`) so it inherits the host theme.
 *
 * Consumers can swap the rendered element via `renderAvatar` — useful
 * when the host app already ships a richer avatar (e.g. seeded persona
 * SVG fallbacks) and we want the drawer to look identical to feed +
 * chat surfaces.
 */
export function Avatar({ name, imageUrl, renderAvatar, size = 40, className = "" }: AvatarProps) {
  const safeName = (name || "").trim() || "?";
  const initial = safeName.charAt(0).toUpperCase();

  if (renderAvatar) {
    return <>{renderAvatar({ name: safeName, imageUrl: imageUrl ?? null, size })}</>;
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full shrink-0 flex items-center justify-center font-medium ${className}`}
      style={{
        width: size,
        height: size,
        background: "rgba(128,128,128,0.12)",
        color: "var(--text-color, currentColor)",
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initial}
    </div>
  );
}
