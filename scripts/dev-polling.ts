import process from 'node:process';

// Load .env.local
try {
  process.loadEnvFile('.env.local');
} catch {
  console.warn('Notice: .env.local not found, using existing environment variables.');
}

import { getBot } from '../src/lib/bot';

async function start() {
  console.log('🤖 Initializing TuxBot local long-polling...');
  const bot = getBot();

  // Clear any existing webhook so long-polling receives updates
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
    console.log('🧹 Telegram webhook cleared for local polling.');
  } catch (err) {
    console.warn('Notice when clearing webhook:', err);
  }

  const me = await bot.api.getMe();
  console.log(`\n=================================================`);
  console.log(`🚀 TuxBot is LIVE and listening on Telegram!`);
  console.log(`👉 Open in Telegram: https://t.me/${me.username}`);
  console.log(`👉 Bot: ${me.first_name} (@${me.username}) | ID: ${me.id}`);
  console.log(`⚡ Long-polling active. You can now chat in Telegram!`);
  console.log(`=================================================\n`);

  bot.start({
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
    onStart: (info) => {
      console.log(`🟢 Polling connection established for @${info.username}`);
    },
  });
}

start().catch((err) => {
  console.error('Fatal error starting TuxBot polling:', err);
  process.exit(1);
});
