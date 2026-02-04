"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Plus, Trash2, Download, FileCode2, Copy } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  dataType: string;
  scope: string;
  description?: string;
  value?: string;
  usage?: string;
  radix?: string;
  externalAccess?: string;
  dimensions?: string;
}

interface BulkTagEditorProps {
  projectName: string;
  existingDataTypes: string[];
  existingScopes: string[];
}

const DATA_TYPES = [
  "BOOL", "SINT", "INT", "DINT", "LINT", "REAL", "LREAL",
  "STRING", "TIMER", "COUNTER", "CONTROL", "ALARM_ANALOG", "ALARM_DIGITAL"
];

const RADIX_OPTIONS = ["Decimal", "Binary", "Octal", "Hex", "ASCII", "Float"];

const ACCESS_OPTIONS = ["Read/Write", "Read Only", "None"];

let tagIdCounter = 0;
const generateId = () => `tag-${++tagIdCounter}`;

export function BulkTagEditor({ projectName, existingDataTypes, existingScopes }: BulkTagEditorProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [l5xPreview, setL5xPreview] = useState<string | null>(null);

  const allDataTypes = [...new Set([...DATA_TYPES, ...existingDataTypes])].sort();
  const allScopes = [...new Set(["Controller", ...existingScopes])].sort();

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/tags/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import tags");
      }

      const importedTags: Tag[] = data.tags.map((t: Omit<Tag, "id">) => ({
        ...t,
        id: generateId(),
      }));

      setTags((prev) => [...prev, ...importedTags]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setIsImporting(false);
      // Reset the input
      e.target.value = "";
    }
  }, []);

  const addTag = () => {
    setTags((prev) => [
      ...prev,
      {
        id: generateId(),
        name: "",
        dataType: "DINT",
        scope: "Controller",
      },
    ]);
  };

  const updateTag = (id: string, field: keyof Tag, value: string) => {
    setTags((prev) =>
      prev.map((tag) => (tag.id === id ? { ...tag, [field]: value } : tag))
    );
  };

  const removeTag = (id: string) => {
    setTags((prev) => prev.filter((tag) => tag.id !== id));
  };

  const clearAll = () => {
    setTags([]);
    setL5xPreview(null);
    setError(null);
  };

  const exportCSV = () => {
    const headers = ["Name", "DataType", "Scope", "Description", "Radix", "ExternalAccess", "Dimensions"];
    const rows = tags.map((tag) => [
      tag.name,
      tag.dataType,
      tag.scope,
      tag.description || "",
      tag.radix || "",
      tag.externalAccess || "",
      tag.dimensions || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Tags_Template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateL5X = async () => {
    if (tags.length === 0) {
      setError("Add at least one tag to generate L5X");
      return;
    }

    const invalidTags = tags.filter((t) => !t.name || !t.dataType);
    if (invalidTags.length > 0) {
      setError("All tags must have a name and data type");
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch("/api/export/tags-l5x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, projectName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate L5X");
      }

      const l5xContent = await response.text();
      setL5xPreview(l5xContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate L5X");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadL5X = () => {
    if (!l5xPreview) return;

    const blob = new Blob([l5xPreview], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Tags_Import.L5X`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyL5X = () => {
    if (!l5xPreview) return;
    navigator.clipboard.writeText(l5xPreview);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="editor" className="w-full">
        <TabsList>
          <TabsTrigger value="editor">Tag Editor</TabsTrigger>
          <TabsTrigger value="preview" disabled={!l5xPreview}>
            L5X Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={isImporting}
              />
              <Button variant="outline" disabled={isImporting}>
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? "Importing..." : "Import CSV"}
              </Button>
            </div>
            <Button variant="outline" onClick={addTag}>
              <Plus className="h-4 w-4 mr-2" />
              Add Tag
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={tags.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={clearAll} disabled={tags.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button onClick={generateL5X} disabled={tags.length === 0 || isExporting}>
              <FileCode2 className="h-4 w-4 mr-2" />
              {isExporting ? "Generating..." : "Generate L5X"}
            </Button>
          </div>

          {/* Tags Table */}
          {tags.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No tags added yet. Import a CSV or add tags manually.
                </p>
                <div className="flex justify-center gap-2">
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={isImporting}
                    />
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Import CSV
                    </Button>
                  </div>
                  <Button variant="outline" onClick={addTag}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tag
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name *</TableHead>
                    <TableHead className="w-[150px]">Data Type *</TableHead>
                    <TableHead className="w-[150px]">Scope</TableHead>
                    <TableHead className="w-[200px]">Description</TableHead>
                    <TableHead className="w-[100px]">Radix</TableHead>
                    <TableHead className="w-[120px]">Access</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <Input
                          value={tag.name}
                          onChange={(e) => updateTag(tag.id, "name", e.target.value)}
                          placeholder="TagName"
                          className="font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.dataType}
                          onValueChange={(v) => updateTag(tag.id, "dataType", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allDataTypes.map((dt) => (
                              <SelectItem key={dt} value={dt}>
                                {dt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.scope}
                          onValueChange={(v) => updateTag(tag.id, "scope", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allScopes.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={tag.description || ""}
                          onChange={(e) => updateTag(tag.id, "description", e.target.value)}
                          placeholder="Optional description"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.radix || ""}
                          onValueChange={(v) => updateTag(tag.id, "radix", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Default</SelectItem>
                            {RADIX_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={tag.externalAccess || ""}
                          onValueChange={(v) => updateTag(tag.id, "externalAccess", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Default</SelectItem>
                            {ACCESS_OPTIONS.map((a) => (
                              <SelectItem key={a} value={a}>
                                {a}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTag(tag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {tags.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {tags.length} tag{tags.length === 1 ? "" : "s"} ready for export
            </p>
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          {l5xPreview && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  L5X file ready for import into Studio 5000
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyL5X}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button size="sm" onClick={downloadL5X}>
                    <Download className="h-4 w-4 mr-2" />
                    Download L5X
                  </Button>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  <pre className="p-4 overflow-x-auto text-sm font-mono bg-muted/50 rounded-md max-h-[500px]">
                    {l5xPreview}
                  </pre>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
