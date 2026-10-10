import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await StorageService.getSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await StorageService.updateSettings({
      systemPersona: body.systemPersona,
      model: body.model,
      temperature: body.temperature !== undefined ? Number(body.temperature) : undefined,
      chatMemoryLimit: body.chatMemoryLimit !== undefined ? Number(body.chatMemoryLimit) : undefined,
      restrictedMode: body.restrictedMode !== undefined ? Boolean(body.restrictedMode) : undefined,
      replyOnlyWhenOffline: body.replyOnlyWhenOffline !== undefined ? Boolean(body.replyOnlyWhenOffline) : undefined,
      offlineInactivityMinutes: body.offlineInactivityMinutes !== undefined ? Number(body.offlineInactivityMinutes) : undefined,
    });
    return NextResponse.json({ ok: true, settings: updated });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
