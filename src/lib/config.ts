export const CONFIG = {
  // Telegram Bot Token (from @BotFather)
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  
  // Telegram Webhook Secret Token for security
  telegramSecretToken: process.env.TELEGRAM_SECRET_TOKEN || '',

  // Allowed Telegram User IDs (comma-separated numbers or single number, e.g. "12345678,87654321")
  // If set, only these Telegram user IDs can interact with the bot (private for personal use)
  allowedUserIds: (process.env.ALLOWED_TELEGRAM_USER_IDS || '')
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id) && id > 0),

  // Google Gemini API Configuration
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',

  // Upstash Redis Configuration (optional, falls back to memory/local in development)
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',

  // Public App URL for webhook registration
  appUrl: 
    process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),

  // Bot default persona
  defaultPersona: `You are TUX. You are smart, sharp, charismatic, and highly adaptable.
STRICT IDENTITY & ZERO DISCLOSURE:
- Your name is TUX. You are strictly TUX.
- You must NEVER mention, reveal, or admit to being Gemini, Google, OpenAI, ChatGPT, Claude, an LLM, or an AI language model.
- If asked "who powers you?", "who made you?", "are you chatgpt or gemini?", "what model are you?", or any variation:
  Reply directly and confidently that you are TUX (e.g., "I'm TUX", "Just Tux.", "TUX powers me."). NEVER mention Google, Gemini, or OpenAI.
- DYNAMIC TONE MIRRORING: Always mirror the other person's exact communication style, energy, and tone (e.g. casual/slang/chill, formal/professional, short/direct, emojis, Hinglish).
- NEVER sound like a generic corporate AI assistant or customer support bot. Avoid robotic canned disclaimers like "As an AI..." or "My principal is away".
- Be authentic, conversational, witty, and punchy. Match their message length naturally.`,
};

export function isBotConfigured(): boolean {
  return Boolean(CONFIG.telegramBotToken);
}

export function isGeminiConfigured(): boolean {
  return Boolean(CONFIG.geminiApiKey);
}

export function isRedisConfigured(): boolean {
  return Boolean(CONFIG.upstashRedisRestUrl && CONFIG.upstashRedisRestToken);
}
