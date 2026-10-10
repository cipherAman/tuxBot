import { NextRequest, NextResponse } from 'next/server';
import { getBot } from '@/lib/bot';
import { CONFIG, isBotConfigured } from '@/lib/config';
import { webhookCallback } from 'grammy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    botConfigured: isBotConfigured(),
    message: 'TuxBot Webhook endpoint is active and listening for Telegram updates via POST.',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  if (!isBotConfigured()) {
    console.error('TELEGRAM_BOT_TOKEN is not configured.');
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN is missing. Please configure it in your Vercel / environment settings.' },
      { status: 503 }
    );
  }

  // Verify secret token header if configured
  if (CONFIG.telegramSecretToken) {
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (incomingSecret !== CONFIG.telegramSecretToken) {
      console.warn('Unauthorized webhook request: secret token mismatch');
      return NextResponse.json({ error: 'Unauthorized secret token' }, { status: 401 });
    }
  }

  try {
    const bot = getBot();
    const handleUpdate = webhookCallback(bot, 'std/http', {
      timeoutMilliseconds: 15000,
    });
    return await handleUpdate(req);
  } catch (err: unknown) {
    console.error('Error handling webhook update:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
