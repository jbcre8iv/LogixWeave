"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ArrowUpDown, Eye, CheckCircle, CircleDot, Trash2, MoreHorizontal } from "lucide-react";

interface FeedbackItem {
  id: string;
  user_email: string;
  type: string;
  subject: string;
  description: string;
  created_at: string;
  read_at: string | null;
}

interface AdminFeedbackTableProps {
  feedback: FeedbackItem[];
}

type SortOption = "newest" | "oldest" | "type";
type FilterType = "all" | "Bug Report" | "Feature Request" | "Enhancement" | "Question";

const typeBadgeVariant: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  "Bug Report": "destructive",
  "Feature Request": "default",
  "Enhancement": "secondary",
  "Question": "outline",
};

function isRead(item: FeedbackItem): boolean {
  return typeof item.read_at === "string" && item.read_at.length > 0;
}

export function AdminFeedbackTable({ feedback: initialFeedback }: AdminFeedbackTableProps) {
  const router = useRouter();
  const [feedback, setFeedback] = useState(initialFeedback);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [viewItem, setViewItem] = useState<FeedbackItem | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const notifyFeedbackChanged = useCallback(() => {
    router.refresh();
    window.dispatchEvent(new CustomEvent("feedback-updated"));
  }, [router]);

  const filteredAndSorted = useMemo(() => {
    let result = [...feedback];

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.subject.toLowerCase().includes(searchLower) ||
          f.description.toLowerCase().includes(searchLower) ||
          f.user_email.toLowerCase().includes(searchLower)
      );
    }

    if (filterType !== "all") {
      result = result.filter((f) => f.type === filterType);
    }

    result.sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "type":
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    return result;
  }, [feedback, search, sort, filterType]);

  const handleToggleRead = async (feedbackId: string, markUnread: boolean) => {
    setLoading(feedbackId);
    try {
      const res = await fetch("/api/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackId,
          ...(markUnread ? { action: "mark_unread" } : {}),
        }),
      });

      if (res.ok) {
        setFeedback((prev) =>
          prev.map((f) =>
            f.id === feedbackId
              ? { ...f, read_at: markUnread ? null : new Date().toISOString() }
              : f
          )
        );
        notifyFeedbackChanged();
      }
    } catch (error) {
      console.error("Failed to update feedback:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (feedbackId: string) => {
    setLoading(feedbackId);
    try {
      const res = await fetch(`/api/feedback?id=${feedbackId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setFeedback((prev) => prev.filter((f) => f.id !== feedbackId));
        if (viewItem?.id === feedbackId) setViewItem(null);
        notifyFeedbackChanged();
      }
    } catch (error) {
      console.error("Failed to delete feedback:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject, description, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Bug Report">Bug Report</SelectItem>
            <SelectItem value="Feature Request">Feature Request</SelectItem>
            <SelectItem value="Enhancement">Enhancement</SelectItem>
            <SelectItem value="Question">Question</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="type">Type</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSorted.length} of {feedback.length} feedback items
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No feedback found
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSorted.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Badge variant={typeBadgeVariant[item.type] || "default"}>
                    {item.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{item.user_email}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {item.subject}
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(item.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {isRead(item) ? (
                    <Badge variant="secondary">Read</Badge>
                  ) : (
                    <Badge variant="default">Unread</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewItem(item)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={loading === item.id}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isRead(item) ? (
                          <DropdownMenuItem onClick={() => handleToggleRead(item.id, true)}>
                            <CircleDot className="h-4 w-4 mr-2" />
                            Mark as Unread
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleToggleRead(item.id, false)}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark as Read
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={!!viewItem} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewItem && (
                <Badge variant={typeBadgeVariant[viewItem.type] || "default"}>
                  {viewItem.type}
                </Badge>
              )}
              {viewItem?.subject}
            </DialogTitle>
            <DialogDescription>
              From {viewItem?.user_email} on{" "}
              {viewItem && new Date(viewItem.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 whitespace-pre-wrap text-sm">
            {viewItem?.description}
          </div>
          {viewItem && (
            <div className="mt-4 flex justify-end gap-2">
              {isRead(viewItem) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleToggleRead(viewItem.id, true);
                    setViewItem(null);
                  }}
                  disabled={loading === viewItem.id}
                >
                  <CircleDot className="h-4 w-4 mr-2" />
                  Mark as Unread
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    handleToggleRead(viewItem.id, false);
                    setViewItem(null);
                  }}
                  disabled={loading === viewItem.id}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Read
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
