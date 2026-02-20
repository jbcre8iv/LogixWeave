"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, AlertCircle, AlertTriangle, Info } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  pattern: string;
  applies_to: string;
  severity: string;
}

interface RuleSetPreviewProps {
  ruleSetName: string;
  rules: Rule[];
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "error":
      return (
        <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Warning
        </Badge>
      );
    case "info":
      return (
        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
          <Info className="h-3 w-3 mr-1" />
          Info
        </Badge>
      );
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

function getAppliesTo(appliesTo: string) {
  switch (appliesTo) {
    case "all":
      return "All tags";
    case "controller":
      return "Controller";
    case "program":
      return "Program";
    default:
      return appliesTo;
  }
}

export function RuleSetPreview({ ruleSetName, rules }: RuleSetPreviewProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
          <span className="sr-only">View active rules</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-fit">
        <DialogHeader>
          <DialogTitle>{ruleSetName}</DialogTitle>
          <DialogDescription>
            {rules.length} active rule{rules.length === 1 ? "" : "s"} in this set
          </DialogDescription>
        </DialogHeader>
        {rules.length > 0 ? (
          <div className="overflow-auto max-h-[70vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {rule.pattern}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getAppliesTo(rule.applies_to)}
                    </TableCell>
                    <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active rules in this set.
          </p>
        )}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
