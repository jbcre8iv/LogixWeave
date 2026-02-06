"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Ban, Trash2, UserCheck, Loader2 } from "lucide-react";

interface UserActionsProps {
  userId: string;
  userEmail: string;
  userName: string | null;
  isDisabled?: boolean;
  isCurrentUser: boolean;
  isPlatformAdmin: boolean;
}

export function UserActions({
  userId,
  userEmail,
  userName,
  isDisabled = false,
  isCurrentUser,
  isPlatformAdmin,
}: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  // Don't show actions for current user or other admins
  if (isCurrentUser || isPlatformAdmin) {
    return null;
  }

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete user");
      }
    } catch (error) {
      alert("Failed to delete user");
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleToggleDisabled = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, disabled: !isDisabled }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update user status");
      }
    } catch (error) {
      alert("Failed to update user status");
    } finally {
      setLoading(false);
      setDisableDialogOpen(false);
    }
  };

  const displayName = userName || userEmail;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>User Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDisableDialogOpen(true)}>
            {isDisabled ? (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Enable User
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Disable User
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Disable/Enable Dialog */}
      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isDisabled ? "Enable User?" : "Disable User?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDisabled ? (
                <>
                  This will re-enable <strong>{displayName}</strong>&apos;s account,
                  allowing them to log in again.
                </>
              ) : (
                <>
                  This will prevent <strong>{displayName}</strong> from logging in.
                  Their data will be preserved but they won&apos;t be able to access the platform.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleDisabled}>
              {isDisabled ? "Enable User" : "Disable User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{displayName}</strong>&apos;s account
              and all associated data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Their profile</li>
                <li>Organizations they own (if sole owner)</li>
                <li>All projects and files in those organizations</li>
              </ul>
              <p className="mt-2 font-medium text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
