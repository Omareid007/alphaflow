import { NextResponse } from 'next/server';
import { providerService } from '@/lib/admin/services';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const credentials = await providerService.listCredentials(params.id);
    return NextResponse.json(credentials);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list credentials' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { kind, value } = await request.json();
    const credential = await providerService.addCredential(params.id, kind, value);
    return NextResponse.json(credential);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to add credential' }, { status: 500 });
  }
}
