import React from "react";

interface SectionHeaderProps {
  label: string;
}

/**
 * Sticky-ish section header above a contiguous run of notification rows.
 * Labels are produced by `getTimeSection()` ("Today" / "Yesterday" /
 * "This Week" / "This Month" / "Earlier").
 */
export function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <h3
      className="px-4 pt-4 pb-1 text-sm font-semibold"
      style={{ fontFamily: "var(--heading-font)" }}
    >
      {label}
    </h3>
  );
}
