"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, ArrowUpDown } from "lucide-react";
import { UserActions } from "./user-actions";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_platform_admin: boolean;
  is_disabled: boolean;
  projectCount: number;
  fileCount: number;
}

interface AdminUsersTableProps {
  users: UserData[];
  currentUserId: string;
}

type SortField = "name" | "email" | "projects" | "files" | "joined" | "status";
type SortDirection = "asc" | "desc";

export function AdminUsersTable({ users, currentUserId }: AdminUsersTableProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("joined");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = (a.full_name || "").localeCompare(b.full_name || "");
          break;
        case "email":
          comparison = a.email.localeCompare(b.email);
          break;
        case "projects":
          comparison = a.projectCount - b.projectCount;
          break;
        case "files":
          comparison = a.fileCount - b.fileCount;
          break;
        case "joined":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "status":
          const statusA = a.is_platform_admin ? 2 : a.is_disabled ? 0 : 1;
          const statusB = b.is_platform_admin ? 2 : b.is_disabled ? 0 : 1;
          comparison = statusA - statusB;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [users, search, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={`${sortField}-${sortDirection}`}
          onValueChange={(value) => {
            const [field, direction] = value.split("-") as [SortField, SortDirection];
            setSortField(field);
            setSortDirection(direction);
          }}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="joined-desc">Newest first</SelectItem>
            <SelectItem value="joined-asc">Oldest first</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="email-asc">Email A-Z</SelectItem>
            <SelectItem value="projects-desc">Most projects</SelectItem>
            <SelectItem value="files-desc">Most files</SelectItem>
            <SelectItem value="status-desc">Admins first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedUsers.length} of {users.length} users
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("name")}
            >
              User {sortField === "name" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("email")}
            >
              Email {sortField === "email" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("projects")}
            >
              Projects {sortField === "projects" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("files")}
            >
              Files {sortField === "files" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("joined")}
            >
              Joined {sortField === "joined" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:text-foreground"
              onClick={() => handleSort("status")}
            >
              Status {sortField === "status" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                No users found matching your search
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedUsers.map((u) => (
              <TableRow key={u.id} className={u.is_disabled ? "opacity-50" : ""}>
                <TableCell className="font-medium">
                  {u.full_name || "—"}
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.projectCount}</TableCell>
                <TableCell>{u.fileCount}</TableCell>
                <TableCell>
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {u.is_platform_admin ? (
                    <Badge className="bg-primary">Admin</Badge>
                  ) : u.is_disabled ? (
                    <Badge variant="destructive">Disabled</Badge>
                  ) : (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <UserActions
                    userId={u.id}
                    userEmail={u.email}
                    userName={u.full_name}
                    isDisabled={u.is_disabled || false}
                    isCurrentUser={u.id === currentUserId}
                    isPlatformAdmin={u.is_platform_admin || false}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
