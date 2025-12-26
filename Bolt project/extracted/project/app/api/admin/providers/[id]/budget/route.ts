import { NextResponse } from 'next/server';
import { providerService } from '@/lib/admin/services';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const budget = await providerService.getBudget(params.id);
    return NextResponse.json(budget);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get budget' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await request.json();
    const budget = await providerService.updateBudget(params.id, data);
    return NextResponse.json(budget);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}
