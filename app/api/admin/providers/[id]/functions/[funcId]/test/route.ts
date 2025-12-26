import { NextResponse } from 'next/server';
import { apiDiscoveryService } from '@/lib/admin/services';

export async function POST(
  request: Request,
  { params }: { params: { id: string; funcId: string } }
) {
  try {
    const result = await apiDiscoveryService.testApiFunction(params.funcId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to test API function:', error);
    return NextResponse.json(
      { error: 'Failed to test API function' },
      { status: 500 }
    );
  }
}
