import { NextRequest, NextResponse } from 'next/server';
import { getBot } from '@/lib/bot';
import { CONFIG, isBotConfigured } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isBotConfigured()) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN is not configured in environment variables.' },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = (body.url || `${CONFIG.appUrl}/api/webhook`).trim();

    if (!targetUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Telegram requires an HTTPS webhook URL. Localhost without an HTTPS tunnel (e.g. ngrok) is not supported by Telegram.' },
        { status: 400 }
      );
    }

    const bot = getBot();
    const secretToken = body.secretToken || CONFIG.telegramSecretToken || undefined;

    await bot.api.setWebhook(targetUrl, {
      secret_token: secretToken,
      drop_pending_updates: Boolean(body.dropPending),
      allowed_updates: [
        'message',
        'edited_message',
        'callback_query',
        'business_connection',
        'business_message',
        'edited_business_message',
        'deleted_business_messages',
        'channel_post',
        'edited_channel_post',
      ],
    });

    const info = await bot.api.getWebhookInfo();

    return NextResponse.json({
      ok: true,
      message: 'Telegram Webhook set successfully!',
      webhook: info,
    });
  } catch (err: unknown) {
    console.error('Error setting webhook:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE() {
  if (!isBotConfigured()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured.' }, { status: 400 });
  }

  try {
    const bot = getBot();
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    return NextResponse.json({ ok: true, message: 'Telegram Webhook deleted.' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
