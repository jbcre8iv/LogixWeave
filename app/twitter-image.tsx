import { ImageResponse } from "next/og";

export const alt = "LogixWeave - Studio 5000 Toolkit";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Weave icon */}
        <svg viewBox="0 0 64 64" width="180" height="180">
          <defs>
            <linearGradient id="wg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <g transform="translate(2, 2)">
            <rect x="0" y="8" width="60" height="6" rx="3" fill="url(#wg)" />
            <rect x="0" y="28" width="60" height="6" rx="3" fill="url(#wg)" />
            <rect x="0" y="48" width="60" height="6" rx="3" fill="url(#wg)" />
            <rect x="8" y="0" width="6" height="14" rx="3" fill="#3B82F6" />
            <rect x="8" y="22" width="6" height="20" rx="3" fill="#3B82F6" />
            <rect x="8" y="48" width="6" height="14" rx="3" fill="#3B82F6" />
            <rect x="27" y="0" width="6" height="8" rx="3" fill="#6366F1" />
            <rect x="27" y="14" width="6" height="20" rx="3" fill="#6366F1" />
            <rect x="27" y="40" width="6" height="22" rx="3" fill="#6366F1" />
            <rect x="46" y="0" width="6" height="14" rx="3" fill="#8B5CF6" />
            <rect x="46" y="22" width="6" height="20" rx="3" fill="#8B5CF6" />
            <rect x="46" y="48" width="6" height="14" rx="3" fill="#8B5CF6" />
            <circle cx="11" cy="31" r="4" fill="#10B981" />
            <circle cx="30" cy="11" r="4" fill="#10B981" />
            <circle cx="49" cy="51" r="4" fill="#10B981" />
          </g>
        </svg>

        {/* Title */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 24,
          }}
        >
          <span
            style={{
              fontSize: 96,
              fontWeight: 700,
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Logix
          </span>
          <span
            style={{
              fontSize: 96,
              fontWeight: 700,
              color: "#e2e8f0",
            }}
          >
            Weave
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize: 40,
            color: "#94a3b8",
            marginTop: 12,
          }}
        >
          The Studio 5000 Toolkit for PLC analysis
        </p>
      </div>
    ),
    { ...size }
  );
}
