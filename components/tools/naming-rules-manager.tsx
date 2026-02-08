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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, AlertCircle, AlertTriangle, Info, MoreHorizontal, Star, FolderPlus } from "lucide-react";

interface NamingRule {
  id: string;
  rule_set_id: string;
  name: string;
  description: string | null;
  pattern: string;
  applies_to: string;
  severity: string;
  is_active: boolean;
}

interface NamingRuleSet {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  naming_rules: NamingRule[];
}

interface NamingRulesManagerProps {
  ruleSets: NamingRuleSet[];
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

export function NamingRulesManager({ ruleSets: initialRuleSets, isAdmin }: NamingRulesManagerProps) {
  const router = useRouter();
  const [ruleSets, setRuleSets] = useState<NamingRuleSet[]>(initialRuleSets);
  const [activeTab, setActiveTab] = useState<string>(initialRuleSets[0]?.id || "");

  // Rule form state
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NamingRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<NamingRule | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rule set form state
  const [isAddSetDialogOpen, setIsAddSetDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<NamingRuleSet | null>(null);
  const [deleteSet, setDeleteSet] = useState<NamingRuleSet | null>(null);
  const [setFormData, setSetFormData] = useState({ name: "", description: "" });

  const [ruleFormData, setRuleFormData] = useState({
    name: "",
    description: "",
    pattern: "",
    applies_to: "all",
    severity: "warning",
    is_active: true,
  });

  const resetRuleForm = () => {
    setRuleFormData({
      name: "",
      description: "",
      pattern: "",
      applies_to: "all",
      severity: "warning",
      is_active: true,
    });
    setError(null);
  };

  const resetSetForm = () => {
    setSetFormData({ name: "", description: "" });
    setError(null);
  };

  const activeRuleSet = ruleSets.find((rs) => rs.id === activeTab);

  // ---- Rule Set CRUD ----

  const handleCreateRuleSet = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/naming-rule-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setFormData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create rule set");
      }
      const { ruleSet } = await response.json();
      setRuleSets([...ruleSets, ruleSet]);
      setActiveTab(ruleSet.id);
      setIsAddSetDialogOpen(false);
      resetSetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameRuleSet = async () => {
    if (!editingSet) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/naming-rule-sets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSet.id,
          name: setFormData.name,
          description: setFormData.description,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update rule set");
      }
      const { ruleSet } = await response.json();
      setRuleSets(ruleSets.map((rs) => (rs.id === ruleSet.id ? ruleSet : rs)));
      setEditingSet(null);
      resetSetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetAsDefault = async (ruleSetId: string) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/naming-rule-sets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleSetId, is_default: true }),
      });
      if (!response.ok) throw new Error("Failed to set default");
      // Update local state: unset old default, set new one
      setRuleSets(
        ruleSets.map((rs) => ({
          ...rs,
          is_default: rs.id === ruleSetId,
        }))
      );
      router.refresh();
    } catch {
      console.error("Failed to set default rule set");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRuleSet = async () => {
    if (!deleteSet) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/naming-rule-sets?id=${deleteSet.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete rule set");
      }
      const remaining = ruleSets.filter((rs) => rs.id !== deleteSet.id);
      setRuleSets(remaining);
      if (activeTab === deleteSet.id && remaining.length > 0) {
        setActiveTab(remaining[0].id);
      }
      setDeleteSet(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Rule CRUD ----

  const openEditRuleDialog = (rule: NamingRule) => {
    setEditingRule(rule);
    setRuleFormData({
      name: rule.name,
      description: rule.description || "",
      pattern: rule.pattern,
      applies_to: rule.applies_to,
      severity: rule.severity,
      is_active: rule.is_active,
    });
    setError(null);
  };

  const handleSubmitRule = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      try {
        new RegExp(ruleFormData.pattern);
      } catch {
        setError("Invalid regex pattern");
        setIsSubmitting(false);
        return;
      }

      const method = editingRule ? "PUT" : "POST";
      const body = editingRule
        ? { id: editingRule.id, ...ruleFormData }
        : { ...ruleFormData, rule_set_id: activeTab };

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

      setRuleSets(
        ruleSets.map((rs) => {
          if (rs.id !== (editingRule?.rule_set_id || activeTab)) return rs;
          return {
            ...rs,
            naming_rules: editingRule
              ? rs.naming_rules.map((r) => (r.id === rule.id ? rule : r))
              : [...rs.naming_rules, rule],
          };
        })
      );

      setIsAddRuleDialogOpen(false);
      setEditingRule(null);
      resetRuleForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteRule) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/naming-rules?id=${deleteRule.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete rule");

      setRuleSets(
        ruleSets.map((rs) => ({
          ...rs,
          naming_rules: rs.naming_rules.filter((r) => r.id !== deleteRule.id),
        }))
      );
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
      if (!response.ok) throw new Error("Failed to update rule");
      const { rule: updatedRule } = await response.json();
      setRuleSets(
        ruleSets.map((rs) => ({
          ...rs,
          naming_rules: rs.naming_rules.map((r) =>
            r.id === updatedRule.id ? updatedRule : r
          ),
        }))
      );
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

  const RuleFormContent = () => (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="rule-name">Rule Name</Label>
        <Input
          id="rule-name"
          value={ruleFormData.name}
          onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
          placeholder="e.g., No Spaces in Names"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-description">Description (optional)</Label>
        <Textarea
          id="rule-description"
          value={ruleFormData.description}
          onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
          placeholder="Explain what this rule checks for..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="rule-pattern">Regex Pattern</Label>
        <Input
          id="rule-pattern"
          value={ruleFormData.pattern}
          onChange={(e) => setRuleFormData({ ...ruleFormData, pattern: e.target.value })}
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
            value={ruleFormData.applies_to}
            onValueChange={(value) => setRuleFormData({ ...ruleFormData, applies_to: value })}
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
            value={ruleFormData.severity}
            onValueChange={(value) => setRuleFormData({ ...ruleFormData, severity: value })}
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
          id="rule-is-active"
          checked={ruleFormData.is_active}
          onCheckedChange={(checked) => setRuleFormData({ ...ruleFormData, is_active: checked })}
        />
        <Label htmlFor="rule-is-active">Active</Label>
      </div>
    </div>
  );

  if (ruleSets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No rule sets found. Contact your administrator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Rule Set button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={isAddSetDialogOpen} onOpenChange={(open) => {
            setIsAddSetDialogOpen(open);
            if (!open) resetSetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="h-4 w-4 mr-2" />
                Add Rule Set
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Rule Set</DialogTitle>
                <DialogDescription>
                  Create a new named collection of naming rules
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="set-name">Name</Label>
                  <Input
                    id="set-name"
                    value={setFormData.name}
                    onChange={(e) => setSetFormData({ ...setFormData, name: e.target.value })}
                    placeholder="e.g., Legacy Projects"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="set-description">Description (optional)</Label>
                  <Textarea
                    id="set-description"
                    value={setFormData.description}
                    onChange={(e) => setSetFormData({ ...setFormData, description: e.target.value })}
                    placeholder="Describe when to use this rule set..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddSetDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRuleSet} disabled={isSubmitting || !setFormData.name}>
                  {isSubmitting ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Rename Rule Set dialog */}
      <Dialog open={!!editingSet} onOpenChange={(open) => {
        if (!open) {
          setEditingSet(null);
          resetSetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Rule Set</DialogTitle>
            <DialogDescription>
              Update the name and description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rename-set-name">Name</Label>
              <Input
                id="rename-set-name"
                value={setFormData.name}
                onChange={(e) => setSetFormData({ ...setFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-set-description">Description (optional)</Label>
              <Textarea
                id="rename-set-description"
                value={setFormData.description}
                onChange={(e) => setSetFormData({ ...setFormData, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSet(null)}>
              Cancel
            </Button>
            <Button onClick={handleRenameRuleSet} disabled={isSubmitting || !setFormData.name}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs for rule sets */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center gap-2">
          <TabsList className="flex-wrap h-auto">
            {ruleSets.map((rs) => (
              <TabsTrigger key={rs.id} value={rs.id} className="gap-1.5">
                {rs.name}
                {rs.is_default && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-1">
                    Default
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-0.5">
                  ({rs.naming_rules.length})
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {ruleSets.map((rs) => (
          <TabsContent key={rs.id} value={rs.id}>
            <div className="space-y-4">
              {/* Tab header with actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {rs.description || `${rs.naming_rules.length} rule${rs.naming_rules.length === 1 ? "" : "s"}`}
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <>
                      <Dialog open={isAddRuleDialogOpen && activeTab === rs.id} onOpenChange={(open) => {
                        setIsAddRuleDialogOpen(open);
                        if (!open) resetRuleForm();
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Rule
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Naming Rule</DialogTitle>
                            <DialogDescription>
                              Create a new rule in &quot;{rs.name}&quot;
                            </DialogDescription>
                          </DialogHeader>
                          <RuleFormContent />
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddRuleDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSubmitRule} disabled={isSubmitting || !ruleFormData.name || !ruleFormData.pattern}>
                              {isSubmitting ? "Saving..." : "Create Rule"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!rs.is_default && (
                            <DropdownMenuItem onClick={() => handleSetAsDefault(rs.id)}>
                              <Star className="h-4 w-4 mr-2" />
                              Set as Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            setEditingSet(rs);
                            setSetFormData({
                              name: rs.name,
                              description: rs.description || "",
                            });
                          }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          {!rs.is_default && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteSet(rs)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Set
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              </div>

              {/* Rules table */}
              {rs.naming_rules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No rules in this set yet.
                  {isAdmin && " Click 'Add Rule' to create one."}
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
                      {rs.naming_rules.map((rule) => (
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
                                    resetRuleForm();
                                  }
                                }}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditRuleDialog(rule)}
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
                                    <RuleFormContent />
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setEditingRule(null)}>
                                        Cancel
                                      </Button>
                                      <Button onClick={handleSubmitRule} disabled={isSubmitting || !ruleFormData.name || !ruleFormData.pattern}>
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
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Delete Rule confirmation */}
      <AlertDialog open={!!deleteRule} onOpenChange={(open) => !open && setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule &quot;{deleteRule?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Rule Set confirmation */}
      <AlertDialog open={!!deleteSet} onOpenChange={(open) => !open && setDeleteSet(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule Set</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule set &quot;{deleteSet?.name}&quot; and all
              its {deleteSet?.naming_rules.length} rule{deleteSet?.naming_rules.length === 1 ? "" : "s"}?
              Projects using this set will fall back to the organization default.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRuleSet} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
