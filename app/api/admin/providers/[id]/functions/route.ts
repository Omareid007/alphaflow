import { NextResponse } from "next/server";
import { apiDiscoveryService } from "@/lib/admin/services";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const functions = await apiDiscoveryService.listApiFunctions(params.id);
    return NextResponse.json(functions);
  } catch (error) {
    console.error("Failed to list API functions:", error);
    return NextResponse.json(
      { error: "Failed to list API functions" },
      { status: 500 }
    );
  }
}
