import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const contacts = await StorageService.getContacts();
  return NextResponse.json({ ok: true, contacts });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const saved = await StorageService.saveContact({
      id: body.id,
      name: body.name,
      telegramId: body.telegramId ? Number(body.telegramId) : undefined,
      username: body.username,
      category: body.category || 'client',
      customInstructions: body.customInstructions,
      escalateUrgent: Boolean(body.escalateUrgent),
    });

    return NextResponse.json({ ok: true, contact: saved });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 });
    }

    const success = await StorageService.deleteContact(id);
    return NextResponse.json({ ok: success });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
