import { NextResponse } from "next/server";
import { orchestratorService } from "@/lib/admin/services";

export async function POST(request: Request) {
  try {
    const { jobType, mode } = await request.json();
    const run = await orchestratorService.triggerRun(jobType, mode);
    return NextResponse.json(run);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
