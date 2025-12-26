import { NextResponse } from 'next/server';
import { providerService } from '@/lib/admin/services';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const metrics = await providerService.getUsageMetrics(params.id, days);
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get usage' }, { status: 500 });
  }
}
