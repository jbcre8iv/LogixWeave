"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUp, Loader2, Pencil, Crown } from "lucide-react";

interface RequestPermissionDialogProps {
  projectId: string;
  projectName: string;
  currentPermission: "view" | "edit";
}

export function RequestPermissionDialog({
  projectId,
  projectName,
  currentPermission,
}: RequestPermissionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestedPermission, setRequestedPermission] = useState<"edit" | "owner">(
    currentPermission === "view" ? "edit" : "owner"
  );
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/permission-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedPermission, message: message.trim() || null }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled>
            <ArrowUp className="h-4 w-4 mr-2" />
            Request Sent
          </Button>
        </DialogTrigger>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowUp className="h-4 w-4 mr-2" />
          Request Access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Higher Access</DialogTitle>
          <DialogDescription>
            Request additional permissions for "{projectName}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Requested Permission</Label>
            <Select
              value={requestedPermission}
              onValueChange={(v) => setRequestedPermission(v as "edit" | "owner")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentPermission === "view" && (
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Pencil className="h-3 w-3" />
                      Edit Access
                    </div>
                  </SelectItem>
                )}
                <SelectItem value="owner">
                  <div className="flex items-center gap-2">
                    <Crown className="h-3 w-3" />
                    Owner Access
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Why do you need this access?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowUp className="h-4 w-4 mr-2" />
              )}
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
