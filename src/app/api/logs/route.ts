import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const logs = await StorageService.getLogs(limit);
  return NextResponse.json({ ok: true, logs });
}
