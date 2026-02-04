"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus, Pencil, Trash2, AlertCircle, AlertTriangle, Info } from "lucide-react";

interface NamingRule {
  id: string;
  name: string;
  description: string | null;
  pattern: string;
  applies_to: string;
  severity: string;
  is_active: boolean;
}

interface NamingRulesManagerProps {
  rules: NamingRule[];
  isAdmin: boolean;
}

const APPLIES_TO_OPTIONS = [
  { value: "all", label: "All Tags" },
  { value: "controller", label: "Controller Tags" },
  { value: "program", label: "Program Tags" },
  { value: "io", label: "I/O Tags" },
  { value: "udt", label: "UDT Members" },
  { value: "aoi", label: "AOI Parameters" },
];

const SEVERITY_OPTIONS = [
  { value: "error", label: "Error", icon: AlertCircle, color: "text-red-500" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-yellow-500" },
  { value: "info", label: "Info", icon: Info, color: "text-blue-500" },
];

export function NamingRulesManager({ rules: initialRules, isAdmin }: NamingRulesManagerProps) {
  const router = useRouter();
  const [rules, setRules] = useState<NamingRule[]>(initialRules);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NamingRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<NamingRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    pattern: "",
    applies_to: "all",
    severity: "warning",
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      pattern: "",
      applies_to: "all",
      severity: "warning",
      is_active: true,
    });
    setError(null);
  };

  const openEditDialog = (rule: NamingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      pattern: rule.pattern,
      applies_to: rule.applies_to,
      severity: rule.severity,
      is_active: rule.is_active,
    });
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate regex pattern
      try {
        new RegExp(formData.pattern);
      } catch {
        setError("Invalid regex pattern");
        setIsSubmitting(false);
        return;
      }

      const method = editingRule ? "PUT" : "POST";
      const body = editingRule
        ? { id: editingRule.id, ...formData }
        : formData;

      const response = await fetch("/api/naming-rules", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save rule");
      }

      const { rule } = await response.json();

      if (editingRule) {
        setRules(rules.map((r) => (r.id === rule.id ? rule : r)));
      } else {
        setRules([...rules, rule]);
      }

      setIsAddDialogOpen(false);
      setEditingRule(null);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRule) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/naming-rules?id=${deleteRule.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete rule");
      }

      setRules(rules.filter((r) => r.id !== deleteRule.id));
      setDeleteRule(null);
      router.refresh();
    } catch {
      setError("Failed to delete rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (rule: NamingRule) => {
    try {
      const response = await fetch("/api/naming-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update rule");
      }

      const { rule: updatedRule } = await response.json();
      setRules(rules.map((r) => (r.id === updatedRule.id ? updatedRule : r)));
      router.refresh();
    } catch {
      console.error("Failed to toggle rule");
    }
  };

  const getSeverityBadge = (severity: string) => {
    const option = SEVERITY_OPTIONS.find((o) => o.value === severity);
    if (!option) return null;
    const Icon = option.icon;
    return (
      <Badge variant="outline" className={option.color}>
        <Icon className="h-3 w-3 mr-1" />
        {option.label}
      </Badge>
    );
  };

  const FormContent = () => (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Rule Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., No Spaces in Names"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Explain what this rule checks for..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pattern">Regex Pattern</Label>
        <Input
          id="pattern"
          value={formData.pattern}
          onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
          placeholder="e.g., ^[^\s]+$"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Tags that match this pattern will pass validation
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Applies To</Label>
          <Select
            value={formData.applies_to}
            onValueChange={(value) => setFormData({ ...formData, applies_to: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPLIES_TO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Severity</Label>
          <Select
            value={formData.severity}
            onValueChange={(value) => setFormData({ ...formData, severity: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Active</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Naming Rule</DialogTitle>
                <DialogDescription>
                  Create a new rule to validate tag naming conventions
                </DialogDescription>
              </DialogHeader>
              <FormContent />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.pattern}>
                  {isSubmitting ? "Saving..." : "Create Rule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No naming rules configured yet.
          {isAdmin && " Click 'Add Rule' to create your first rule."}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Active</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{rule.pattern}</TableCell>
                  <TableCell>
                    {APPLIES_TO_OPTIONS.find((o) => o.value === rule.applies_to)?.label || rule.applies_to}
                  </TableCell>
                  <TableCell>{getSeverityBadge(rule.severity)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                      disabled={!isAdmin}
                    />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Dialog open={editingRule?.id === rule.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingRule(null);
                            resetForm();
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(rule)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Naming Rule</DialogTitle>
                              <DialogDescription>
                                Update the rule configuration
                              </DialogDescription>
                            </DialogHeader>
                            <FormContent />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingRule(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.pattern}>
                                {isSubmitting ? "Saving..." : "Save Changes"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRule(rule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteRule} onOpenChange={(open) => !open && setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule "{deleteRule?.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
