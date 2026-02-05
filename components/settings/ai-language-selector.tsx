"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "es", name: "Español", flag: "🇪🇸" },
];

interface AILanguageSelectorProps {
  currentLanguage: string;
}

export function AILanguageSelector({ currentLanguage }: AILanguageSelectorProps) {
  const [language, setLanguage] = useState(currentLanguage || "en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleLanguageChange = async (value: string) => {
    setLanguage(value);
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_language: value }),
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Failed to save language preference:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="ai-language">AI Response Language</Label>
      <p className="text-sm text-muted-foreground mb-2">
        Choose the language for AI-generated explanations and analysis
      </p>
      <div className="flex items-center gap-3">
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger id="ai-language" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <span className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {saved && <Check className="h-4 w-4 text-green-500" />}
      </div>
    </div>
  );
}
