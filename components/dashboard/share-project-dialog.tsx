"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Share2, Loader2, X, UserPlus, Eye, Pencil, Crown, ArrowRightLeft } from "lucide-react";

interface Share {
  id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  permission: "view" | "edit" | "owner";
  created_at: string;
  accepted_at: string | null;
}

interface ShareProjectDialogProps {
  projectId: string;
  projectName: string;
  isCreator?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ShareProjectDialog({ projectId, projectName, isCreator = true, open: controlledOpen, onOpenChange }: ShareProjectDialogProps) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"view" | "edit" | "owner">("view");
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingShares, setIsLoadingShares] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string>("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [includeNamingRules, setIncludeNamingRules] = useState(true);
  const [ruleSetInfo, setRuleSetInfo] = useState<{
    ruleSetId: string | null;
    ruleSetName: string | null;
    ruleCount: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchShares();
    }
  }, [open]);

  // Fetch rule set info when transfer dialog opens
  useEffect(() => {
    if (transferDialogOpen) {
      fetch(`/api/projects/${projectId}/rule-set`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ruleSetId) setRuleSetInfo(data);
          else setRuleSetInfo(null);
        })
        .catch(() => setRuleSetInfo(null));
    }
  }, [transferDialogOpen, projectId]);

  // Get accepted share holders eligible for transfer (must have accepted and have a user ID)
  const transferCandidates = shares.filter((s) => s.accepted_at && s.shared_with_user_id);

  const fetchShares = async () => {
    setIsLoadingShares(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`);
      if (response.ok) {
        const data = await response.json();
        setShares(data);
      }
    } catch {
      console.error("Failed to fetch shares");
    } finally {
      setIsLoadingShares(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), permission }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to share project");
      }

      setEmail("");
      setPermission("view");
      fetchShares();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/shares?shareId=${shareId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setShares(shares.filter((s) => s.id !== shareId));
        router.refresh();
      }
    } catch {
      console.error("Failed to remove share");
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: "view" | "edit" | "owner") => {
    try {
      const response = await fetch(`/api/projects/${projectId}/shares`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, permission: newPermission }),
      });

      if (response.ok) {
        setShares(shares.map((s) =>
          s.id === shareId ? { ...s, permission: newPermission } : s
        ));
        router.refresh();
      }
    } catch {
      console.error("Failed to update permission");
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTargetId) return;

    setIsTransferring(true);
    setTransferError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/shares`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newOwnerUserId: transferTargetId,
          includeNamingRules: ruleSetInfo ? includeNamingRules : false,
          sourceRuleSetId: ruleSetInfo?.ruleSetId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to transfer ownership");
      }

      setTransferDialogOpen(false);
      setOpen(false);
      // Ownership changed — full page refresh to reflect new state
      window.location.reload();
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {controlledOpen === undefined && (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Share &ldquo;{projectName}&rdquo;</DialogTitle>
            <DialogDescription>
              Invite people to view or edit this project
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleShare} className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="email" className="sr-only">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={permission}
                  onValueChange={(v) => setPermission(v as "view" | "edit" | "owner")}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">
                      <div className="flex items-center gap-2">
                        <Eye className="h-3 w-3" />
                        Can view
                      </div>
                    </SelectItem>
                    <SelectItem value="edit">
                      <div className="flex items-center gap-2">
                        <Pencil className="h-3 w-3" />
                        Can edit
                      </div>
                    </SelectItem>
                    {isCreator && (
                      <SelectItem value="owner">
                        <div className="flex items-center gap-2">
                          <Crown className="h-3 w-3" />
                          Owner
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={isLoading || !email.trim()} className="flex-1">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Share
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </form>

          <div className="mt-4">
            <Label className="text-sm text-muted-foreground">People with access</Label>

            {isLoadingShares ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                This project isn&apos;t shared with anyone yet
              </p>
            ) : (
              <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                {shares.map((share) => {
                  const isOwnerShare = share.permission === "owner";
                  const canModifyThisShare = isCreator || !isOwnerShare;

                  return (
                    <div
                      key={share.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                          {share.shared_with_email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {share.shared_with_email}
                          </p>
                          {!share.accepted_at && (
                            <p className="text-xs text-yellow-600">Pending invite</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canModifyThisShare ? (
                          <Select
                            value={share.permission}
                            onValueChange={(v) => handleUpdatePermission(share.id, v as "view" | "edit" | "owner")}
                          >
                            <SelectTrigger className="h-8 w-auto min-w-fit text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="view">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-3 w-3" />
                                  Can view
                                </div>
                              </SelectItem>
                              <SelectItem value="edit">
                                <div className="flex items-center gap-2">
                                  <Pencil className="h-3 w-3" />
                                  Can edit
                                </div>
                              </SelectItem>
                              {isCreator && (
                                <SelectItem value="owner">
                                  <div className="flex items-center gap-2">
                                    <Crown className="h-3 w-3" />
                                    Owner
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2 flex items-center gap-1.5">
                            <Crown className="h-3 w-3" />
                            Owner
                          </span>
                        )}
                        {canModifyThisShare && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveShare(share.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Transfer Ownership section — only visible to creator */}
          {isCreator && transferCandidates.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Transfer Ownership</p>
                  <p className="text-xs text-muted-foreground">
                    Make someone else the project owner
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTransferTargetId("");
                    setTransferError(null);
                    setIncludeNamingRules(true);
                    setRuleSetInfo(null);
                    setTransferDialogOpen(true);
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer ownership confirmation dialog */}
      <AlertDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Ownership</AlertDialogTitle>
            <AlertDialogDescription>
              Select a collaborator to become the new project owner. You will retain owner-level access as a collaborator.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <Select
              value={transferTargetId}
              onValueChange={setTransferTargetId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select new owner..." />
              </SelectTrigger>
              <SelectContent>
                {transferCandidates.map((share) => (
                  <SelectItem key={share.id} value={share.shared_with_user_id!}>
                    {share.shared_with_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {ruleSetInfo && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="include-naming-rules"
                  checked={includeNamingRules}
                  onCheckedChange={(v) => setIncludeNamingRules(!!v)}
                />
                <label htmlFor="include-naming-rules" className="text-sm leading-tight cursor-pointer">
                  Include naming rule set
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    Copy &ldquo;{ruleSetInfo.ruleSetName}&rdquo; ({ruleSetInfo.ruleCount} rules) to the new owner&apos;s organization
                  </span>
                </label>
              </div>
            )}

            {transferTargetId && (
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                This will make <strong>{transferCandidates.find((s) => s.shared_with_user_id === transferTargetId)?.shared_with_email}</strong> the project owner. You&apos;ll retain owner-level access.
              </p>
            )}

            {transferError && (
              <p className="text-sm text-destructive">{transferError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransferring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleTransferOwnership();
              }}
              disabled={!transferTargetId || isTransferring}
            >
              {isTransferring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transferring...
                </>
              ) : (
                "Transfer Ownership"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
