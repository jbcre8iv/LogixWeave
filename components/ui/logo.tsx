"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, showText = true, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const widthMap = {
    sm: showText ? 150 : 45,
    md: showText ? 200 : 60,
    lg: showText ? 250 : 75,
  };

  const heightMap = {
    sm: 24,
    md: 32,
    lg: 40,
  };

  return (
    <Image
      src="/logixweaver-logo.svg"
      alt="LogixWeaver"
      width={widthMap[size]}
      height={heightMap[size]}
      className={cn(sizeClasses[size], className)}
      priority
    />
  );
}

// Icon-only version for compact spaces
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 70 70"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
    >
      <defs>
        <linearGradient id="weaveGradIcon" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#3B82F6" }} />
          <stop offset="100%" style={{ stopColor: "#8B5CF6" }} />
        </linearGradient>
      </defs>
      <g transform="translate(5, 5)">
        {/* Horizontal lines (warp) */}
        <rect x="0" y="8" width="60" height="6" rx="3" fill="url(#weaveGradIcon)" />
        <rect x="0" y="28" width="60" height="6" rx="3" fill="url(#weaveGradIcon)" />
        <rect x="0" y="48" width="60" height="6" rx="3" fill="url(#weaveGradIcon)" />

        {/* Vertical lines (weft) */}
        <rect x="8" y="0" width="6" height="14" rx="3" fill="#3B82F6" />
        <rect x="8" y="22" width="6" height="20" rx="3" fill="#3B82F6" />
        <rect x="8" y="48" width="6" height="14" rx="3" fill="#3B82F6" />

        <rect x="27" y="0" width="6" height="8" rx="3" fill="#6366F1" />
        <rect x="27" y="14" width="6" height="20" rx="3" fill="#6366F1" />
        <rect x="27" y="40" width="6" height="22" rx="3" fill="#6366F1" />

        <rect x="46" y="0" width="6" height="14" rx="3" fill="#8B5CF6" />
        <rect x="46" y="22" width="6" height="20" rx="3" fill="#8B5CF6" />
        <rect x="46" y="48" width="6" height="14" rx="3" fill="#8B5CF6" />

        {/* Connection nodes */}
        <circle cx="11" cy="31" r="4" fill="#10B981" />
        <circle cx="30" cy="11" r="4" fill="#10B981" />
        <circle cx="49" cy="51" r="4" fill="#10B981" />
      </g>
    </svg>
  );
}
