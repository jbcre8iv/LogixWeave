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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreHorizontal, Ban, Trash2, UserCheck, Loader2, Eye, Building2, FolderOpen, FileText, Mail, Calendar, User } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  organization_name: string;
  created_at: string;
  file_count: number;
}

interface UserFile {
  id: string;
  file_name: string;
  file_size: number;
  project_name: string;
  created_at: string;
}

interface UserDetails {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_platform_admin: boolean;
  is_disabled: boolean;
  organizations: Organization[];
  projects: Project[];
  files: UserFile[];
}

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
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleViewUser = async () => {
    setViewDialogOpen(true);
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
      }
    } catch (error) {
      console.error("Failed to fetch user details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Don't show actions for current user, but still allow viewing other admins
  if (isCurrentUser) {
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
          <DropdownMenuItem onClick={handleViewUser}>
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>
          {!isPlatformAdmin && (
            <>
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
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Details
            </DialogTitle>
            <DialogDescription>
              Account information for {userName || userEmail}
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : userDetails ? (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="organizations">
                  Orgs ({userDetails.organizations.length})
                </TabsTrigger>
                <TabsTrigger value="projects">
                  Projects ({userDetails.projects.length})
                </TabsTrigger>
                <TabsTrigger value="files">
                  Files ({userDetails.files.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Full Name</p>
                    <p className="font-medium">{userDetails.full_name || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{userDetails.email}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Joined</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">
                        {new Date(userDetails.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                    <div className="flex items-center gap-2">
                      {userDetails.is_platform_admin ? (
                        <Badge className="bg-primary">Platform Admin</Badge>
                      ) : userDetails.is_disabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">User ID</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{userDetails.id}</code>
                </div>
              </TabsContent>

              <TabsContent value="organizations" className="mt-4">
                <ScrollArea className="h-[300px]">
                  {userDetails.organizations.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No organizations</p>
                  ) : (
                    <div className="space-y-2">
                      {userDetails.organizations.map((org) => (
                        <div
                          key={org.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{org.name}</span>
                          </div>
                          <Badge variant="outline" className="capitalize">{org.role}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="projects" className="mt-4">
                <ScrollArea className="h-[300px]">
                  {userDetails.projects.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No projects</p>
                  ) : (
                    <div className="space-y-2">
                      {userDetails.projects.map((project) => (
                        <div
                          key={project.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{project.name}</p>
                              <p className="text-xs text-muted-foreground">{project.organization_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary">{project.file_count} files</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="files" className="mt-4">
                <ScrollArea className="h-[300px]">
                  {userDetails.files.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No files uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {userDetails.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{file.file_name}</p>
                              <p className="text-xs text-muted-foreground">{file.project_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{(file.file_size / 1024).toFixed(1)} KB</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-muted-foreground text-center py-8">Failed to load user details</p>
          )}
        </DialogContent>
      </Dialog>

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
