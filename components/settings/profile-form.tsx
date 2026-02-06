"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, X, Check } from "lucide-react";

interface ProfileFormProps {
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export function ProfileForm({ firstName, lastName, email }: ProfileFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [first, setFirst] = useState(firstName || "");
  const [last, setLast] = useState(lastName || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update profile");
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFirst(firstName || "");
    setLast(lastName || "");
    setIsEditing(false);
    setError(null);
  };

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || "Not set";

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-muted-foreground">Email</Label>
        <p className="text-sm mt-1">{email}</p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground">Name</Label>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="h-6 px-2 text-xs"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName" className="text-xs">First Name</Label>
                <Input
                  id="firstName"
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  placeholder="First name"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                <Input
                  id="lastName"
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  placeholder="Last name"
                  disabled={isLoading}
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isLoading || (!first.trim() && !last.trim())}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm mt-1">{displayName}</p>
        )}
      </div>
    </div>
  );
}
