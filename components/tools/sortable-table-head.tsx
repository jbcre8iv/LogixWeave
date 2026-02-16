"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TableHead } from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface SortableTableHeadProps {
  column: string;
  defaultOrder?: "asc" | "desc";
  className?: string;
  children: React.ReactNode;
}

export function SortableTableHead({
  column,
  defaultOrder = "asc",
  className,
  children,
}: SortableTableHeadProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get("sort");
  const currentOrder = searchParams.get("order") || "asc";
  const isActive = currentSort === column;

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (isActive) {
      params.set("order", currentOrder === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", column);
      params.set("order", defaultOrder);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const Icon = isActive
    ? currentOrder === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <TableHead
      className={`cursor-pointer select-none ${className || ""}`}
      onClick={handleClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <Icon
          className={`h-3.5 w-3.5 ${isActive ? "opacity-100" : "opacity-30"}`}
        />
      </span>
    </TableHead>
  );
}
