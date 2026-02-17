"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileSidebar } from "./mobile-sidebar";
import { NotificationsDropdown } from "./notifications-dropdown";
import { HelpTourDialog } from "./help-tour-dialog";
import { FeedbackDialog } from "./feedback-dialog";
import { LogOut, User, Settings, Scale, MessageSquareMore, Home, HelpCircle } from "lucide-react";
import { getDisplayName, getInitials } from "@/lib/utils/display-name";

interface HeaderProps {
  user: {
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  isPlatformAdmin?: boolean;
}

export function Header({ user, isPlatformAdmin }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [helpTourOpen, setHelpTourOpen] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const tourCompleted = localStorage.getItem("logixweave-tour-completed");
    if (!tourCompleted) {
      setAutoTriggered(true);
      setHelpTourOpen(true);
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <MobileSidebar isPlatformAdmin={isPlatformAdmin} />
        <h1 className="text-lg font-semibold">Studio 5000 Toolkit</h1>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsDropdown />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                {displayName !== user.email && (
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                )}
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/")}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Account</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Support</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => { setAutoTriggered(false); setHelpTourOpen(true); }}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Take a Tour
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
              <MessageSquareMore className="mr-2 h-4 w-4" />
              Feedback
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/legal")}>
              <Scale className="mr-2 h-4 w-4" />
              Terms & Privacy
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <HelpTourDialog
        open={helpTourOpen}
        onOpenChange={setHelpTourOpen}
        autoTriggered={autoTriggered}
      />
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        userEmail={user.email}
      />
    </header>
  );
}
