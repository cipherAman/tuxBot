import { Redis } from '@upstash/redis';
import { CONFIG, isRedisConfigured } from './config';
import { AutomationRule, BotLog, BotSettings, ChatMessage, ContactProfile, ContactCategory, ChannelDocument } from './types';
import { nanoid } from 'nanoid';

// Pre-seeded starter automation rules
const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'rule-ping',
    name: 'Health Check / Ping',
    description: 'Instant heartbeat check to confirm bot responsiveness',
    enabled: true,
    triggerType: 'exact',
    triggerPattern: 'ping',
    actionType: 'reply',
    actionPayload: '🏓 Pong! Online, responsive, and ready.',
    priority: 10,
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-summary',
    name: 'Action Items Extractor',
    description: 'When message starts with "extract:", AI extracts bulleted todos and deadlines',
    enabled: true,
    triggerType: 'contains',
    triggerPattern: 'extract:',
    actionType: 'ai_prompt',
    actionPayload: 'Analyze the following text and extract clear, actionable bullet points, deadlines, and owners in a clean Telegram list:\n\n{text}',
    priority: 20,
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-urgent',
    name: 'Urgent Alert Responder',
    description: 'Detects urgent or emergency keywords and flags priority alert',
    enabled: true,
    triggerType: 'regex',
    triggerPattern: '\\b(urgent|asap|critical|emergency)\\b',
    actionType: 'reply',
    actionPayload: '🚨 Got your message, noted this as urgent. Checking this out asap!',
    priority: 30,
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule-meeting',
    name: 'Meeting Minutes Structuring',
    description: 'Formats notes starting with "meeting:" into formal minutes',
    enabled: true,
    triggerType: 'contains',
    triggerPattern: 'meeting:',
    actionType: 'ai_prompt',
    actionPayload: 'Format these raw notes into a crisp Executive Meeting Summary with: 1) Objective, 2) Decisions Made, 3) Action Items & Next Steps:\n\n{text}',
    priority: 15,
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

const DEFAULT_SETTINGS: BotSettings = {
  systemPersona: CONFIG.defaultPersona,
  model: CONFIG.geminiModel,
  temperature: 0.7,
  chatMemoryLimit: 12,
  restrictedMode: CONFIG.allowedUserIds.length > 0,
  allowedUserIds: CONFIG.allowedUserIds,
  replyOnlyWhenOffline: true,
  offlineInactivityMinutes: 3,
};

// In-memory fallback cache (used when Redis is not configured or during local dev)
declare global {
  var __tuxBotMemoryStorage: {
    rules: Map<string, AutomationRule>;
    history: Map<number, ChatMessage[]>;
    logs: BotLog[];
    settings: BotSettings;
    contacts: Map<string, ContactProfile>;
    documents: Map<string, ChannelDocument>;
    ownerStatus: {
      manualMode: 'online' | 'offline' | 'auto';
      lastActiveAt?: number;
    };
  } | undefined;
}

if (!global.__tuxBotMemoryStorage) {
  const rulesMap = new Map<string, AutomationRule>();
  DEFAULT_RULES.forEach((r) => rulesMap.set(r.id, r));
  global.__tuxBotMemoryStorage = {
    rules: rulesMap,
    history: new Map(),
    logs: [],
    settings: { ...DEFAULT_SETTINGS },
    contacts: new Map(),
    documents: new Map(),
    ownerStatus: {
      manualMode: 'auto',
      lastActiveAt: undefined,
    },
  };
}

const memoryStorage = global.__tuxBotMemoryStorage;
if (!memoryStorage.contacts) {
  memoryStorage.contacts = new Map();
}
if (!memoryStorage.documents) {
  memoryStorage.documents = new Map();
}
if (!memoryStorage.ownerStatus) {
  memoryStorage.ownerStatus = {
    manualMode: 'auto',
  };
}

function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) return null;
  try {
    return new Redis({
      url: CONFIG.upstashRedisRestUrl,
      token: CONFIG.upstashRedisRestToken,
    });
  } catch (err) {
    console.error('Failed to initialize Redis client, falling back to memory:', err);
    return null;
  }
}

export class StorageService {
  private static redis = getRedisClient();

  // Storage Type identifier
  static getStorageType(): 'redis' | 'local_fallback' {
    return this.redis ? 'redis' : 'local_fallback';
  }

  // --- Automation Rules ---

  static async getRules(): Promise<AutomationRule[]> {
    if (this.redis) {
      try {
        const raw = await this.redis.get<AutomationRule[]>('tuxbot:rules');
        if (raw && Array.isArray(raw)) {
          return raw.sort((a, b) => b.priority - a.priority);
        }
        // Seed default rules if empty
        await this.redis.set('tuxbot:rules', DEFAULT_RULES);
        return DEFAULT_RULES;
      } catch (err) {
        console.error('Redis getRules error:', err);
      }
    }
    return Array.from(memoryStorage.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  static async saveRule(rule: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> & { id?: string }): Promise<AutomationRule> {
    const rules = await this.getRules();
    const now = new Date().toISOString();
    
    let savedRule: AutomationRule;

    if (rule.id) {
      const existingIndex = rules.findIndex((r) => r.id === rule.id);
      if (existingIndex >= 0) {
        savedRule = {
          ...rules[existingIndex],
          ...rule,
          updatedAt: now,
        };
        rules[existingIndex] = savedRule;
      } else {
        savedRule = {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          enabled: rule.enabled ?? true,
          triggerType: rule.triggerType,
          triggerPattern: rule.triggerPattern,
          actionType: rule.actionType,
          actionPayload: rule.actionPayload,
          priority: rule.priority ?? 0,
          executionCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        rules.push(savedRule);
      }
    } else {
      savedRule = {
        id: `rule-${nanoid(8)}`,
        name: rule.name,
        description: rule.description,
        enabled: rule.enabled ?? true,
        triggerType: rule.triggerType,
        triggerPattern: rule.triggerPattern,
        actionType: rule.actionType,
        actionPayload: rule.actionPayload,
        priority: rule.priority ?? 0,
        executionCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      rules.push(savedRule);
    }

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:rules', rules);
      } catch (err) {
        console.error('Redis saveRule error:', err);
      }
    }
    memoryStorage.rules.set(savedRule.id, savedRule);

    return savedRule;
  }

  static async deleteRule(id: string): Promise<boolean> {
    const rules = await this.getRules();
    const filtered = rules.filter((r) => r.id !== id);
    if (this.redis) {
      try {
        await this.redis.set('tuxbot:rules', filtered);
      } catch (err) {
        console.error('Redis deleteRule error:', err);
      }
    }
    memoryStorage.rules.delete(id);
    return true;
  }

  static async toggleRule(id: string, enabled: boolean): Promise<AutomationRule | null> {
    const rules = await this.getRules();
    const target = rules.find((r) => r.id === id);
    if (!target) return null;
    target.enabled = enabled;
    target.updatedAt = new Date().toISOString();

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:rules', rules);
      } catch (err) {
        console.error('Redis toggleRule error:', err);
      }
    }
    memoryStorage.rules.set(id, target);
    return target;
  }

  static async recordRuleExecution(id: string): Promise<void> {
    const rules = await this.getRules();
    const target = rules.find((r) => r.id === id);
    if (target) {
      target.executionCount = (target.executionCount || 0) + 1;
      target.lastExecutedAt = new Date().toISOString();
      if (this.redis) {
        try {
          await this.redis.set('tuxbot:rules', rules);
        } catch (err) {
          console.error('Redis recordRuleExecution error:', err);
        }
      }
      memoryStorage.rules.set(id, target);
    }
  }

  // --- Chat History for LLM Context ---

  static async getChatHistory(userId: number, limit = 10): Promise<ChatMessage[]> {
    if (this.redis) {
      try {
        const history = await this.redis.lrange<ChatMessage>(`tuxbot:history:${userId}`, 0, limit - 1);
        return (history || []).reverse();
      } catch (err) {
        console.error('Redis getChatHistory error:', err);
      }
    }
    const mem = memoryStorage.history.get(userId) || [];
    return mem.slice(-limit);
  }

  static async appendChatMessage(userId: number, role: 'user' | 'model', text: string): Promise<void> {
    const msg: ChatMessage = {
      role,
      text,
      timestamp: new Date().toISOString(),
    };

    if (this.redis) {
      try {
        const key = `tuxbot:history:${userId}`;
        await this.redis.lpush(key, msg);
        await this.redis.ltrim(key, 0, 30); // Keep last 30 messages
      } catch (err) {
        console.error('Redis appendChatMessage error:', err);
      }
    }

    const current = memoryStorage.history.get(userId) || [];
    current.push(msg);
    if (current.length > 30) current.shift();
    memoryStorage.history.set(userId, current);
  }

  static async clearChatHistory(userId: number): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(`tuxbot:history:${userId}`);
      } catch (err) {
        console.error('Redis clearChatHistory error:', err);
      }
    }
    memoryStorage.history.delete(userId);
  }

  // --- Logs & Activity ---

  static async addLog(entry: Omit<BotLog, 'id' | 'timestamp'>): Promise<BotLog> {
    const log: BotLog = {
      id: `log-${nanoid(10)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    if (this.redis) {
      try {
        await this.redis.lpush('tuxbot:logs', log);
        await this.redis.ltrim('tuxbot:logs', 0, 100); // Keep last 100 logs
      } catch (err) {
        console.error('Redis addLog error:', err);
      }
    }

    memoryStorage.logs.unshift(log);
    if (memoryStorage.logs.length > 100) memoryStorage.logs.pop();

    return log;
  }

  static async getLogs(limit = 50): Promise<BotLog[]> {
    if (this.redis) {
      try {
        const logs = await this.redis.lrange<BotLog>('tuxbot:logs', 0, limit - 1);
        if (logs && logs.length > 0) return logs;
      } catch (err) {
        console.error('Redis getLogs error:', err);
      }
    }
    return memoryStorage.logs.slice(0, limit);
  }

  // --- Settings ---

  static async getSettings(): Promise<BotSettings> {
    let settings: BotSettings;
    if (this.redis) {
      try {
        const remote = await this.redis.get<BotSettings>('tuxbot:settings');
        if (remote) {
          settings = remote;
        } else {
          settings = memoryStorage.settings;
        }
      } catch (err) {
        console.error('Redis getSettings error:', err);
        settings = memoryStorage.settings;
      }
    } else {
      settings = memoryStorage.settings;
    }

    // Always merge environment variable allowedUserIds so changes in Vercel take immediate effect
    if (CONFIG.allowedUserIds.length > 0) {
      const existing = (settings.allowedUserIds || [])
        .map((id) => Number(id))
        .filter((id) => !isNaN(id) && id > 0);
      settings.allowedUserIds = Array.from(new Set([...CONFIG.allowedUserIds, ...existing]));
      settings.restrictedMode = true;
    }

    return settings;
  }

  static async updateSettings(updates: Partial<BotSettings>): Promise<BotSettings> {
    const current = await this.getSettings();
    const updated: BotSettings = { ...current, ...updates };

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:settings', updated);
      } catch (err) {
        console.error('Redis updateSettings error:', err);
      }
    }
    memoryStorage.settings = updated;
    return updated;
  }

  // --- Owner Presence & Offline Detection ---

  static recordOwnerActivity(): void {
    memoryStorage.ownerStatus.lastActiveAt = Date.now();
  }

  static setOwnerManualMode(mode: 'online' | 'offline' | 'auto'): void {
    memoryStorage.ownerStatus.manualMode = mode;
  }

  static getOwnerPresence(inactivityMinutes = 3): {
    mode: 'online' | 'offline' | 'auto';
    isOffline: boolean;
    lastActiveAt?: number;
    minutesSinceLastActive?: number;
  } {
    const status = memoryStorage.ownerStatus;
    const now = Date.now();
    const lastActive = status.lastActiveAt;
    const minutesSince = lastActive ? Math.floor((now - lastActive) / 60000) : undefined;

    if (status.manualMode === 'offline') {
      return { mode: 'offline', isOffline: true, lastActiveAt: lastActive, minutesSinceLastActive: minutesSince };
    }
    if (status.manualMode === 'online') {
      return { mode: 'online', isOffline: false, lastActiveAt: lastActive, minutesSinceLastActive: minutesSince };
    }

    // Auto mode: check inactivity threshold
    if (!lastActive) {
      return { mode: 'auto', isOffline: true, lastActiveAt: undefined, minutesSinceLastActive: undefined };
    }

    const isOffline = (now - lastActive) >= (inactivityMinutes * 60 * 1000);
    return {
      mode: 'auto',
      isOffline,
      lastActiveAt: lastActive,
      minutesSinceLastActive: minutesSince,
    };
  }

  // --- Contacts & VIP CRM ---

  static async getContacts(): Promise<ContactProfile[]> {
    if (this.redis) {
      try {
        const contacts = await this.redis.get<ContactProfile[]>('tuxbot:contacts');
        if (contacts && Array.isArray(contacts)) {
          return contacts;
        }
      } catch (err) {
        console.error('Redis getContacts error:', err);
      }
    }
    return Array.from(memoryStorage.contacts.values());
  }

  static async getContactByIdentifier(telegramId?: number, username?: string): Promise<ContactProfile | null> {
    const contacts = await this.getContacts();
    const cleanUsername = username?.toLowerCase().replace(/^@/, '');

    const found = contacts.find((c) => {
      if (telegramId && c.telegramId && c.telegramId === telegramId) return true;
      if (cleanUsername && c.username && c.username.toLowerCase().replace(/^@/, '') === cleanUsername) return true;
      return false;
    });

    return found || null;
  }

  static async saveContact(profile: Partial<ContactProfile> & { name: string; category: ContactCategory }): Promise<ContactProfile> {
    const contacts = await this.getContacts();
    const now = new Date().toISOString();

    let saved: ContactProfile;
    const existingIndex = profile.id ? contacts.findIndex((c) => c.id === profile.id) : -1;

    if (existingIndex >= 0) {
      saved = {
        ...contacts[existingIndex],
        ...profile,
        updatedAt: now,
      };
      contacts[existingIndex] = saved;
    } else {
      saved = {
        id: profile.id || `contact-${nanoid(8)}`,
        name: profile.name,
        telegramId: profile.telegramId,
        username: profile.username?.replace(/^@/, ''),
        category: profile.category || 'client',
        customInstructions: profile.customInstructions || '',
        escalateUrgent: profile.escalateUrgent ?? false,
        lastSeenAt: now,
        totalMessagesHandled: 0,
        createdAt: now,
        updatedAt: now,
      };
      contacts.push(saved);
    }

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:contacts', contacts);
      } catch (err) {
        console.error('Redis saveContact error:', err);
      }
    }
    memoryStorage.contacts.set(saved.id, saved);
    return saved;
  }

  static async deleteContact(id: string): Promise<boolean> {
    const contacts = await this.getContacts();
    const filtered = contacts.filter((c) => c.id !== id);

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:contacts', filtered);
      } catch (err) {
        console.error('Redis deleteContact error:', err);
      }
    }
    memoryStorage.contacts.delete(id);
    return true;
  }

  static async recordContactInteraction(telegramId?: number, username?: string, name?: string): Promise<ContactProfile | null> {
    const contact = await this.getContactByIdentifier(telegramId, username);
    const now = new Date().toISOString();

    if (contact) {
      contact.lastSeenAt = now;
      contact.totalMessagesHandled = (contact.totalMessagesHandled || 0) + 1;
      await this.saveContact(contact);
      return contact;
    }

    // Auto-discover new lead if not yet cataloged
    if (name || username) {
      const newContact = await this.saveContact({
        name: name || username || 'New Contact',
        telegramId,
        username,
        category: 'lead',
        customInstructions: '',
        escalateUrgent: false,
      });
      return newContact;
    }

    return null;
  }

  // --- Channel Notes & Document Catalog ---

  static async getDocuments(): Promise<ChannelDocument[]> {
    if (this.redis) {
      try {
        const docs = await this.redis.get<ChannelDocument[]>('tuxbot:documents');
        if (Array.isArray(docs)) {
          docs.forEach((d) => memoryStorage.documents.set(d.id, d));
          return docs;
        }
      } catch (err) {
        console.error('Redis getDocuments error:', err);
      }
    }
    return Array.from(memoryStorage.documents.values());
  }

  static async getDocument(id: string): Promise<ChannelDocument | null> {
    const docs = await this.getDocuments();
    return docs.find((d) => d.id === id) || null;
  }

  static async saveDocument(doc: Partial<ChannelDocument> & { fileId: string; fileName: string }): Promise<ChannelDocument> {
    const docs = await this.getDocuments();
    const now = new Date().toISOString();

    // Check if document already exists by fileId or fileName + channelId
    const existingIndex = docs.findIndex((d) => 
      (doc.id && d.id === doc.id) ||
      d.fileId === doc.fileId || 
      (d.fileName.toLowerCase() === doc.fileName.toLowerCase() && d.channelId === doc.channelId)
    );

    // Extract basic tags from filename and caption
    const words = `${doc.fileName} ${doc.caption || ''}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'pdf', 'notes', 'doc'].includes(w));
    const extractedTags = Array.from(new Set([...(doc.tags || []), ...words]));

    let saved: ChannelDocument;
    if (existingIndex >= 0) {
      saved = {
        ...docs[existingIndex],
        ...doc,
        tags: extractedTags,
      };
      docs[existingIndex] = saved;
    } else {
      saved = {
        id: doc.id || `doc-${nanoid(8)}`,
        fileId: doc.fileId,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType || 'application/pdf',
        caption: doc.caption || '',
        channelId: doc.channelId,
        channelTitle: doc.channelTitle,
        messageId: doc.messageId,
        tags: extractedTags,
        downloadsCount: 0,
        uploadedAt: now,
      };
      docs.unshift(saved);
    }

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:documents', docs);
      } catch (err) {
        console.error('Redis saveDocument error:', err);
      }
    }
    memoryStorage.documents.set(saved.id, saved);
    return saved;
  }

  static async deleteDocument(id: string): Promise<boolean> {
    const docs = await this.getDocuments();
    const filtered = docs.filter((d) => d.id !== id);

    if (this.redis) {
      try {
        await this.redis.set('tuxbot:documents', filtered);
      } catch (err) {
        console.error('Redis deleteDocument error:', err);
      }
    }
    memoryStorage.documents.delete(id);
    return true;
  }

  static async recordDocumentDownload(id: string): Promise<void> {
    const docs = await this.getDocuments();
    const doc = docs.find((d) => d.id === id);
    if (doc) {
      doc.downloadsCount = (doc.downloadsCount || 0) + 1;
      await this.saveDocument(doc);
    }
  }

  static async findMatchingDocuments(query: string): Promise<ChannelDocument[]> {
    const docs = await this.getDocuments();
    if (docs.length === 0) return [];

    const cleanQuery = query.toLowerCase().trim();

    // Remove conversational filler words
    const fillerWords = new Set([
      'can', 'you', 'please', 'plz', 'send', 'give', 'share', 'get', 'me', 'the', 
      'i', 'want', 'need', 'bhai', 'bro', 'sir', 'karo', 'de', 'do', 'na', 'ka', 'ki', 'ke',
      'notes', 'note', 'pdf', 'pdfs', 'document', 'documents', 'material', 'materials'
    ]);

    const keywords = cleanQuery
      .replace(/[^a-z0-9\s-_]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !fillerWords.has(w));

    // If no specific subject keywords given (e.g. user just said "can you send notes", "notes please")
    // return all indexed documents (most recent first)
    if (keywords.length === 0) {
      return docs;
    }

    // Score documents by keyword hits in fileName, caption, and tags
    const scored = docs.map((doc) => {
      let score = 0;
      const targetText = `${doc.fileName} ${doc.caption || ''} ${doc.tags.join(' ')}`.toLowerCase();

      for (const kw of keywords) {
        if (targetText.includes(kw)) {
          score += 5;
        }
        if (doc.fileName.toLowerCase().includes(kw)) {
          score += 10;
        }
      }
      return { doc, score };
    });

    const matches = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    if (matches.length > 0) {
      return matches.map((m) => m.doc);
    }

    // If query was specific but nothing matched, return empty so bot can explain what's available
    return [];
  }
}

