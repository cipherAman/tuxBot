import { GoogleGenAI } from '@google/genai';
import { CONFIG, isGeminiConfigured } from './config';
import { ChatMessage } from './types';
import { StorageService } from './storage';

let genAIClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({ apiKey: CONFIG.geminiApiKey });
  }
  return genAIClient;
}

export interface GenerateOptions {
  prompt: string;
  userId?: number;
  systemInstruction?: string;
  temperature?: number;
  model?: string;
}

export class GeminiService {
  /**
   * Generates a conversational response considering past context
   */
  static async generateChatResponse(options: GenerateOptions): Promise<string> {
    const client = getClient();
    if (!client) {
      return '⚠️ Gemini API Key is not configured. Please set the GEMINI_API_KEY environment variable.';
    }

    try {
      const settings = await StorageService.getSettings();
      const modelName = options.model || settings.model || CONFIG.geminiModel;
      const systemInstruction = options.systemInstruction || settings.systemPersona;

      // Build contents array with context memory if userId provided
      let contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      if (options.userId) {
        const history: ChatMessage[] = await StorageService.getChatHistory(
          options.userId,
          settings.chatMemoryLimit || 10
        );

        contents = history.map((msg) => ({
          role: msg.role,
          parts: [{
            text: msg.role === 'model'
              ? msg.text.replace(/\b(Gemini|ChatGPT|OpenAI|Google AI)\b/gi, 'Tux')
              : msg.text,
          }],
        }));
      }

      // Append current user message
      contents.push({
        role: 'user',
        parts: [{ text: options.prompt }],
      });

      const candidateModels = Array.from(new Set([
        modelName,
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-flash-latest'
      ].filter(Boolean)));

      let lastError: unknown = null;

      for (const currentModel of candidateModels) {
        try {
          const isLite = currentModel.includes('lite');
          const genConfig: Record<string, unknown> = {
            systemInstruction: systemInstruction,
            temperature: options.temperature ?? settings.temperature ?? 0.7,
          };

          // Disable extended thinking latency for conversational bot speed
          if (!isLite && currentModel.includes('flash')) {
            genConfig.thinkingConfig = { thinkingBudget: 0 };
          }

          const response = await client.models.generateContent({
            model: currentModel,
            contents: contents,
            config: genConfig,
          });

          const rawOutput = response.text?.trim() || 'No response generated.';
          // Strict TUX identity guard: Never leak third-party provider names
          const outputText = rawOutput
            .replace(/\b(I am powered by Google Gemini|I am powered by Gemini|powered by Google Gemini|powered by Gemini|I'm powered by Gemini|I am a large language model trained by Google)\b/gi, "I'm TUX")
            .replace(/\b(Google Gemini|Gemini|ChatGPT|OpenAI)\b/g, 'Tux');

          // Save to chat history if userId provided
          if (options.userId) {
            await StorageService.appendChatMessage(options.userId, 'user', options.prompt);
            await StorageService.appendChatMessage(options.userId, 'model', outputText);
          }

          return outputText;
        } catch (candidateErr) {
          lastError = candidateErr;
          console.warn(`Model ${currentModel} failed, trying next candidate fallback...`);
        }
      }

      console.error('All Gemini candidate models failed:', lastError);
      const errMsg = lastError instanceof Error ? lastError.message : String(lastError);
      return `❌ AI generation error: ${errMsg}`;
    } catch (err: unknown) {
      console.error('Gemini service error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return `❌ AI generation error: ${errMsg}`;
    }
  }

  /**
   * Evaluates if a given message matches a semantic intent description
   */
  static async evaluateIntent(message: string, intentDescription: string): Promise<boolean> {
    const client = getClient();
    if (!client) return false;

    try {
      const classificationPrompt = `You are an intent classification classifier for an automation bot.
Determine whether the following user message matches the specified intent description.

Intent Description: "${intentDescription}"
User Message: "${message}"

Reply with ONLY the word "MATCH" if the message clearly matches this intent, or "NO_MATCH" if it does not.
Do not provide any extra explanation or punctuation.`;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: classificationPrompt }] }],
        config: {
          temperature: 0.1,
        },
      });

      const text = response.text?.trim().toUpperCase() || '';
      return text.includes('MATCH') && !text.includes('NO_MATCH');
    } catch (err) {
      console.error('Intent evaluation error:', err);
      return false;
    }
  }
}
