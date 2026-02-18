"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "migration-banner-dismissed";

export function MigrationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isOldDomain = window.location.hostname === "logix-weave.vercel.app";
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (isOldDomain && !dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="relative bg-amber-500 text-white text-sm text-center px-4 py-2">
      <span>
        We&apos;ve moved! Bookmark our new home at{" "}
        <a
          href="https://www.logixweave.com"
          className="font-semibold underline underline-offset-2 hover:text-white/90"
        >
          www.logixweave.com
        </a>
      </span>
      <button
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
