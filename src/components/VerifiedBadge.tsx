import React from "react";

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

/**
 * Small inline checkmark badge shown next to premium-verified actors.
 * Color uses --brand-color so it inherits whitelabel theming.
 */
export function VerifiedBadge({ size = 14, className = "" }: VerifiedBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`inline-block align-middle ml-0.5 ${className}`}
      style={{ color: "var(--brand-color, #1d9bf0)" }}
      aria-label="Verified"
    >
      <path
        d="M12 2L14.5 4.5L18 4L19 7.5L22 9L21 12.5L23 15L21 17.5L20 21L16.5 21.5L14 23L12 22L10 23L7.5 21.5L4 21L3 17.5L1 15L3 12.5L2 9L5 7.5L6 4L9.5 4.5L12 2Z"
        fill="currentColor"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
