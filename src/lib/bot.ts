import { Bot, InlineKeyboard, Context } from 'grammy';
import { CONFIG, isBotConfigured } from './config';
import { StorageService } from './storage';
import { AutomationEngine } from './automation';
import { GeminiService } from './gemini';

let botInstance: Bot | null = null;

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
      `👋 *Hello, ${name}! Welcome to TuxBot.*\n\n` +
      `I am your AI-rich personal assistant & chat automation engine, hosted serverless on Vercel.\n\n` +
      `✨ *What I can do:*\n` +
      `• *Automated Triggers:* Instant smart replies, regex rules, keyword matchers, & external webhooks.\n` +
      `• *Google Gemini AI:* Conversational reasoning with memory context.\n` +
      `• *Smart Workflows:* Try starting a message with \`extract:\` or \`meeting:\` to trigger AI workflow actions!\n` +
      `• *Quick Heartbeat:* Send \`ping\` anytime.\n\n` +
      `Use the menu below or type any message to begin.`;

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
      `📖 *TuxBot Command & Feature Guide*\n\n` +
      `*Commands:*\n` +
      `• \`/start\` — Open the main dashboard menu\n` +
      `• \`/rules\` — View active chat automation rules\n` +
      `• \`/mode <chat|concise|coder>\` — Switch AI persona\n` +
      `• \`/clear\` — Wipe conversation memory context\n` +
      `• \`/stats\` — View execution counts & storage info\n` +
      `• \`/notes\` — View indexed channel notes & PDFs\n` +
      `• \`/help\` — Display this guide\n\n` +
      `*Chat Automation:*\n` +
      `Every message is evaluated through the Automation Rule Engine first. If a rule triggers, its action executes immediately. Otherwise, the message flows directly into Google Gemini with conversation context!`;

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

  // /notes
  bot.command('notes', async (ctx) => {
    const docs = await StorageService.getDocuments();
    if (docs.length === 0) {
      await ctx.reply(
        `📚 *Channel Notes Catalog is Empty*\n\n` +
        `*How to add notes:*\n` +
        `1. Add @iam_tuxbot as an *Admin* to your notes channel and post notes there.\n` +
        `2. OR simply forward any notes/PDF from your channel directly to this chat!\n\n` +
        `Once indexed, whenever any user or contact asks for notes, Tux will forward them automatically!`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let msg = `📚 *Indexed Channel Notes (${docs.length})*\n\n`;
    docs.forEach((d, idx) => {
      const sizeMb = d.fileSize ? ` (${(d.fileSize / (1024 * 1024)).toFixed(1)} MB)` : '';
      msg += `${idx + 1}. *${d.fileName}*${sizeMb}\n`;
      if (d.caption) msg += `   📝 _${d.caption}_\n`;
      msg += `   📥 Sent: ${d.downloadsCount || 0} times | ID: \`${d.id}\`\n\n`;
    });

    msg += `_To delete a note from catalog: \`/delnote <id>\`_`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  });

  // /delnote
  bot.command('delnote', async (ctx) => {
    const id = ctx.match?.trim();
    if (!id) {
      await ctx.reply('Usage: `/delnote <note-id>` (Use `/notes` to find IDs)', { parse_mode: 'Markdown' });
      return;
    }

    const ok = await StorageService.deleteDocument(id);
    if (ok) {
      await ctx.reply(`🗑️ Note \`${id}\` deleted from catalog.`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`Note \`${id}\` not found in catalog.`);
    }
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

  // --- Channel Notes Helper & Forwarding ---
  async function dispatchNotesIfRequested(
    ctx: Context,
    text: string,
    user: { id: number; username?: string; firstName?: string },
    isBusiness: boolean
  ): Promise<boolean> {
    const clean = text.toLowerCase();

    // Trigger detection: asking for notes, documents, materials, or PDFs
    const isNotesTrigger =
      /\b(notes?|pdf|pdfs|document|documents|material|materials|slides|assignment|assignments|syllabus|cheatsheet|paper|papers)\b/i.test(clean) ||
      /\b(bhej|bhejo|de do|dedo|send|share|give|need|want|have)\b.*\b(note|pdf|doc)/i.test(clean);

    const matchingDocs = await StorageService.findMatchingDocuments(text);
    const allDocs = await StorageService.getDocuments();

    if (!isNotesTrigger && matchingDocs.length === 0) {
      return false;
    }

    if (matchingDocs.length > 0) {
      const isHinglish = /\b(bhai|yaar|bhejo|de de|dede|chahiye|karo|bhej do)\b/i.test(clean);
      const isCasual = /\b(yo|hey|sup|bro|send|pls|plz|gimme)\b/i.test(clean);

      let introText = `Here are the notes! 📄`;
      if (isHinglish) {
        introText = `Ye le bhai notes, padh le aache se! 📄`;
      } else if (isCasual) {
        introText = `Here you go bro, grabbed the notes for you! 📄`;
      }

      try {
        await ctx.reply(introText);
      } catch {}

      const toSend = matchingDocs.slice(0, 3);
      for (const doc of toSend) {
        try {
          let delivered = false;

          // Try native Telegram forwardMessage if channel & messageId exist
          if (doc.channelId && doc.messageId && ctx.chat) {
            try {
              await ctx.api.forwardMessage(ctx.chat.id, doc.channelId, doc.messageId);
              delivered = true;
            } catch (fErr) {
              console.warn(`forwardMessage failed for ${doc.fileName}, falling back to replyWithDocument:`, fErr);
            }
          }

          // Direct replyWithDocument fallback (guaranteed to work via file_id)
          if (!delivered) {
            await ctx.replyWithDocument(doc.fileId, {
              caption: doc.caption || `📄 ${doc.fileName}`,
            });
          }

          await StorageService.recordDocumentDownload(doc.id);
        } catch (err) {
          console.error(`Error delivering document ${doc.fileName}:`, err);
        }
      }

      if (matchingDocs.length > 3) {
        await ctx.reply(
          `_Plus ${matchingDocs.length - 3} more files available in the catalog. Ask for a specific subject if you need another one!_`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }

      await StorageService.addLog({
        userId: user.id,
        username: user.username,
        eventType: isBusiness ? 'business_message' : 'message',
        summary: `Forwarded ${toSend.length} note(s) to @${user.username || user.firstName || user.id}`,
        details: { files: toSend.map((d) => d.fileName), query: text },
      });

      const allowedOwnerIds = CONFIG.allowedUserIds;
      if (allowedOwnerIds[0] && allowedOwnerIds[0] !== user.id) {
        try {
          await ctx.api.sendMessage(
            allowedOwnerIds[0],
            `📤 *Tux Forwarded Channel Notes!*\n\n👤 *Recipient:* ${user.firstName || 'User'} (@${user.username || 'unknown'})\n💬 *Their Request:* "${text}"\n📄 *Notes Sent:* ${toSend.map((d) => d.fileName).join(', ')}`,
            { parse_mode: 'Markdown' }
          );
        } catch {}
      }

      return true;
    }

    if (isNotesTrigger) {
      if (allDocs.length > 0) {
        const docList = allDocs.slice(0, 6).map((d, i) => `${i + 1}. \`${d.fileName}\``).join('\n');
        const notFoundMsg =
          `I couldn't find notes specifically matching your query.\n\n` +
          `📚 *Available Notes in Catalog:*\n${docList}\n\n` +
          `_Reply with the note name or topic and I'll send it over!_`;
        await ctx.reply(notFoundMsg, { parse_mode: 'Markdown' }).catch(() => ctx.reply(notFoundMsg));
        return true;
      } else {
        await ctx.reply("I don't have any notes indexed in my channel yet. As soon as notes are uploaded, I'll be able to forward them!");
        return true;
      }
    }

    return false;
  }

  // --- Channel Post Handler: Automatically Index Notes & PDFs from Channel ---
  bot.on('channel_post:document', async (ctx) => {
    const doc = ctx.channelPost.document;
    const chat = ctx.channelPost.chat;
    const caption = ctx.channelPost.caption || '';

    const channelName = ('title' in chat && typeof chat.title === 'string') ? chat.title : 'Channel';

    const saved = await StorageService.saveDocument({
      fileId: doc.file_id,
      fileName: doc.file_name || 'note.pdf',
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      caption: caption,
      channelId: chat.id,
      channelTitle: channelName,
      messageId: ctx.channelPost.message_id,
    });

    console.log(`Indexed document from channel: ${saved.fileName} (${saved.fileId})`);

    const allowedOwnerIds = CONFIG.allowedUserIds;
    if (allowedOwnerIds[0]) {
      try {
        await ctx.api.sendMessage(
          allowedOwnerIds[0],
          `📚 *New Channel Note Indexed!*\n\n📄 *File:* \`${saved.fileName}\`\n📢 *Channel:* ${channelName}\n📝 *Caption:* ${caption || 'None'}\n🏷️ *Tags:* ${saved.tags.join(', ') || 'general'}\n\n✨ _Tux will now automatically forward this note whenever someone asks for it!_`,
          { parse_mode: 'Markdown' }
        );
      } catch {}
    }
  });

  // --- Direct Document Handler: Owner can forward or upload notes directly to bot ---
  bot.on('message:document', async (ctx) => {
    const from = ctx.from;
    if (!from) return;

    const allowedOwnerIds = CONFIG.allowedUserIds;
    const isOwner = allowedOwnerIds.includes(from.id);
    const doc = ctx.message.document;
    const caption = ctx.message.caption || '';

    let channelId: number | string | undefined;
    let channelTitle: string | undefined;
    let messageId: number | undefined;

    const forwardOrigin = ctx.message.forward_origin;
    if (forwardOrigin && forwardOrigin.type === 'channel') {
      channelId = forwardOrigin.chat.id;
      channelTitle = forwardOrigin.chat.title;
      messageId = forwardOrigin.message_id;
    } else {
      const msgAny = ctx.message as unknown as Record<string, unknown>;
      if (msgAny.forward_from_chat && typeof msgAny.forward_from_chat === 'object') {
        const fChat = msgAny.forward_from_chat as { id?: number | string; title?: string };
        channelId = fChat.id;
        channelTitle = fChat.title;
        messageId = typeof msgAny.forward_from_message_id === 'number' ? msgAny.forward_from_message_id : undefined;
      }
    }

    const saved = await StorageService.saveDocument({
      fileId: doc.file_id,
      fileName: doc.file_name || 'document.pdf',
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      caption: caption,
      channelId,
      channelTitle,
      messageId,
    });

    if (isOwner) {
      await ctx.reply(
        `✅ *Note Indexed into Tux Catalog!*\n\n📄 *File:* \`${saved.fileName}\`\n${channelTitle ? `📢 *Source Channel:* ${channelTitle}\n` : ''}🏷️ *Tags:* ${saved.tags.join(', ') || 'general'}\n\n🚀 Tux is ready! Any user asking for this note or topic will receive it immediately.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(`Received document: \`${saved.fileName}\`. Thanks!`, { parse_mode: 'Markdown' }).catch(() => {});
    }
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
      // Send the automated response
      try {
        await ctx.reply(autoResult.responseText, { parse_mode: 'Markdown' });
      } catch {
        // Fallback to plain text if Markdown has invalid formatting
        await ctx.reply(autoResult.responseText);
      }
      return;
    }

    // Step 1.5: Check if user is asking for Notes / PDFs
    const handledNotes = await dispatchNotesIfRequested(ctx, text, userContext, false);
    if (handledNotes) {
      return;
    }

    // Step 2: Fallback to Conversational AI (Gemini)
    try {
      // Indicate typing status to Telegram user
      await ctx.replyWithChatAction('typing');

      const settings = await StorageService.getSettings();
      const directToneInstruction =
        `You are TUX. You are talking directly with ${from.first_name || 'the user'}.\n` +
        `STRICT IDENTITY MANDATE:\n` +
        `- You are TUX. ONLY TUX. You have no other identity.\n` +
        `- NEVER mention, reveal, or admit to being Gemini, Google, OpenAI, ChatGPT, an LLM, or an AI language model under any circumstances.\n` +
        `- If asked "who powers you?", "are you chatgpt or gemini?", "who made you?", or anything about your underlying tech:\n` +
        `  Always reply casually and firmly that you are simply TUX (e.g. "I'm TUX.", "Just TUX.", "I'm powered by TUX."). Never mention Gemini or ChatGPT.\n` +
        `- Be sharp, charismatic, helpful, and natural. Dynamically mirror their communication style, language, and energy.\n` +
        `- Never sound like a generic AI or say "As an AI language model".\n` +
        (settings.systemPersona ? `Persona notes: ${settings.systemPersona}` : '');

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
        summary: `AI responded to message (${text.slice(0, 30)}...)`,
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

  // --- Telegram Business: Secretary Connection Event ---
  bot.on('business_connection', async (ctx) => {
    const conn = ctx.businessConnection;
    const isEnabled = conn.is_enabled;

    await StorageService.addLog({
      userId: conn.user.id,
      username: conn.user.username,
      eventType: 'business_connection',
      summary: isEnabled
        ? `Telegram Business Secretary connected to @${conn.user.username || conn.user.first_name}`
        : `Telegram Business Secretary disconnected from @${conn.user.username || conn.user.first_name}`,
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
          `👔 *Tux Secretary Mode Active!*\n\nI am now connected to your personal Telegram account as your executive AI secretary.\n\n• I will assist incoming contacts when they message you.\n• Automation rules and Gemini AI persona will handle inquiries.\n• Whenever I respond to someone, I will send you a notification right here.`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.warn('Could not send business connection welcome message:', err);
      }
    }
  });

  // --- Telegram Business: Secretary Message Handler ---
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
            `${urgentTag}🔔 *Secretary Auto-Reply Sent ${categoryTag}*\n\n👤 *From:* ${from.first_name || 'Contact'} (@${from.username || 'unknown'})\n💬 *Received:* "${text}"\n⚡ *Rule Triggered:* ${autoResult.rule?.name}\n📤 *Replied:* "${autoResult.responseText}"`,
            { parse_mode: 'Markdown' }
          );
        } catch {}
      }
      return;
    }

    // Step 1.5: Check if contact is asking for Notes / PDFs
    const handledNotes = await dispatchNotesIfRequested(ctx, text, contactContext, true);
    if (handledNotes) {
      return;
    }

    // Step 2: AI Response as TUX (with dynamic tone mirroring)
    try {
      const settings = await StorageService.getSettings();

      const customContactRules = contact?.customInstructions
        ? `\nSpecific notes for this contact (${contact.name}, ${contact.category.toUpperCase()}): "${contact.customInstructions}"\n`
        : '';

      const tuxReplyPrompt =
        `You are TUX. You are replying to a chat on Telegram while the account owner is away.\n\n` +
        `CORE RULES:\n` +
        `1. YOU ARE TUX: Act strictly as TUX. You have no other name or origin. Never mention, reveal, or admit to being Gemini, Google, OpenAI, ChatGPT, or an AI language model under any circumstances. If asked who powers you or if you are ChatGPT/Gemini, reply that you are just TUX.\n` +
        `2. DYNAMIC TONE MATCHING: Mirror the other person's exact vibe, language style, and formality:\n` +
        `   - If they text casually ("yo", "sup", slang, lowercase, emojis) -> reply chill and casual like a real friend.\n` +
        `   - If they text in Hinglish / Hindi / local slang -> match their exact slang and dialect naturally.\n` +
        `   - If they text formally or professionally -> reply crisp, polite, and professional.\n` +
        `   - If their message is short -> keep your reply short and punchy. Avoid walls of text.\n` +
        `3. GOAL: Be helpful, answer questions directly if you can, or casually let them know you'll loop the owner in once they are back.\n` +
        customContactRules +
        (settings.systemPersona ? `\nTux persona guidance: ${settings.systemPersona}\n` : '') +
        `\nIncoming message from ${from.first_name || 'user'}: "${text}"`;

      const aiReply = await GeminiService.generateChatResponse({
        prompt: tuxReplyPrompt,
        userId: from.id,
      });

      await StorageService.addLog({
        userId: from.id,
        username: from.username,
        eventType: 'business_message',
        summary: `Secretary replied to @${from.username || from.first_name || from.id}${contact ? ` [${contact.category}]` : ''}`,
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
            `${urgentTag}📬 *Secretary Handled a Message ${categoryTag}*\n\n👤 *From:* ${from.first_name || 'Contact'} (@${from.username || 'unknown'})\n💬 *Their Message:* "${text}"\n🤖 *Tux Replied:* "${aiReply}"`,
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
