import { NextRequest, NextResponse } from 'next/server';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rules = await StorageService.getRules();
  return NextResponse.json({ ok: true, rules });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.triggerType || !body.triggerPattern || !body.actionType || !body.actionPayload) {
      return NextResponse.json(
        { error: 'Missing required fields: name, triggerType, triggerPattern, actionType, actionPayload' },
        { status: 400 }
      );
    }

    const saved = await StorageService.saveRule({
      id: body.id,
      name: body.name,
      description: body.description || '',
      enabled: body.enabled !== false,
      triggerType: body.triggerType,
      triggerPattern: body.triggerPattern,
      actionType: body.actionType,
      actionPayload: body.actionPayload,
      priority: Number(body.priority) || 0,
    });

    return NextResponse.json({ ok: true, rule: saved });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, enabled } = body;

    if (!id || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'id and boolean enabled are required.' }, { status: 400 });
    }

    const updated = await StorageService.toggleRule(id, enabled);
    if (!updated) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, rule: updated });
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
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    await StorageService.deleteRule(id);
    return NextResponse.json({ ok: true, message: `Rule ${id} deleted` });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
