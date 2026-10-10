import { NextRequest, NextResponse } from 'next/server';
import { AutomationEngine } from '@/lib/automation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text || '').trim();

    if (!text) {
      return NextResponse.json({ error: 'Text prompt is required for testing' }, { status: 400 });
    }

    const mockUser = {
      id: 999999,
      username: 'tux_tester',
      firstName: 'Admin',
    };

    const result = await AutomationEngine.evaluate(text, mockUser);

    return NextResponse.json({
      ok: true,
      text,
      matched: result.matched,
      rule: result.rule || null,
      simulatedOutput: result.responseText || null,
      error: result.error || null,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
