import { NextResponse } from 'next/server';
import { apiDiscoveryService } from '@/lib/admin/services';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { documentUrl } = await request.json();

    if (!documentUrl) {
      return NextResponse.json(
        { error: 'Document URL is required' },
        { status: 400 }
      );
    }

    const result = await apiDiscoveryService.discoverApis(params.id, documentUrl);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to discover APIs:', error);
    return NextResponse.json(
      { error: 'Failed to discover APIs' },
      { status: 500 }
    );
  }
}
