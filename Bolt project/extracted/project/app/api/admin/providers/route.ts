import { NextResponse } from 'next/server';
import { providerService } from '@/lib/admin/services';

export async function GET() {
  try {
    const providers = await providerService.listProviders();
    return NextResponse.json(providers);
  } catch (error) {
    console.error('Failed to list providers:', error);
    return NextResponse.json({ error: 'Failed to list providers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const provider = await providerService.createProvider(data);
    return NextResponse.json(provider);
  } catch (error) {
    console.error('Failed to create provider:', error);
    return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 });
  }
}
