import { NextResponse } from "next/server";
import { apiDiscoveryService } from "@/lib/admin/services";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; funcId: string } }
) {
  try {
    const data = await request.json();
    const updated = await apiDiscoveryService.updateApiFunction(
      params.funcId,
      data
    );
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update API function:", error);
    return NextResponse.json(
      { error: "Failed to update API function" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; funcId: string } }
) {
  try {
    await apiDiscoveryService.deleteApiFunction(params.funcId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete API function:", error);
    return NextResponse.json(
      { error: "Failed to delete API function" },
      { status: 500 }
    );
  }
}
