"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";

interface AvatarUploadProps {
  avatarUrl: string | null;
  fullName: string | null;
  email: string;
}

export function AvatarUpload({ avatarUrl, fullName, email }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : email[0].toUpperCase();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload");
      }

      setCurrentAvatar(data.avatar_url);
      router.refresh();
    } catch (error) {
      console.error("Upload failed:", error);
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async () => {
    setIsUploading(true);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove avatar");
      }

      setCurrentAvatar(null);
      router.refresh();
    } catch (error) {
      console.error("Remove failed:", error);
      alert("Failed to remove avatar");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <Avatar className="h-20 w-20">
        <AvatarImage src={currentAvatar || undefined} alt={fullName || email} />
        <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
      </Avatar>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload photo
          </DropdownMenuItem>
          {currentAvatar && (
            <DropdownMenuItem onClick={handleRemove} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove photo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
