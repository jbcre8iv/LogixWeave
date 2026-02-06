"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FolderOpen,
  Upload,
  Search,
  Bot,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Network,
  Tags,
  Cpu,
  Boxes,
  FileText,
  Users,
  MessageSquare,
  Lightbulb,
  Workflow,
} from "lucide-react";

const STORAGE_KEY = "logixweave-tour-completed";

interface HelpTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoTriggered?: boolean;
}

interface TourStep {
  title: string;
  description: string;
  icons: {
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    className: string;
    delay?: string;
  }[];
  accentColor: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to LogixWeave",
    description:
      "Your toolkit for parsing, analyzing, and understanding Rockwell Automation PLC projects. Let's take a quick tour of what you can do.",
    icons: [
      {
        Icon: Workflow,
        className: "h-10 w-10 text-primary animate-tour-float",
        delay: "0s",
      },
      {
        Icon: Sparkles,
        className: "h-7 w-7 text-chart-4",
        delay: "0.2s",
      },
      {
        Icon: Network,
        className: "h-8 w-8 text-chart-3 animate-tour-float",
        delay: "0.5s",
      },
    ],
    accentColor: "from-primary/20 to-chart-3/20",
  },
  {
    title: "Create Projects",
    description:
      "Organize your PLC work into projects. Each project holds your uploaded files, analysis results, and documentation in one place.",
    icons: [
      {
        Icon: FolderOpen,
        className: "h-10 w-10 text-chart-1 animate-tour-float",
        delay: "0s",
      },
      {
        Icon: FileText,
        className: "h-6 w-6 text-chart-2",
        delay: "0.3s",
      },
      {
        Icon: Boxes,
        className: "h-7 w-7 text-chart-4 animate-tour-float",
        delay: "0.6s",
      },
    ],
    accentColor: "from-chart-1/20 to-chart-2/20",
  },
  {
    title: "Upload Files",
    description:
      "Upload L5X or L5K export files from Studio 5000. For ACD files, export as L5X from Studio 5000 first. Files are parsed automatically on upload.",
    icons: [
      {
        Icon: Upload,
        className: "h-10 w-10 text-chart-2 animate-tour-float",
        delay: "0s",
      },
      {
        Icon: FileText,
        className: "h-7 w-7 text-chart-1",
        delay: "0.2s",
      },
      {
        Icon: Cpu,
        className: "h-7 w-7 text-chart-3 animate-tour-float",
        delay: "0.4s",
      },
    ],
    accentColor: "from-chart-2/20 to-chart-1/20",
  },
  {
    title: "Explore Your Data",
    description:
      "Dive into Tag Explorer, I/O Mapping, User-Defined Types, and Add-On Instructions. Search, filter, and understand your PLC program structure.",
    icons: [
      {
        Icon: Search,
        className: "h-9 w-9 text-chart-4 animate-tour-float",
        delay: "0s",
      },
      {
        Icon: Tags,
        className: "h-7 w-7 text-chart-1",
        delay: "0.15s",
      },
      {
        Icon: Network,
        className: "h-8 w-8 text-chart-3 animate-tour-float",
        delay: "0.3s",
      },
      {
        Icon: Cpu,
        className: "h-6 w-6 text-chart-2",
        delay: "0.45s",
      },
    ],
    accentColor: "from-chart-4/20 to-chart-1/20",
  },
  {
    title: "AI Assistant",
    description:
      "Ask questions about your PLC program and get AI-powered analysis, explanations, and insights. Understand complex logic faster than ever.",
    icons: [
      {
        Icon: Bot,
        className: "h-10 w-10 text-primary animate-tour-float",
        delay: "0s",
      },
      {
        Icon: MessageSquare,
        className: "h-7 w-7 text-chart-2",
        delay: "0.2s",
      },
      {
        Icon: Lightbulb,
        className: "h-7 w-7 text-chart-5 animate-tour-float",
        delay: "0.4s",
      },
    ],
    accentColor: "from-primary/20 to-chart-5/20",
  },
  {
    title: "Export & Share",
    description:
      "Export documentation, tag lists, and analysis reports. Share projects with your team for seamless collaboration.",
    icons: [
      {
        Icon: FileDown,
        className: "h-10 w-10 text-chart-3 animate-tour-float",
        delay: "0s",
      },
      {
        Icon: Users,
        className: "h-7 w-7 text-chart-1",
        delay: "0.25s",
      },
      {
        Icon: FileText,
        className: "h-7 w-7 text-chart-4 animate-tour-float",
        delay: "0.5s",
      },
    ],
    accentColor: "from-chart-3/20 to-chart-4/20",
  },
];

export function HelpTourDialog({
  open,
  onOpenChange,
  autoTriggered = false,
}: HelpTourDialogProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const totalSteps = tourSteps.length;
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const currentStep = tourSteps[step];

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    onOpenChange(false);
    setStep(0);
  }, [onOpenChange]);

  const handleDismiss = useCallback(
    (openState: boolean) => {
      if (!openState) {
        if (dontShowAgain || !autoTriggered) {
          localStorage.setItem(STORAGE_KEY, "true");
        }
        onOpenChange(false);
        setStep(0);
      }
    },
    [dontShowAgain, autoTriggered, onOpenChange]
  );

  const goNext = useCallback(() => {
    if (isLast) {
      handleComplete();
    } else {
      setDirection("right");
      setStep((s) => s + 1);
    }
  }, [isLast, handleComplete]);

  const goBack = useCallback(() => {
    if (!isFirst) {
      setDirection("left");
      setStep((s) => s - 1);
    }
  }, [isFirst]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goNext, goBack]);

  return (
    <Dialog open={open} onOpenChange={handleDismiss}>
      <DialogContent
        className="sm:max-w-md gap-0 overflow-hidden p-0"
        showCloseButton={true}
      >
        {/* Illustration area */}
        <div
          className={`relative flex items-center justify-center h-48 bg-gradient-to-br ${currentStep.accentColor} overflow-hidden`}
        >
          <div
            key={step}
            className={`flex items-center justify-center gap-5 ${
              direction === "right"
                ? "animate-tour-slide-in-right"
                : "animate-tour-slide-in-left"
            }`}
          >
            {currentStep.icons.map(({ Icon, className, delay }, i) => (
              <div
                key={i}
                className="animate-tour-fade-in-up"
                style={{ animationDelay: delay }}
              >
                <Icon className={className} />
              </div>
            ))}
          </div>
        </div>

        {/* Content — fixed height to prevent layout shift between slides */}
        <div className="px-6 pt-5 pb-2 h-[120px] sm:h-[110px]">
          <div
            key={`content-${step}`}
            className="animate-tour-fade-in-up"
          >
            <DialogTitle className="text-xl font-semibold mb-2">
              {currentStep.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {currentStep.description}
            </DialogDescription>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 py-3">
          {tourSteps.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > step ? "right" : "left");
                setStep(i);
              }}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? "h-2.5 w-2.5 bg-primary scale-110"
                  : "h-2 w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5">
          <div className="flex items-center gap-2">
            {autoTriggered && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="rounded border-border"
                />
                Don&apos;t show again
              </label>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button size="sm" onClick={goNext}>
              {isLast ? (
                "Get Started"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
