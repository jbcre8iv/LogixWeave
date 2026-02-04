import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get file IDs for this project
    const { data: files } = await supabase
      .from("project_files")
      .select("id")
      .eq("project_id", projectId);

    const fileIds = files?.map((f) => f.id) || [];

    if (fileIds.length === 0) {
      return NextResponse.json({
        summary: {
          totalRungs: 0,
          commentedRungs: 0,
          coveragePercent: 0,
        },
        byProgram: [],
        byRoutine: [],
      });
    }

    // Get all rungs
    const { data: rungs } = await supabase
      .from("parsed_rungs")
      .select("program_name, routine_name, comment")
      .in("file_id", fileIds);

    if (!rungs || rungs.length === 0) {
      return NextResponse.json({
        summary: {
          totalRungs: 0,
          commentedRungs: 0,
          coveragePercent: 0,
        },
        byProgram: [],
        byRoutine: [],
      });
    }

    // Calculate overall coverage
    const totalRungs = rungs.length;
    const commentedRungs = rungs.filter((r) => r.comment && r.comment.trim() !== "").length;
    const coveragePercent = totalRungs > 0 ? Math.round((commentedRungs / totalRungs) * 100) : 0;

    // Calculate coverage by program
    const programMap = new Map<string, { total: number; commented: number }>();
    rungs.forEach((rung) => {
      const program = rung.program_name;
      if (!programMap.has(program)) {
        programMap.set(program, { total: 0, commented: 0 });
      }
      const stats = programMap.get(program)!;
      stats.total++;
      if (rung.comment && rung.comment.trim() !== "") {
        stats.commented++;
      }
    });

    const byProgram = Array.from(programMap.entries())
      .map(([name, stats]) => ({
        name,
        totalRungs: stats.total,
        commentedRungs: stats.commented,
        coveragePercent: stats.total > 0 ? Math.round((stats.commented / stats.total) * 100) : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Calculate coverage by routine
    const routineMap = new Map<string, { program: string; total: number; commented: number }>();
    rungs.forEach((rung) => {
      const key = `${rung.program_name}::${rung.routine_name}`;
      if (!routineMap.has(key)) {
        routineMap.set(key, { program: rung.program_name, total: 0, commented: 0 });
      }
      const stats = routineMap.get(key)!;
      stats.total++;
      if (rung.comment && rung.comment.trim() !== "") {
        stats.commented++;
      }
    });

    const byRoutine = Array.from(routineMap.entries())
      .map(([key, stats]) => {
        const [programName, routineName] = key.split("::");
        return {
          programName,
          routineName,
          totalRungs: stats.total,
          commentedRungs: stats.commented,
          coveragePercent: stats.total > 0 ? Math.round((stats.commented / stats.total) * 100) : 0,
        };
      })
      .sort((a, b) => {
        const programCompare = a.programName.localeCompare(b.programName);
        if (programCompare !== 0) return programCompare;
        return a.routineName.localeCompare(b.routineName);
      });

    return NextResponse.json({
      summary: {
        totalRungs,
        commentedRungs,
        coveragePercent,
      },
      byProgram,
      byRoutine,
    });
  } catch (error) {
    console.error("Comment coverage API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
