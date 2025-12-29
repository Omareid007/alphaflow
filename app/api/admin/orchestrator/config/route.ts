import { NextResponse } from "next/server";
import { orchestratorService } from "@/lib/admin/services";

export async function GET() {
  try {
    const config = await orchestratorService.getConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const config = await orchestratorService.updateConfig(data);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}
