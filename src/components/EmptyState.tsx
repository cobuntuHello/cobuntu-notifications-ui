import React, { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

/**
 * Centered empty state used for both tabs (Activity + Requests) when
 * the BE returns zero rows. Icon defaults to a bell glyph.
 */
export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div
        className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "rgba(128,128,128,0.06)" }}
      >
        {icon ?? (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ opacity: 0.3 }}
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        )}
      </div>
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="text-sm mt-1" style={{ opacity: 0.4 }}>{description}</p>}
    </div>
  );
}
