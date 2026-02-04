import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tags, HardDrive, FileCode2, Upload, ArrowRight, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              LW
            </div>
            <span className="font-semibold text-lg">LogixWeave</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Studio 5000 Toolkit
          <br />
          <span className="text-muted-foreground">for Modern Engineers</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Parse L5X/L5K files, explore tags, analyze I/O configurations, and
          generate documentation for your Rockwell PLC projects.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/signup">
              Start Free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in to Dashboard</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need to work with Studio 5000 projects
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/dashboard/projects">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <Upload className="h-10 w-10 text-primary mb-2" />
                <CardTitle>File Import</CardTitle>
                <CardDescription>
                  Upload L5X or L5K files exported from Studio 5000. Files are
                  automatically parsed and indexed.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/tools/tags">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <Tags className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Tag Explorer</CardTitle>
                <CardDescription>
                  Search, filter, and export all tags. View data types, scopes,
                  descriptions, and usage across programs.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/tools/io">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <HardDrive className="h-10 w-10 text-primary mb-2" />
                <CardTitle>I/O Mapping</CardTitle>
                <CardDescription>
                  Visualize hardware configuration with module trees, slot mappings,
                  and channel assignments.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/tools/compare">
            <Card className="h-full transition-all hover:shadow-lg hover:border-primary/50 cursor-pointer">
              <CardHeader>
                <FileCode2 className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Project Compare</CardTitle>
                <CardDescription>
                  Compare two L5X files side by side. See differences in tags,
                  routines, and modules at a glance.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Built for PLC Programmers
              </h2>
              <ul className="space-y-4">
                {[
                  "No installation required - works in your browser",
                  "Secure cloud storage for your project files",
                  "Export to CSV, PDF, or Markdown",
                  "Team collaboration with organizations",
                  "Fast search across thousands of tags",
                  "Cross-reference tags with routines",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Card className="p-6">
              <CardHeader className="p-0 pb-4">
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>Get up and running in minutes</CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Create an account</p>
                    <p className="text-sm text-muted-foreground">
                      Sign up for free with your email
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Create a project</p>
                    <p className="text-sm text-muted-foreground">
                      Organize your files by project
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Upload L5X files</p>
                    <p className="text-sm text-muted-foreground">
                      Export from Studio 5000 and upload
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Explore and analyze</p>
                    <p className="text-sm text-muted-foreground">
                      Use tools to search and document
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-xl text-muted-foreground mb-8">
          Create your free account and start analyzing your PLC projects today.
        </p>
        <Button size="lg" asChild>
          <Link href="/signup">
            Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} LogixWeave. Built for Studio 5000 programmers.</p>
        </div>
      </footer>
    </div>
  );
}
