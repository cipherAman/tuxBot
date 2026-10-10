export type TriggerType = 'exact' | 'contains' | 'regex' | 'intent' | 'command';

export type ActionType = 'reply' | 'ai_prompt' | 'webhook' | 'notify';

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType: TriggerType;
  triggerPattern: string; // The match text, regex string, or intent description
  actionType: ActionType;
  actionPayload: string; // Reply text, custom prompt template, or webhook URL
  priority: number; // Higher number = higher priority
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventType = 
  | 'message' 
  | 'command' 
  | 'automation_trigger' 
  | 'ai_response' 
  | 'business_message'
  | 'business_connection'
  | 'error' 
  | 'blocked';

export interface BotLog {
  id: string;
  timestamp: string;
  userId: number;
  username?: string;
  eventType: EventType;
  summary: string;
  details?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export type ContactCategory = 'vip' | 'client' | 'friend' | 'lead' | 'muted';

export interface ContactProfile {
  id: string;
  telegramId?: number;
  username?: string;
  name: string;
  category: ContactCategory;
  customInstructions?: string;
  escalateUrgent?: boolean;
  lastSeenAt?: string;
  totalMessagesHandled?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelDocument {
  id: string;
  fileId: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  caption?: string;
  channelId?: number | string;
  channelTitle?: string;
  messageId?: number;
  tags: string[];
  downloadsCount: number;
  uploadedAt: string;
}


export interface BotSettings {
  systemPersona: string;
  model: string;
  temperature: number;
  chatMemoryLimit: number;
  restrictedMode: boolean; // Only allowed user IDs can interact
  allowedUserIds: number[];
  replyOnlyWhenOffline: boolean; // Only reply to contacts when user is away/offline
  offlineInactivityMinutes: number; // Minutes of inactivity before considered away
}

export interface BotStatusResponse {
  ok: boolean;
  bot: {
    username?: string;
    id?: number;
    firstName?: string;
    canJoinGroups?: boolean;
    supportsInlineQueries?: boolean;
  } | null;
  webhook: {
    url?: string;
    hasCustomCertificate?: boolean;
    pendingUpdateCount?: number;
    lastErrorDate?: number;
    lastErrorMessage?: string;
  } | null;
  gemini: {
    configured: boolean;
    model: string;
  };
  storage: {
    type: 'redis' | 'local_fallback';
    connected: boolean;
  };
  stats: {
    totalRules: number;
    activeRules: number;
    totalExecutions: number;
    totalLogs: number;
  };
}
