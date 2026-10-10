import { NextRequest, NextResponse } from 'next/server';
import { getBot } from '@/lib/bot';
import { CONFIG, isBotConfigured } from '@/lib/config';
import { GeminiService } from '@/lib/gemini';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Check authorization header for Vercel Cron
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  if (!isBotConfigured()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured.' }, { status: 503 });
  }

  // If no allowed user is configured, we can't send a briefing
  const recipientIds = CONFIG.allowedUserIds;
  if (!recipientIds || recipientIds.length === 0) {
    return NextResponse.json({
      message: 'No recipient user IDs configured in ALLOWED_TELEGRAM_USER_IDS. Skipping briefing.',
    });
  }

  try {
    const bot = getBot();
    const briefingPrompt = 
      `Generate a quick, inspiring Morning Briefing for a busy professional.
Include:
1. Today's Date & Motivational Quote
2. 3 High-Impact Focus Tips for the day
3. Brief tech/AI thought of the day
Format cleanly with emojis and bullet points for Telegram.`;

    const briefingText = await GeminiService.generateChatResponse({
      prompt: briefingPrompt,
    });

    const results = [];
    for (const userId of recipientIds) {
      try {
        await bot.api.sendMessage(userId, `☀️ *DAILY AUTOMATED BRIEFING*\n\n${briefingText}`, {
          parse_mode: 'Markdown',
        });
        results.push({ userId, status: 'sent' });
      } catch (sendErr: unknown) {
        const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        results.push({ userId, status: 'failed', error: errMsg });
      }
    }

    await StorageService.addLog({
      userId: recipientIds[0],
      eventType: 'automation_trigger',
      summary: `Automated Cron Briefing dispatched to ${results.length} user(s)`,
    });

    return NextResponse.json({ ok: true, results });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
