import { NextResponse } from "next/server";
import { orchestratorService } from "@/lib/admin/services";

export async function POST(request: Request) {
  try {
    const { enabled } = await request.json();
    await orchestratorService.toggleKillSwitch(enabled);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to toggle kill switch" },
      { status: 500 }
    );
  }
}
