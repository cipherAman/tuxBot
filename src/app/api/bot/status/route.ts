import { NextResponse } from 'next/server';
import { getBot } from '@/lib/bot';
import { CONFIG, isBotConfigured, isGeminiConfigured } from '@/lib/config';
import { StorageService } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rules = await StorageService.getRules();
  const logs = await StorageService.getLogs(10);
  const storageType = StorageService.getStorageType();

  let botInfo = null;
  let webhookInfo = null;

  if (isBotConfigured()) {
    try {
      const bot = getBot();
      const me = await bot.api.getMe();
      botInfo = {
        id: me.id,
        username: me.username,
        firstName: me.first_name,
        canJoinGroups: me.can_join_groups,
        supportsInlineQueries: me.supports_inline_queries,
      };

      const wh = await bot.api.getWebhookInfo();
      webhookInfo = {
        url: wh.url,
        hasCustomCertificate: wh.has_custom_certificate,
        pendingUpdateCount: wh.pending_update_count,
        lastErrorDate: wh.last_error_date,
        lastErrorMessage: wh.last_error_message,
      };
    } catch (err) {
      console.error('Failed to query Telegram API:', err);
    }
  }

  const activeRules = rules.filter((r) => r.enabled);
  const totalExecutions = rules.reduce((acc, r) => acc + (r.executionCount || 0), 0);

  return NextResponse.json({
    ok: true,
    bot: botInfo,
    webhook: webhookInfo,
    gemini: {
      configured: isGeminiConfigured(),
      model: CONFIG.geminiModel,
    },
    storage: {
      type: storageType,
      connected: true,
    },
    stats: {
      totalRules: rules.length,
      activeRules: activeRules.length,
      totalExecutions,
      totalLogs: logs.length,
    },
    config: {
      appUrl: CONFIG.appUrl,
      restrictedMode: CONFIG.allowedUserIds.length > 0,
      allowedUsersCount: CONFIG.allowedUserIds.length,
    },
  });
}
