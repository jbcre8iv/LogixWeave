import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: 32,
        }}
      >
        <svg viewBox="0 0 64 64" width="140" height="140">
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
      </div>
    ),
    { ...size }
  );
}
