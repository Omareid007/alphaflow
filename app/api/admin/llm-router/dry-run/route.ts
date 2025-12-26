import { NextResponse } from 'next/server';
import { llmRouterService } from '@/lib/admin/services';

export async function POST(request: Request) {
  try {
    const { taskType, promptLength, tier } = await request.json();
    const result = await llmRouterService.dryRunRouting(taskType, promptLength, tier);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Dry run failed' }, { status: 500 });
  }
}
