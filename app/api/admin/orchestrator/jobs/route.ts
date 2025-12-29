import { NextResponse } from "next/server";
import { orchestratorService } from "@/lib/admin/services";

export async function GET() {
  try {
    const jobs = await orchestratorService.getRecentRuns(20);
    return NextResponse.json(jobs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to get jobs" }, { status: 500 });
  }
}
