import { NextResponse } from 'next/server';
import { providerService } from '@/lib/admin/services';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await providerService.testConnection(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Test failed' }, { status: 500 });
  }
}
