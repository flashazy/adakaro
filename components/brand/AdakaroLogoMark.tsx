"use client";

import { useId } from "react";

export interface AdakaroLogoMarkProps {
  /** Pixel width/height (square). Default 36. */
  size?: number;
  className?: string;
  /** Accessible label; set empty string to mark decorative. */
  title?: string;
}

/**
 * Adakaro brand mark (#2 direction): shield + check on a white disc,
 * on a rounded square. Colors align with Tailwind indigo (primary CTAs).
 */
export function AdakaroLogoMark({
  size = 36,
  className = "",
  title = "Adakaro",
}: AdakaroLogoMarkProps) {
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        {/* indigo-700 → indigo-600 → indigo-800 (matches bg-indigo-600 family) */}
        <linearGradient
          id={`${uid}-frame`}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4338ca" />
          <stop offset="0.5" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#3730a3" />
        </linearGradient>
        {/* indigo-400 → indigo-600 → indigo-800 */}
        <linearGradient
          id={`${uid}-shield`}
          x1="32"
          y1="14"
          x2="32"
          y2="44"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="0.42" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#3730a3" />
        </linearGradient>
        <filter
          id={`${uid}-disc`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="1"
            stdDeviation="1.2"
            floodOpacity="0.12"
          />
        </filter>
      </defs>
      {/* Rounded square frame */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="16"
        ry="16"
        fill={`url(#${uid}-frame)`}
      />
      {/* White disc */}
      <circle
        cx="32"
        cy="32"
        r="22.5"
        fill="#FFFFFF"
        filter={`url(#${uid}-disc)`}
      />
      {/* Shield */}
      <path
        d="M32 14.5 L42.2 19.4 V31.4 C42.2 37.1 38 41.6 32 44.8 C26 41.6 21.8 37.1 21.8 31.4 V19.4 Z"
        fill={`url(#${uid}-shield)`}
      />
      {/* Check */}
      <path
        d="M25.5 31.8 L29.8 36.1 L38.5 25.2"
        stroke="#FFFFFF"
        strokeWidth="2.75"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
