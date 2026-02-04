import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HardDrive, Construction } from "lucide-react";

export default function IOMapperPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">I/O Mapping</h1>
        <p className="text-muted-foreground">
          View and analyze hardware I/O configuration
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="relative">
            <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
            <Construction className="h-6 w-6 text-amber-500 absolute -bottom-1 -right-1" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            The I/O Mapping tool is currently under development. It will provide
            a visual tree view of modules, detailed module-to-tag mapping, and
            export capabilities.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">
              Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
