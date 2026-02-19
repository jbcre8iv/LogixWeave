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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, AlertCircle, AlertTriangle, Info, MoreHorizontal, Star, FolderPlus, X, Sparkles, Loader2 } from "lucide-react";

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

const RULE_TEMPLATES = [
  {
    category: "General Hygiene",
    templates: [
      { name: "No Spaces in Names", description: "Tag names must not contain whitespace characters", pattern: "^[^\\s]+$", severity: "error" },
      { name: "Start with Letter", description: "Tag names must begin with a letter", pattern: "^[A-Za-z]", severity: "error" },
      { name: "Alphanumeric & Underscores Only", description: "Tag names may only contain letters, digits, and underscores", pattern: "^[A-Za-z0-9_]+$", severity: "error" },
      { name: "Max Length 40 Characters", description: "Tag names must not exceed 40 characters", pattern: "^.{1,40}$", severity: "error" },
      { name: "No Consecutive Underscores", description: "Tag names should not contain double underscores (e.g., My__Tag)", pattern: "^(?!.*__)", severity: "warning" },
      { name: "No Trailing Underscore", description: "Tag names should not end with an underscore", pattern: "[^_]$", severity: "warning" },
    ],
  },
  {
    category: "Naming Style",
    templates: [
      { name: "UPPER_CASE with Underscores", description: "Tags should follow UPPER_CASE naming (e.g., MOTOR_RUN)", pattern: "^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$", severity: "info" },
      { name: "Mixed_Case with Underscores", description: "Tags should follow Mixed_Case naming (e.g., Motor_Run)", pattern: "^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)*$", severity: "info" },
      { name: "CamelCase", description: "Tags should follow CamelCase naming (e.g., MotorRun)", pattern: "^[A-Z][a-zA-Z0-9]*$", severity: "info" },
    ],
  },
  {
    category: "Prefix Conventions",
    templates: [
      { name: "I/O Type Prefix (DI_, DO_, AI_, AO_)", description: "Tags should start with an I/O type prefix", pattern: "^(DI|DO|AI|AO)_", severity: "warning" },
      { name: "Equipment Type Prefix (MTR_, VLV_, PMP_, etc.)", description: "Tags should start with an equipment type prefix", pattern: "^(MTR|VLV|PMP|TNK|FAN|CVR|HX|CMP)_", severity: "warning" },
      { name: "Area Prefix (e.g., A01_)", description: "Tags should start with an area code prefix (letter + digits + underscore)", pattern: "^[A-Z]\\d{1,3}_", severity: "warning" },
    ],
  },
];

const ALL_TEMPLATES_FLAT = RULE_TEMPLATES.flatMap((g) => g.templates);

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

  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);

  // AI regex helper state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState<{
    name: string; description: string; pattern: string; severity: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [ruleFormData, setRuleFormData] = useState({
    name: "",
    description: "",
    pattern: "",
    applies_to: "all",
    severity: "warning",
    is_active: true,
    rule_set_id: "",
  });

  const isBatchMode = !editingRule && selectedTemplateNames.length >= 2;

  const handleTemplateClick = (template: { name: string; description: string; pattern: string; severity: string }) => {
    if (editingRule) {
      // Edit mode: single-select, replaces previous
      setSelectedTemplateNames([template.name]);
      setRuleFormData((prev) => ({
        ...prev,
        name: template.name,
        description: template.description,
        pattern: template.pattern,
        severity: template.severity,
      }));
      return;
    }

    // Add mode: multi-select toggle
    const isSelected = selectedTemplateNames.includes(template.name);
    const next = isSelected
      ? selectedTemplateNames.filter((n) => n !== template.name)
      : [...selectedTemplateNames, template.name];

    setSelectedTemplateNames(next);

    if (next.length === 1) {
      const t = ALL_TEMPLATES_FLAT.find((t) => t.name === next[0])!;
      setRuleFormData((prev) => ({
        ...prev,
        name: t.name,
        description: t.description,
        pattern: t.pattern,
        severity: t.severity,
      }));
    } else if (next.length === 0) {
      setRuleFormData((prev) => ({
        ...prev,
        name: "",
        description: "",
        pattern: "",
        severity: "warning",
      }));
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);
    try {
      const response = await fetch("/api/ai/naming-regex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiPrompt.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate regex");
      }
      setAiResult(data);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to generate regex");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAiResult = () => {
    if (!aiResult) return;
    setRuleFormData((prev) => ({
      ...prev,
      name: aiResult.name,
      description: aiResult.description,
      pattern: aiResult.pattern,
      severity: aiResult.severity,
    }));
    setSelectedTemplateNames([]);
    setAiPrompt("");
    setAiResult(null);
    setAiError(null);
  };

  const handleDismissAiResult = () => {
    setAiResult(null);
  };

  const resetRuleForm = () => {
    setRuleFormData({
      name: "",
      description: "",
      pattern: "",
      applies_to: "all",
      severity: "warning",
      is_active: true,
      rule_set_id: "",
    });
    setSelectedTemplateNames([]);
    setAiPrompt("");
    setAiResult(null);
    setAiError(null);
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
      rule_set_id: rule.rule_set_id,
    });
    setSelectedTemplateNames([]);
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

      const targetRuleSetId = ruleFormData.rule_set_id || activeTab;
      const method = editingRule ? "PUT" : "POST";
      const body = editingRule
        ? { id: editingRule.id, ...ruleFormData, rule_set_id: targetRuleSetId }
        : { ...ruleFormData, rule_set_id: targetRuleSetId };

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

      if (editingRule && editingRule.rule_set_id !== targetRuleSetId) {
        // Rule moved to a different set — remove from old, add to new
        setRuleSets(
          ruleSets.map((rs) => {
            if (rs.id === editingRule.rule_set_id) {
              return { ...rs, naming_rules: rs.naming_rules.filter((r) => r.id !== rule.id) };
            }
            if (rs.id === targetRuleSetId) {
              return { ...rs, naming_rules: [...rs.naming_rules, rule] };
            }
            return rs;
          })
        );
      } else {
        setRuleSets(
          ruleSets.map((rs) => {
            if (rs.id !== targetRuleSetId) return rs;
            return {
              ...rs,
              naming_rules: editingRule
                ? rs.naming_rules.map((r) => (r.id === rule.id ? rule : r))
                : [...rs.naming_rules, rule],
            };
          })
        );
      }

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

  const handleBatchAddRules = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const targetRuleSetId = ruleFormData.rule_set_id || activeTab;
      const templates = selectedTemplateNames
        .map((name) => ALL_TEMPLATES_FLAT.find((t) => t.name === name))
        .filter(Boolean) as typeof ALL_TEMPLATES_FLAT;

      const createdRules: NamingRule[] = [];

      for (const template of templates) {
        const response = await fetch("/api/naming-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            pattern: template.pattern,
            applies_to: ruleFormData.applies_to,
            severity: template.severity,
            is_active: ruleFormData.is_active,
            rule_set_id: targetRuleSetId,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to create rule "${template.name}"`);
        }

        const { rule } = await response.json();
        createdRules.push(rule);
      }

      setRuleSets(
        ruleSets.map((rs) => {
          if (rs.id !== targetRuleSetId) return rs;
          return {
            ...rs,
            naming_rules: [...rs.naming_rules, ...createdRules],
          };
        })
      );

      setIsAddRuleDialogOpen(false);
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

  const ruleFormContent = (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Template picker — dropdown per category */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Quick Start from Template</Label>
          {!editingRule && selectedTemplateNames.length >= 2 && (
            <span className="text-xs text-muted-foreground">
              {selectedTemplateNames.length} selected
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {RULE_TEMPLATES.map((group) => (
            <DropdownMenu key={group.category}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  {group.category}
                  {!editingRule && selectedTemplateNames.some((n) =>
                    group.templates.some((t) => t.name === n)
                  ) && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">
                      {selectedTemplateNames.filter((n) =>
                        group.templates.some((t) => t.name === n)
                      ).length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {group.templates.map((template) => (
                  <DropdownMenuItem
                    key={template.name}
                    onClick={() => handleTemplateClick(template)}
                    className={cn(
                      selectedTemplateNames.includes(template.name) && "bg-primary/10 text-primary"
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{template.name}</span>
                      <span className="text-xs text-muted-foreground">{template.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
        </div>
      </div>

      <Separator />

      {/* AI Regex Helper — hidden in batch mode */}
      {!isBatchMode && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <Label className="text-sm font-medium">AI Rule Helper</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            e.g. &quot;Must start with an area code like A01_ or B02_&quot;
          </p>
          <div className="flex gap-2">
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAiGenerate();
                }
              }}
              placeholder="Describe a naming convention in your own words..."
              className="border-amber-500/20 focus-visible:ring-amber-500/30"
              disabled={aiLoading}
            />
            <Button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || !aiPrompt.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Generate"
              )}
            </Button>
          </div>
          {aiError && (
            <p className="text-sm text-destructive">{aiError}</p>
          )}
          {aiResult && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{aiResult.name}</p>
                {getSeverityBadge(aiResult.severity)}
              </div>
              <p className="text-xs text-muted-foreground">{aiResult.description}</p>
              <code className="block text-xs font-mono bg-muted/50 rounded px-2 py-1">
                {aiResult.pattern}
              </code>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleApplyAiResult} className="bg-amber-500 hover:bg-amber-600 text-white">
                  Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismissAiResult}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          <Separator />
        </div>
      )}

      {isBatchMode ? (
        <>
          {/* Batch preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Rules to create ({selectedTemplateNames.length})
            </Label>
            <div className="rounded-md border divide-y">
              {selectedTemplateNames.map((name) => {
                const t = ALL_TEMPLATES_FLAT.find((tmpl) => tmpl.name === name);
                if (!t) return null;
                return (
                  <div key={name} className="flex items-center justify-between px-3 py-2 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getSeverityBadge(t.severity)}
                      <button
                        type="button"
                        onClick={() => handleTemplateClick(t)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Rule Set</Label>
              <Select
                value={ruleFormData.rule_set_id || activeTab}
                onValueChange={(value) => setRuleFormData({ ...ruleFormData, rule_set_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ruleSets.map((rs) => (
                    <SelectItem key={rs.id} value={rs.id}>
                      {rs.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Applies To (all rules)</Label>
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
            <div className="flex items-center gap-2 self-end pb-1">
              <Switch
                id="batch-is-active"
                checked={ruleFormData.is_active}
                onCheckedChange={(checked) => setRuleFormData({ ...ruleFormData, is_active: checked })}
              />
              <Label htmlFor="batch-is-active">Active</Label>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Single rule form */}
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              value={ruleFormData.name}
              onChange={(e) => {
                setRuleFormData({ ...ruleFormData, name: e.target.value });
                setSelectedTemplateNames([]);
              }}
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
              onChange={(e) => {
                setRuleFormData({ ...ruleFormData, pattern: e.target.value });
                setSelectedTemplateNames([]);
              }}
              placeholder="e.g., ^[^\s]+$"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Tags that match this pattern will pass validation
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Rule Set</Label>
              <Select
                value={ruleFormData.rule_set_id || activeTab}
                onValueChange={(value) => setRuleFormData({ ...ruleFormData, rule_set_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ruleSets.map((rs) => (
                    <SelectItem key={rs.id} value={rs.id}>
                      {rs.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
        </>
      )}
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
                        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Add Naming Rule</DialogTitle>
                            <DialogDescription>
                              Create a new rule in &quot;{rs.name}&quot;
                            </DialogDescription>
                          </DialogHeader>
                          {ruleFormContent}
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddRuleDialogOpen(false)}>
                              Cancel
                            </Button>
                            {isBatchMode ? (
                              <Button onClick={handleBatchAddRules} disabled={isSubmitting}>
                                {isSubmitting ? "Adding..." : `Add ${selectedTemplateNames.length} Rules`}
                              </Button>
                            ) : (
                              <Button onClick={handleSubmitRule} disabled={isSubmitting || !ruleFormData.name || !ruleFormData.pattern}>
                                {isSubmitting ? "Saving..." : "Create Rule"}
                              </Button>
                            )}
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
                                  <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                                    <DialogHeader>
                                      <DialogTitle>Edit Naming Rule</DialogTitle>
                                      <DialogDescription>
                                        Update the rule configuration
                                      </DialogDescription>
                                    </DialogHeader>
                                    {ruleFormContent}
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
