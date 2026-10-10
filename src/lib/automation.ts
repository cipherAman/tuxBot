import { AutomationRule } from './types';
import { StorageService } from './storage';
import { GeminiService } from './gemini';

export interface UserContext {
  id: number;
  username?: string;
  firstName?: string;
}

export interface AutomationResult {
  matched: boolean;
  rule?: AutomationRule;
  responseText?: string;
  error?: string;
}

export class AutomationEngine {
  /**
   * Evaluates an incoming message against all active automation rules
   */
  static async evaluate(
    messageText: string,
    user: UserContext
  ): Promise<AutomationResult> {
    const rules = await StorageService.getRules();
    const activeRules = rules.filter((r) => r.enabled);

    const trimmedText = messageText.trim();
    if (!trimmedText) {
      return { matched: false };
    }

    for (const rule of activeRules) {
      const isMatch = await this.testRuleMatch(rule, trimmedText);
      if (isMatch) {
        try {
          const responseText = await this.executeRuleAction(rule, trimmedText, user);

          // Update execution count and last executed time
          await StorageService.recordRuleExecution(rule.id);

          // Log the trigger event
          await StorageService.addLog({
            userId: user.id,
            username: user.username,
            eventType: 'automation_trigger',
            summary: `Automation rule triggered: "${rule.name}" (${rule.triggerType})`,
            details: {
              ruleId: rule.id,
              ruleName: rule.name,
              triggerType: rule.triggerType,
              actionType: rule.actionType,
              inputMessage: trimmedText,
            },
          });

          return {
            matched: true,
            rule,
            responseText,
          };
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`Error executing rule ${rule.name}:`, err);
          return {
            matched: true,
            rule,
            error: errMsg,
            responseText: `⚠️ Automation rule "${rule.name}" failed to execute: ${errMsg}`,
          };
        }
      }
    }

    return { matched: false };
  }

  /**
   * Tests if a single rule matches the text
   */
  static async testRuleMatch(rule: AutomationRule, text: string): Promise<boolean> {
    const pattern = rule.triggerPattern.trim();
    const lowerText = text.toLowerCase();
    const lowerPattern = pattern.toLowerCase();

    switch (rule.triggerType) {
      case 'exact':
        return lowerText === lowerPattern;

      case 'contains':
        return lowerText.includes(lowerPattern);

      case 'regex':
        try {
          const rx = new RegExp(pattern, 'i');
          return rx.test(text);
        } catch (err) {
          console.warn(`Invalid regex pattern in rule ${rule.name}:`, pattern, err);
          return false;
        }

      case 'command': {
        const cmdName = pattern.startsWith('/') ? pattern.slice(1).toLowerCase() : pattern.toLowerCase();
        const firstWord = text.split(/\s+/)[0]?.toLowerCase().replace(/^\//, '');
        return firstWord === cmdName;
      }

      case 'intent':
        return await GeminiService.evaluateIntent(text, pattern);

      default:
        return false;
    }
  }

  /**
   * Executes the corresponding action for a matched rule
   */
  private static async executeRuleAction(
    rule: AutomationRule,
    originalText: string,
    user: UserContext
  ): Promise<string> {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    // Substitute standard template variables
    const formatTemplate = (template: string): string => {
      return template
        .replace(/{user}/g, user.username ? `@${user.username}` : user.firstName || 'User')
        .replace(/{name}/g, user.firstName || user.username || 'User')
        .replace(/{text}/g, originalText)
        .replace(/{time}/g, timeStr)
        .replace(/{date}/g, dateStr)
        .replace(/{rule}/g, rule.name);
    };

    switch (rule.actionType) {
      case 'reply':
        return formatTemplate(rule.actionPayload);

      case 'ai_prompt': {
        const formattedPrompt = formatTemplate(rule.actionPayload);
        const aiResponse = await GeminiService.generateChatResponse({
          prompt: formattedPrompt,
          userId: user.id,
        });
        return aiResponse;
      }

      case 'webhook': {
        const webhookUrl = rule.actionPayload.trim();
        const payload = {
          ruleId: rule.id,
          ruleName: rule.name,
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
          },
          text: originalText,
          timestamp: now.toISOString(),
        };

        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(`Webhook returned status ${res.status}: ${res.statusText}`);
        }

        let replyMsg = `⚡ Webhook triggered successfully for rule: *${rule.name}*`;
        try {
          const data = await res.json();
          if (data && typeof data.message === 'string') {
            replyMsg += `\nResponse: ${data.message}`;
          }
        } catch {
          // Non-JSON webhook response is okay
        }
        return replyMsg;
      }

      case 'notify': {
        return `🔔 *AUTOMATION NOTIFICATION*\nRule: ${rule.name}\nTriggered at: ${timeStr}\n\n${formatTemplate(rule.actionPayload)}`;
      }

      default:
        return `Automated trigger acknowledged for rule: ${rule.name}`;
    }
  }
}
