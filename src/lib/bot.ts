import { Bot, InlineKeyboard, Context } from 'grammy';
import { CONFIG, isBotConfigured } from './config';
import { StorageService } from './storage';
import { AutomationEngine } from './automation';
import { GeminiService } from './gemini';

let botInstance: Bot | null = null;

function buildTuxSystemInstruction(
  userName: string,
  customInstructions?: string,
  personaSetting?: string
): string {
  const basePersona = personaSetting?.trim() ? personaSetting : CONFIG.defaultPersona;

  let instruction = `${basePersona}\n\n`;
  instruction += `CURRENT CONVERSATION CONTEXT:\n`;
  instruction += `- You are chatting directly on Telegram with ${userName}.\n`;
  instruction += `- You are a real person (TUX), a college student/senior chatting on Telegram. Never reveal, mention, or admit to being an AI, LLM, bot, Gemini, ChatGPT, or virtual assistant under any circumstances.\n`;
  instruction += `- Act 100% human, chill, sharp, charismatic. Keep it natural.\n`;
  instruction += `- ONLY share JUT Connect links (PYQ, syllabus, notes, portal, app) if they explicitly ask for study resources. NEVER push academics or links unprompted.`;

  if (customInstructions) {
    instruction += `\n\nSPECIFIC CONTACT NOTES:\n${customInstructions}`;
  }

  return instruction;
}

export function getBot(): Bot {
  if (!isBotConfigured()) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  if (botInstance) {
    return botInstance;
  }

  const bot = new Bot(CONFIG.telegramBotToken);

  // Security & Authorization Middleware
  bot.use(async (ctx: Context, next) => {
    // Business messages and connections come from client chats managed by the bot
    if (ctx.businessMessage || ctx.businessConnection) {
      return next();
    }

    const from = ctx.from;
    if (!from) return next();

    const settings = await StorageService.getSettings();

    // Check user restriction if configured
    if (settings.restrictedMode && settings.allowedUserIds && settings.allowedUserIds.length > 0) {
      const isAllowed = settings.allowedUserIds.includes(from.id);
      if (!isAllowed) {
        await StorageService.addLog({
          userId: from.id,
          username: from.username,
          eventType: 'blocked',
          summary: `Unauthorized access attempt from user ${from.id} (@${from.username || 'unknown'})`,
          details: { text: ctx.message?.text },
        });

        if (ctx.message) {
          await ctx.reply(
            `🔒 *Access Restricted*\n\nTuxBot is configured as a private personal assistant.\nYour Telegram User ID is: \`${from.id}\`\n\nTo grant access, add this ID to \`ALLOWED_TELEGRAM_USER_IDS\` in your environment variables.`,
            { parse_mode: 'Markdown' }
          );
        }
        return;
      }
    }

    return next();
  });

  // --- Commands ---

  // /start
  bot.command('start', async (ctx) => {
    const from = ctx.from;
    const name = from?.first_name || 'there';

    const menu = new InlineKeyboard()
      .text('⚡ Automation Rules', 'menu_rules')
      .text('🧠 AI Modes', 'menu_modes')
      .row()
      .text('📊 System Status', 'menu_status')
      .text('🗑️ Clear Context', 'menu_clear');

    const welcomeMsg = 
      `👋 *Yo, ${name}! Tux here.*\n\n` +
      `What's up? Drop a message anytime, let's chat.\n\n` +
      `_Use the menu below to view rules or clear conversation history._`;

    await ctx.reply(welcomeMsg, {
      parse_mode: 'Markdown',
      reply_markup: menu,
    });

    if (from) {
      await StorageService.addLog({
        userId: from.id,
        username: from.username,
        eventType: 'command',
        summary: `User started the bot`,
      });
    }
  });

  // /help
  bot.command('help', async (ctx) => {
    const helpText = 
      `📖 *Tux Command Guide*\n\n` +
      `*Commands:*\n` +
      `• \`/start\` — Open the main menu\n` +
      `• \`/rules\` — View active chat automation rules\n` +
      `• \`/mode <chat|concise|coder>\` — Switch AI persona\n` +
      `• \`/clear\` — Wipe conversation memory context\n` +
      `• \`/stats\` — View execution counts & storage info\n` +
      `• \`/help\` — Display this guide`;

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  });

  // /rules
  bot.command('rules', async (ctx) => {
    const rules = await StorageService.getRules();
    const active = rules.filter((r) => r.enabled);

    let msg = `⚡ *Active Automation Rules (${active.length}/${rules.length})*\n\n`;
    active.forEach((r, idx) => {
      msg += `${idx + 1}. *${r.name}*\n`;
      msg += `   • Trigger: \`${r.triggerType}\` (${r.triggerPattern})\n`;
      msg += `   • Action: \`${r.actionType}\` | Runs: ${r.executionCount || 0}\n\n`;
    });

    msg += `_You can manage, create, and test rules via the web dashboard._`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /clear
  bot.command('clear', async (ctx) => {
    const from = ctx.from;
    if (from) {
      await StorageService.clearChatHistory(from.id);
      await ctx.reply('🧹 *Conversation context cleared!* Next message will start a fresh session.', {
        parse_mode: 'Markdown',
      });
    }
  });

  // /mode
  bot.command('mode', async (ctx) => {
    const arg = ctx.match?.trim().toLowerCase();
    const settings = await StorageService.getSettings();

    if (!arg) {
      await ctx.reply(
        `🧠 *Current AI Persona:*\n\`${settings.model}\`\n\n*Switch mode using:*\n• \`/mode chat\` — Friendly & helpful\n• \`/mode concise\` — Direct, ultra-short answers\n• \`/mode coder\` — Code-focused technical expert`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let newPersona = CONFIG.defaultPersona;
    if (arg === 'concise') {
      newPersona = 'You are TuxBot in Concise Mode. Provide ultra-short, direct, bulleted answers without conversational filler.';
    } else if (arg === 'coder') {
      newPersona = 'You are TuxBot in Coder Mode. Provide clean, production-grade code, minimal explanation, and highlight key syntax.';
    }

    await StorageService.updateSettings({ systemPersona: newPersona });
    await ctx.reply(`✅ *AI Persona updated to: ${arg.toUpperCase()}*`, { parse_mode: 'Markdown' });
  });

  // /stats
  bot.command('stats', async (ctx) => {
    const rules = await StorageService.getRules();
    const totalExec = rules.reduce((acc, r) => acc + (r.executionCount || 0), 0);
    const storageType = StorageService.getStorageType();
    const settings = await StorageService.getSettings();

    const statsMsg = 
      `📊 *TuxBot Performance & Stats*\n\n` +
      `• *Active Rules:* ${rules.filter((r) => r.enabled).length}/${rules.length}\n` +
      `• *Total Automations Executed:* ${totalExec}\n` +
      `• *AI Engine:* Google Gemini (\`${settings.model}\`)\n` +
      `• *Storage Backend:* \`${storageType.toUpperCase()}\`\n` +
      `• *Restricted Mode:* ${settings.restrictedMode ? 'Enabled 🔒' : 'Open 🌐'}\n` +
      `• *Secretary Offline-Only:* ${settings.replyOnlyWhenOffline ? 'Yes (Inactive > ' + (settings.offlineInactivityMinutes || 3) + 'm)' : 'Always reply'}`;

    await ctx.reply(statsMsg, { parse_mode: 'Markdown' });
  });

  // /away or /offline
  bot.command(['away', 'offline'], async (ctx) => {
    StorageService.setOwnerManualMode('offline');
    await ctx.reply(
      '📴 *Secretary Offline Mode: ACTIVE*\n\nYou are now set to Away. Tux will promptly assist contacts who message your personal account.',
      { parse_mode: 'Markdown' }
    );
  });

  // /online or /back
  bot.command(['online', 'back'], async (ctx) => {
    StorageService.setOwnerManualMode('online');
    StorageService.recordOwnerActivity();
    await ctx.reply(
      '🟢 *Secretary Mode: STANDBY (Online)*\n\nWelcome back! Tux will stand by and let you chat personally with contacts without auto-replying.',
      { parse_mode: 'Markdown' }
    );
  });

  // /auto
  bot.command('auto', async (ctx) => {
    StorageService.setOwnerManualMode('auto');
    const settings = await StorageService.getSettings();
    await ctx.reply(
      `⏱️ *Secretary Mode: AUTO-DETECT*\n\nTux will auto-reply only when you have been inactive for more than *${settings.offlineInactivityMinutes || 3} minutes*.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /presence
  bot.command('presence', async (ctx) => {
    const settings = await StorageService.getSettings();
    const presence = StorageService.getOwnerPresence(settings.offlineInactivityMinutes || 3);
    const modeLabel = presence.mode.toUpperCase();
    const statusLabel = presence.isOffline ? '📴 AWAY / OFFLINE (Tux will reply)' : '🟢 ONLINE (Tux is standing by)';
    const inactivityMsg = presence.minutesSinceLastActive !== undefined
      ? `Last active: ${presence.minutesSinceLastActive} min ago`
      : 'No recent activity recorded';

    await ctx.reply(
      `👔 *Secretary Presence Status*\n\n• *Mode:* \`${modeLabel}\`\n• *State:* ${statusLabel}\n• *Activity:* ${inactivityMsg}\n• *Inactivity Threshold:* ${settings.offlineInactivityMinutes || 3} mins\n\n*Change Mode:*\n• \`/offline\` — Force away\n• \`/online\` — Force active\n• \`/auto\` — Inactivity auto-detect`,
      { parse_mode: 'Markdown' }
    );
  });



  // Global error handler so the bot never crashes on unexpected API errors
  bot.catch((err) => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
  });

  // --- Inline Keyboard Callbacks ---
  bot.callbackQuery('menu_rules', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const rules = await StorageService.getRules();
    const list = rules
      .slice(0, 5)
      .map((r) => `• *${r.name}* [${r.triggerType} -> ${r.actionType}]`)
      .join('\n');
    try {
      await ctx.reply(`⚡ *Top Automation Rules:*\n\n${list}\n\n_Configure more in your web dashboard._`, {
        parse_mode: 'Markdown',
      });
    } catch {
      await ctx.reply(`⚡ Top Automation Rules:\n\n${list}\n\nConfigure more in your web dashboard.`);
    }
  });

  bot.callbackQuery('menu_modes', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      await ctx.reply(
        `🧠 *Available Modes:*\n• \`/mode chat\`\n• \`/mode concise\`\n• \`/mode coder\``,
        { parse_mode: 'Markdown' }
      );
    } catch {
      await ctx.reply(`🧠 Available Modes:\n• /mode chat\n• /mode concise\n• /mode coder`);
    }
  });

  bot.callbackQuery('menu_status', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const storage = StorageService.getStorageType();
    try {
      await ctx.reply(`🟢 *TuxBot is Online*\n• Storage: \`${storage}\`\n• Platform: Vercel Serverless`, {
        parse_mode: 'Markdown',
      });
    } catch {
      await ctx.reply(`🟢 TuxBot is Online\n• Storage: ${storage}\n• Platform: Vercel Serverless`);
    }
  });

  bot.callbackQuery('menu_clear', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    if (ctx.from) {
      await StorageService.clearChatHistory(ctx.from.id);
      try {
        await ctx.reply('🧹 *Chat memory cleared.*', { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply('🧹 Chat memory cleared.');
      }
    }
  });

  // --- Direct Document Handler ---
  bot.on('message:document', async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const doc = ctx.message.document;
    await ctx.reply(`Got the document: \`${doc.file_name || 'file'}\`. Thanks!`, { parse_mode: 'Markdown' }).catch(() => {});
  });

  // --- Main Message Dispatcher ---
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const from = ctx.from;
    if (!from) return;

    const userContext = {
      id: from.id,
      username: from.username,
      firstName: from.first_name,
    };

    // Step 1: Check Automation Engine first
    const autoResult = await AutomationEngine.evaluate(text, userContext);
    if (autoResult.matched && autoResult.responseText) {
      try {
        await ctx.reply(autoResult.responseText, { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(autoResult.responseText);
      }
      return;
    }

    // Step 2: Fallback to Conversational AI (Gemini as TUX)
    try {
      await ctx.replyWithChatAction('typing');

      const settings = await StorageService.getSettings();
      const directToneInstruction = buildTuxSystemInstruction(
        from.first_name || 'friend',
        undefined,
        settings.systemPersona
      );

      const aiReply = await GeminiService.generateChatResponse({
        prompt: text,
        userId: from.id,
        systemInstruction: directToneInstruction,
      });

      // Log AI interaction
      await StorageService.addLog({
        userId: from.id,
        username: from.username,
        eventType: 'ai_response',
        summary: `Tux replied to message (${text.slice(0, 30)}...)`,
      });

      try {
        await ctx.reply(aiReply, { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(aiReply);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error in message handling:', err);
      await ctx.reply(`⚠️ Sorry, something went wrong while processing: ${errMsg}`);
    }
  });

  // --- Telegram Business: Connection Event ---
  bot.on('business_connection', async (ctx) => {
    const conn = ctx.businessConnection;
    const isEnabled = conn.is_enabled;

    await StorageService.addLog({
      userId: conn.user.id,
      username: conn.user.username,
      eventType: 'business_connection',
      summary: isEnabled
        ? `Telegram Business connected to @${conn.user.username || conn.user.first_name}`
        : `Telegram Business disconnected from @${conn.user.username || conn.user.first_name}`,
      details: {
        connectionId: conn.id,
        canReply: conn.rights?.can_reply ?? true,
        isEnabled,
      },
    });

    if (isEnabled && conn.user_chat_id) {
      try {
        await ctx.api.sendMessage(
          conn.user_chat_id,
          `⚡ *Tux Telegram Connected!*\n\nConnected to your personal Telegram account.\n\n• Tux will chat naturally with incoming contacts.\n• Matches vibe, acts 100% human, and shares JUT resources only when asked.\n• Whenever Tux replies, you'll receive a notification right here.`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.warn('Could not send business connection welcome message:', err);
      }
    }
  });

  // --- Telegram Business: Message Handler ---
  bot.on('business_message:text', async (ctx) => {
    const msg = ctx.businessMessage;
    const text = msg.text;
    const from = msg.from;
    const connectionId = msg.business_connection_id;

    if (!from || !text) return;

    const allowedOwnerIds = CONFIG.allowedUserIds;
    const isFromOwner = allowedOwnerIds.includes(from.id);

    // If the message was typed by the account owner themselves:
    // Update their active presence timestamp (they are online) and do not reply
    if (isFromOwner) {
      StorageService.recordOwnerActivity();
      return;
    }

    const settings = await StorageService.getSettings();

    // Check if offline-only response is enforced
    if (settings.replyOnlyWhenOffline) {
      const telegramFlagOffline = Boolean(msg.is_from_offline);
      const presence = StorageService.getOwnerPresence(settings.offlineInactivityMinutes || 3);
      const isOffline = telegramFlagOffline || presence.isOffline;

      if (!isOffline) {
        // Owner is currently online and active! Let them answer personally.
        return;
      }
    }

    // Lookup or catalog contact profile and record interaction
    const contact = await StorageService.recordContactInteraction(from.id, from.username, from.first_name);

    // If contact is marked as MUTED, do not auto-reply
    if (contact?.category === 'muted') {
      return;
    }

    const isUrgent = contact?.escalateUrgent || /\b(urgent|emergency|asap|critical|call me)\b/i.test(text);

    const contactContext = {
      id: from.id,
      username: from.username,
      firstName: from.first_name,
    };

    // Step 1: Check Automation Engine
    const autoResult = await AutomationEngine.evaluate(text, contactContext);
    if (autoResult.matched && autoResult.responseText) {
      try {
        await ctx.reply(autoResult.responseText, { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(autoResult.responseText);
      }

      // Notify owner in private bot chat
      if (allowedOwnerIds[0]) {
        const categoryTag = contact?.category === 'vip' ? '⭐ VIP' : contact?.category ? `[${contact.category.toUpperCase()}]` : '';
        const urgentTag = isUrgent ? '🚨 *URGENT ALERT*\n\n' : '';
        try {
          await ctx.api.sendMessage(
            allowedOwnerIds[0],
            `${urgentTag}🔔 *Auto-Reply Sent ${categoryTag}*\n\n👤 *From:* ${from.first_name || 'Contact'} (@${from.username || 'unknown'})\n💬 *Received:* "${text}"\n⚡ *Rule Triggered:* ${autoResult.rule?.name}\n📤 *Replied:* "${autoResult.responseText}"`,
            { parse_mode: 'Markdown' }
          );
        } catch {}
      }
      return;
    }

    // Step 2: AI Response as TUX (acting 100% human)
    try {
      const settings = await StorageService.getSettings();
      const businessToneInstruction = buildTuxSystemInstruction(
        from.first_name || 'friend',
        contact?.customInstructions,
        settings.systemPersona
      );

      const aiReply = await GeminiService.generateChatResponse({
        prompt: text,
        userId: from.id,
        systemInstruction: businessToneInstruction,
      });

      await StorageService.addLog({
        userId: from.id,
        username: from.username,
        eventType: 'business_message',
        summary: `Tux replied to @${from.username || from.first_name || from.id}${contact ? ` [${contact.category}]` : ''}`,
        details: { text, reply: aiReply, connectionId, category: contact?.category, isUrgent },
      });

      try {
        await ctx.reply(aiReply, { parse_mode: 'Markdown' });
      } catch {
        await ctx.reply(aiReply);
      }

      // Notify owner in private bot chat
      if (allowedOwnerIds[0]) {
        const categoryTag = contact?.category === 'vip' ? '⭐ VIP' : contact?.category ? `[${contact.category.toUpperCase()}]` : '';
        const urgentTag = isUrgent ? '🚨 *URGENT NOTIFICATION*\n\n' : '';
        try {
          await ctx.api.sendMessage(
            allowedOwnerIds[0],
            `${urgentTag}📬 *Tux Replied to a Message ${categoryTag}*\n\n👤 *From:* ${from.first_name || 'Contact'} (@${from.username || 'unknown'})\n💬 *Their Message:* "${text}"\n💬 *Tux Replied:* "${aiReply}"`,
            { parse_mode: 'Markdown' }
          );
        } catch {}
      }
    } catch (err: unknown) {
      console.error('Error handling business message:', err);
    }
  });

  botInstance = bot;
  return botInstance;
}
