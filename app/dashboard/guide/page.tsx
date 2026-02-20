import { Card, CardContent } from "@/components/ui/card";
import {
  Rocket,
  Search,
  BarChart3,
  ScrollText,
  Sparkles,
  BookOpen,
  GitCompareArrows,
  Users,
  Download,
} from "lucide-react";

const sections = [
  { label: "Getting Started", anchor: "getting-started", icon: Rocket, color: "text-emerald-500" },
  { label: "Exploring Your Data", anchor: "explore", icon: Search, color: "text-blue-500" },
  { label: "Analysis & Health Scores", anchor: "analysis", icon: BarChart3, color: "text-violet-500" },
  { label: "Naming Validation", anchor: "naming", icon: ScrollText, color: "text-rose-500" },
  { label: "AI Tools", anchor: "ai-tools", icon: Sparkles, color: "text-amber-500" },
  { label: "Project Manual", anchor: "project-manual", icon: BookOpen, color: "text-teal-500" },
  { label: "File Compare", anchor: "file-compare", icon: GitCompareArrows, color: "text-orange-500" },
  { label: "Collaboration & Sharing", anchor: "collaboration", icon: Users, color: "text-indigo-500" },
  { label: "Exporting Data", anchor: "export", icon: Download, color: "text-cyan-500" },
] as const;

export default function GuidePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Help Guide</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Learn how to get the most out of LogixWeave
        </p>
      </div>

      <div className="max-w-4xl space-y-10">
        {/* Table of Contents */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Contents
            </h2>
            <nav className="grid gap-1 sm:grid-cols-2">
              {sections.map(({ label, anchor, icon: Icon, color }) => (
                <a
                  key={anchor}
                  href={`#${anchor}`}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-base hover:bg-accent transition-colors"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                  {label}
                </a>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <section id="getting-started" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Rocket className="h-5 w-5 text-emerald-500" />
            Getting Started
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            LogixWeave helps you analyze and document Rockwell Automation PLC
            projects. Start by creating a project, then upload your exported
            program files.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              Create a new project from the dashboard and give it a descriptive
              name.
            </li>
            <li>
              Upload <strong className="text-foreground">.L5X</strong> or{" "}
              <strong className="text-foreground">.L5K</strong> files exported
              from Studio 5000 Logix Designer. ACD files must be exported first
              — LogixWeave does not read ACD directly.
            </li>
            <li>
              Files are automatically parsed on upload. LogixWeave extracts
              tags, routines, modules, data types, add-on instructions, tasks,
              and more.
            </li>
            <li>
              Once parsing completes, your project dashboard populates with
              analysis data — ready to explore.
            </li>
          </ul>
        </section>

        {/* Exploring Your Data */}
        <section id="explore" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Exploring Your Data
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            After uploading, use the data explorer tabs to browse every aspect
            of your PLC project.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              <strong className="text-foreground">Tag Explorer</strong> —
              Search, filter, and view detailed information for every tag
              including data type, scope, description, and cross-references.
            </li>
            <li>
              <strong className="text-foreground">I/O Mapping</strong> — Browse
              the module tree to see how physical I/O is wired to your
              controller.
            </li>
            <li>
              <strong className="text-foreground">User-Defined Types</strong> —
              Inspect UDT definitions and their member structures.
            </li>
            <li>
              <strong className="text-foreground">Add-On Instructions</strong>{" "}
              — View AOI definitions, parameters, and internal logic.
            </li>
          </ul>
        </section>

        {/* Analysis & Health Scores */}
        <section id="analysis" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            Analysis &amp; Health Scores
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            The Analysis tab gives you a high-level overview of your project
            quality through a weighted health score.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              The overall health score is composed of weighted categories:{" "}
              <strong className="text-foreground">tag efficiency</strong>,{" "}
              <strong className="text-foreground">documentation coverage</strong>,{" "}
              <strong className="text-foreground">tag usage</strong>,{" "}
              <strong className="text-foreground">naming compliance</strong>, and{" "}
              <strong className="text-foreground">task configuration</strong>.
            </li>
            <li>
              Each category is scored independently and combined into a single
              0–100 score.
            </li>
            <li>
              Use the <strong className="text-foreground">Improve Score</strong>{" "}
              recommendations to identify actionable steps that will raise your
              health score.
            </li>
            <li>
              Scores update automatically when you re-upload an updated file or
              adjust naming rules.
            </li>
          </ul>
        </section>

        {/* Naming Validation */}
        <section id="naming" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-rose-500" />
            Naming Validation
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Enforce consistent tag naming conventions across your project using
            configurable rule sets.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              Apply built-in rule sets or create custom rules with regex
              patterns, scope filters, and severity levels (error, warning,
              info).
            </li>
            <li>
              Each rule can be toggled individually. Disable rules you
              don&apos;t need without deleting them.
            </li>
            <li>
              Control whether naming compliance is included in your health
              score via the health score toggle.
            </li>
            <li>
              Organization admins can configure shared naming rules in{" "}
              <strong className="text-foreground">Settings &rarr; Naming Rules</strong>{" "}
              to enforce standards across the team.
            </li>
          </ul>
        </section>

        {/* AI Tools */}
        <section id="ai-tools" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Tools
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            AI-powered tools help you understand, troubleshoot, and improve your
            PLC programs.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              <strong className="text-foreground">Chat Assistant</strong> — Ask
              questions about your project in your own words. The AI has full
              context of your parsed data and can answer questions about tags,
              logic, and configuration.
            </li>
            <li>
              <strong className="text-foreground">Logic Explainer</strong> —
              Select a routine or rung and get a step-by-step explanation of
              what the logic does.
            </li>
            <li>
              <strong className="text-foreground">Issue Finder</strong> — Scan
              your project for potential bugs, unused references, and logic
              issues.
            </li>
            <li>
              <strong className="text-foreground">Health Coach</strong> — Get
              personalized recommendations for improving your project health
              score over time.
            </li>
          </ul>
        </section>

        {/* Project Manual */}
        <section id="project-manual" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-500" />
            Project Manual
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Generate a comprehensive reference document for your PLC project
            that you can share with your team.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              Select which sections to include — tags, routines, I/O, UDTs,
              AOIs, and more.
            </li>
            <li>
              Choose between{" "}
              <strong className="text-foreground">Standard</strong> mode (data
              tables and structured summaries) or{" "}
              <strong className="text-foreground">Comprehensive</strong> mode
              (AI-generated narratives and explanations).
            </li>
            <li>
              Export as PDF, DOCX, or Markdown — ready for documentation
              systems, handoffs, or archival.
            </li>
          </ul>
        </section>

        {/* File Compare */}
        <section id="file-compare" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-orange-500" />
            File Compare
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Compare two PLC files to identify what changed between versions or
            across projects.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              Side-by-side comparison highlights added, removed, and modified
              tags, routines, and configuration.
            </li>
            <li>
              Use folder comparison to compare all files within two project
              folders at once.
            </li>
            <li>
              Version history comparison lets you diff previous uploads of the
              same file.
            </li>
            <li>
              Cross-project support — compare files from different projects to
              track divergence.
            </li>
          </ul>
        </section>

        {/* Collaboration & Sharing */}
        <section id="collaboration" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Collaboration &amp; Sharing
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Share projects with teammates and manage access levels to
            collaborate effectively.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              Share a project with other users by email. Choose a permission
              level:{" "}
              <strong className="text-foreground">Viewer</strong> (read-only),{" "}
              <strong className="text-foreground">Editor</strong> (can modify),
              or <strong className="text-foreground">Owner</strong> (full
              control).
            </li>
            <li>
              Transfer ownership of a project to another user when
              responsibilities change.
            </li>
            <li>
              Organizations and team management allow admins to set shared
              standards and manage members.
            </li>
          </ul>
        </section>

        {/* Exporting Data */}
        <section id="export" className="scroll-mt-6 space-y-3">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Download className="h-5 w-5 text-cyan-500" />
            Exporting Data
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            Export your analysis results and documentation in various formats.
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1.5 text-base text-muted-foreground">
            <li>
              <strong className="text-foreground">XLSX</strong> — Export
              analysis data and tag lists as Excel spreadsheets from the
              Analysis tab.
            </li>
            <li>
              <strong className="text-foreground">CSV</strong> — Export naming
              validation results for further processing or reporting.
            </li>
            <li>
              <strong className="text-foreground">Project Manual</strong> — For
              full project documentation, use the Project Manual feature to
              export as PDF, DOCX, or Markdown.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
