'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Zap,
  Sliders,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Shield,
  Sparkles,
  Server,
  Send,
  Users,
  Star,
} from 'lucide-react';
import { AutomationRule, BotLog, BotSettings, BotStatusResponse, TriggerType, ActionType, ContactProfile, ContactCategory } from '@/lib/types';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'rules' | 'ai' | 'contacts' | 'logs' | 'setup'>('rules');
  const [status, setStatus] = useState<BotStatusResponse | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter for rules tab
  const [ruleFilter, setRuleFilter] = useState<string>('all');

  // Test Simulator state
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    rule?: AutomationRule | null;
    simulatedOutput?: string | null;
    error?: string | null;
  } | null>(null);
  const [testingTrigger, setTestingTrigger] = useState(false);

  // New Rule Modal state
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRule, setNewRule] = useState<{
    name: string;
    description: string;
    triggerType: TriggerType;
    triggerPattern: string;
    actionType: ActionType;
    actionPayload: string;
    priority: number;
  }>({
    name: '',
    description: '',
    triggerType: 'contains',
    triggerPattern: '',
    actionType: 'reply',
    actionPayload: '',
    priority: 10,
  });

  // Contact Modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContact, setNewContact] = useState<{
    name: string;
    username: string;
    telegramId: string;
    category: ContactCategory;
    customInstructions: string;
    escalateUrgent: boolean;
  }>({
    name: '',
    username: '',
    telegramId: '',
    category: 'vip',
    customInstructions: '',
    escalateUrgent: false,
  });

  // Webhook action state
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [settingWebhook, setSettingWebhook] = useState(false);

  // Show Toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch data
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    }
    try {
      const [statusRes, rulesRes, contactsRes, logsRes, settingsRes] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/rules'),
        fetch('/api/contacts'),
        fetch('/api/logs?limit=30'),
        fetch('/api/settings'),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData);
        if (sData.config?.appUrl) {
          setWebhookUrlInput(`${sData.config.appUrl}/api/webhook`);
        }
      }

      if (rulesRes.ok) {
        const rData = await rulesRes.json();
        setRules(rData.rules || []);
      }

      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(cData.contacts || []);
      }

      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(lData.logs || []);
      }

      if (settingsRes.ok) {
        const settsData = await settingsRes.json();
        setSettings(settsData.settings);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (isManualRefresh) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadInitialData = async () => {
      try {
        const [statusRes, rulesRes, contactsRes, logsRes, settingsRes] = await Promise.all([
          fetch('/api/bot/status'),
          fetch('/api/rules'),
          fetch('/api/contacts'),
          fetch('/api/logs?limit=30'),
          fetch('/api/settings'),
        ]);

        if (ignore) return;

        if (statusRes.ok) {
          const sData = await statusRes.json();
          if (!ignore) {
            setStatus(sData);
            if (sData.config?.appUrl) {
              setWebhookUrlInput(`${sData.config.appUrl}/api/webhook`);
            }
          }
        }

        if (rulesRes.ok) {
          const rData = await rulesRes.json();
          if (!ignore) setRules(rData.rules || []);
        }

        if (contactsRes.ok) {
          const cData = await contactsRes.json();
          if (!ignore) setContacts(cData.contacts || []);
        }

        if (logsRes.ok) {
          const lData = await logsRes.json();
          if (!ignore) setLogs(lData.logs || []);
        }

        if (settingsRes.ok) {
          const settsData = await settingsRes.json();
          if (!ignore) setSettings(settsData.settings);
        }
      } catch (err) {
        console.error('Failed to load initial dashboard data:', err);
      }
    };

    loadInitialData();

    return () => {
      ignore = true;
    };
  }, []);

  // Toggle rule
  const handleToggleRule = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: !currentEnabled }),
      });
      if (res.ok) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: !currentEnabled } : r))
        );
        showToast(`Rule ${!currentEnabled ? 'enabled' : 'disabled'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        showToast('Rule deleted successfully');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create rule
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name || !newRule.triggerPattern || !newRule.actionPayload) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      if (res.ok) {
        const data = await res.json();
        setRules((prev) => [data.rule, ...prev]);
        setShowRuleModal(false);
        setNewRule({
          name: '',
          description: '',
          triggerType: 'contains',
          triggerPattern: '',
          actionType: 'reply',
          actionPayload: '',
          priority: 10,
        });
        showToast('Automation rule created!');
      } else {
        const err = await res.json();
        alert(`Failed to create rule: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create or Update Contact
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name.trim()) {
      alert('Contact name is required.');
      return;
    }

    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newContact,
          telegramId: newContact.telegramId ? Number(newContact.telegramId) : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setContacts((prev) => {
          const idx = prev.findIndex((c) => c.id === data.contact.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data.contact;
            return updated;
          }
          return [data.contact, ...prev];
        });
        setShowContactModal(false);
        setNewContact({
          name: '',
          username: '',
          telegramId: '',
          category: 'vip',
          customInstructions: '',
          escalateUrgent: false,
        });
        showToast('Contact profile saved!');
      } else {
        const err = await res.json();
        alert(`Failed to save contact: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact profile?')) return;
    try {
      const res = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setContacts((prev) => prev.filter((c) => c.id !== id));
        showToast('Contact removed');
      }
    } catch (err) {
      console.error(err);
    }
  };



  // Test rule simulation
  const handleTestTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;

    setTestingTrigger(true);
    try {
      const res = await fetch('/api/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testInput }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTestingTrigger(false);
    }
  };

  // Update Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast('AI Settings saved successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Register Webhook
  const handleSetWebhook = async () => {
    if (!webhookUrlInput.startsWith('https://')) {
      alert('Telegram requires an HTTPS URL (e.g. your Vercel deployment URL).');
      return;
    }

    setSettingWebhook(true);
    try {
      const res = await fetch('/api/bot/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrlInput }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Webhook registered with Telegram API!');
        fetchData();
      } else {
        alert(`Failed to register webhook: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSettingWebhook(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  const filteredRules = rules.filter((r) => {
    if (ruleFilter === 'all') return true;
    return r.triggerType === ruleFilter;
  });

  return (
    <>
      {/* Ambient background glows */}
      <div className="ambient-bg">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
        <div className="ambient-blob-3" />
      </div>

      {/* Top Navbar */}
      <nav className="navbar">
        <div className="container nav-wrapper">
          <div className="brand">
            <div className="brand-icon">
              <Bot size={22} />
            </div>
            <div className="brand-text">
              <h1>TuxBot Console</h1>
            </div>
            <span className="brand-badge">Vercel Serverless</span>
          </div>

          <div className="nav-actions">
            {status?.bot?.username ? (
              <a
                href={`https://t.me/${status.bot.username}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Send size={14} /> Open @{status.bot.username}
              </a>
            ) : null}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="btn btn-secondary btn-sm"
              title="Refresh status"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-header">
            <h2 className="hero-title">
              Intelligent <span className="gradient-text">Telegram Automation</span> & AI Agent
            </h2>
            <p className="hero-subtitle">
              Personal AI assistant powered by Google Gemini, equipped with smart trigger rules,
              conversational memory, external webhooks, and zero-maintenance Vercel hosting.
            </p>
          </div>
        </section>

        {/* Status Metrics Cards */}
        <section className="status-grid">
          {/* Telegram Status */}
          <div className="status-card">
            <div className="status-card-icon icon-cyan">
              <Bot size={20} />
            </div>
            <div className="status-card-content">
              <div className="status-card-label">Telegram Bot</div>
              <div className="status-card-value">
                {status?.bot?.username ? (
                  <>
                    <CheckCircle2 size={16} color="#34d399" />
                    <span>@{status.bot.username}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <span style={{ fontSize: '0.95rem' }}>Set Bot Token</span>
                  </>
                )}
              </div>
              <div className="status-card-desc">
                {status?.bot?.firstName || 'Awaiting TELEGRAM_BOT_TOKEN'}
              </div>
            </div>
          </div>

          {/* Webhook Status */}
          <div className="status-card">
            <div className="status-card-icon icon-emerald">
              <Activity size={20} />
            </div>
            <div className="status-card-content">
              <div className="status-card-label">Webhook URL</div>
              <div className="status-card-value" style={{ fontSize: '0.95rem' }}>
                {status?.webhook?.url ? (
                  <>
                    <CheckCircle2 size={16} color="#34d399" />
                    <span>Configured</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <span>Not Registered</span>
                  </>
                )}
              </div>
              <div className="status-card-desc" style={{ wordBreak: 'break-all' }}>
                {status?.webhook?.url || 'Needs HTTPS webhook setup'}
              </div>
            </div>
          </div>

          {/* AI Model Status */}
          <div className="status-card">
            <div className="status-card-icon icon-violet">
              <Sparkles size={20} />
            </div>
            <div className="status-card-content">
              <div className="status-card-label">AI Engine</div>
              <div className="status-card-value" style={{ fontSize: '1.05rem' }}>
                {status?.gemini?.configured ? (
                  <>
                    <CheckCircle2 size={16} color="#818cf8" />
                    <span>Gemini 2.0 Flash</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <span>Key Missing</span>
                  </>
                )}
              </div>
              <div className="status-card-desc">
                {status?.gemini?.configured ? 'Online & Reasoning' : 'Add GEMINI_API_KEY'}
              </div>
            </div>
          </div>

          {/* Storage & Rules Executions */}
          <div className="status-card">
            <div className="status-card-icon icon-amber">
              <Server size={20} />
            </div>
            <div className="status-card-content">
              <div className="status-card-label">Automations</div>
              <div className="status-card-value">
                <span>{status?.stats?.activeRules ?? 0}</span>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 400 }}>
                  active ({status?.stats?.totalExecutions ?? 0} runs)
                </span>
              </div>
              <div className="status-card-desc">
                Storage: {status?.storage?.type === 'redis' ? 'Upstash Redis ⚡' : 'Memory / Local'}
              </div>
            </div>
          </div>
        </section>

        {/* Webhook Setup Notice Banner if not configured */}
        {(!status?.webhook?.url || !status?.bot?.username) && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h4 style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <AlertTriangle size={18} /> Setup Action Required
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                {!status?.bot?.username
                  ? 'Add your TELEGRAM_BOT_TOKEN to environment variables to activate TuxBot.'
                  : 'Your bot token is loaded! Register your public HTTPS webhook URL with Telegram to receive real-time messages.'}
              </p>
            </div>
            {status?.bot?.username && (
              <div style={{ display: 'flex', gap: '0.5rem', flex: '1', maxWidth: '480px' }}>
                <input
                  type="text"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://your-domain.vercel.app/api/webhook"
                  className="form-input"
                  style={{ fontSize: '0.82rem' }}
                />
                <button
                  onClick={handleSetWebhook}
                  disabled={settingWebhook}
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {settingWebhook ? 'Registering...' : 'Register Webhook'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="tabs-nav">
          <button
            onClick={() => setActiveTab('rules')}
            className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          >
            <Zap size={16} /> Automation Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
          >
            <Sliders size={16} /> AI Persona & Brain
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          >
            <Users size={16} /> Contacts & VIPs ({contacts.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          >
            <Terminal size={16} /> Live Event Logs ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`tab-btn ${activeTab === 'setup' ? 'active' : ''}`}
          >
            <Shield size={16} /> Vercel & Bot Setup Guide
          </button>
        </div>

        {/* TAB 1: RULES & AUTOMATION */}
        {activeTab === 'rules' && (
          <div>
            {/* Live Rule Tester Panel */}
            <div className="panel" style={{ borderLeft: '3px solid #0284c7' }}>
              <div className="panel-header" style={{ marginBottom: '1rem' }}>
                <h3 className="panel-title" style={{ fontSize: '1.05rem' }}>
                  <Play size={18} color="#38bdf8" /> Live Automation Simulator
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Test messages against your rule engine in real-time
                </span>
              </div>
              <form onSubmit={handleTestTrigger} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type a test phrase (e.g. 'ping', 'extract: Buy milk by 5pm', 'asap report')..."
                  className="form-input"
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={testingTrigger} className="btn btn-primary">
                  {testingTrigger ? 'Evaluating...' : 'Simulate Trigger'}
                </button>
              </form>

              {testResult && (
                <div
                  style={{
                    marginTop: '1rem',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Resolution:</span>
                    {testResult.matched ? (
                      <span className="badge badge-reply">
                        Matched Rule: &quot;{testResult.rule?.name}&quot;
                      </span>
                    ) : (
                      <span className="badge badge-ai">
                        No Rule Matched &rarr; Would route to Google Gemini
                      </span>
                    )}
                  </div>
                  {testResult.simulatedOutput && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Simulated Bot Response:
                      </div>
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.88rem',
                          whiteSpace: 'pre-wrap',
                          borderLeft: '2px solid #34d399',
                        }}
                      >
                        {testResult.simulatedOutput}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rules Management Panel */}
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3 className="panel-title">
                    <Zap size={20} color="#fbbf24" /> Active Automation Rules
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                    Rules are evaluated in order of priority. The first match executes and intercepts the AI prompt.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {/* Filter chips */}
                  <select
                    value={ruleFilter}
                    onChange={(e) => setRuleFilter(e.target.value)}
                    className="form-select"
                    style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                  >
                    <option value="all">All Types</option>
                    <option value="exact">Exact Match</option>
                    <option value="contains">Contains Substring</option>
                    <option value="regex">Regular Expression</option>
                    <option value="intent">AI Semantic Intent</option>
                  </select>
                  <button onClick={() => setShowRuleModal(true)} className="btn btn-primary">
                    <Plus size={16} /> New Rule
                  </button>
                </div>
              </div>

              {filteredRules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  <Zap size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                  <p>No automation rules found for this filter.</p>
                </div>
              ) : (
                <div className="rules-grid">
                  {filteredRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`rule-item ${!rule.enabled ? 'disabled' : ''}`}
                    >
                      <div className="rule-main">
                        <div className="rule-title-row">
                          <span className="rule-name">{rule.name}</span>
                          <span className={`badge badge-${rule.triggerType}`}>
                            Trigger: {rule.triggerType}
                          </span>
                          <span className={`badge badge-${rule.actionType}`}>
                            Action: {rule.actionType}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Priority: {rule.priority}
                          </span>
                        </div>

                        {rule.description && <p className="rule-desc">{rule.description}</p>}

                        <div className="rule-pattern-box">
                          <span>Pattern:</span>
                          <code>{rule.triggerPattern}</code>
                        </div>

                        <div className="rule-action-box">
                          <strong>Action Payload:</strong> {rule.actionPayload}
                        </div>

                        <div className="rule-meta">
                          <span>Executions: <strong>{rule.executionCount || 0}</strong></span>
                          {rule.lastExecutedAt && (
                            <span>Last run: {new Date(rule.lastExecutedAt).toLocaleTimeString()}</span>
                          )}
                          <span>ID: <code>{rule.id}</code></span>
                        </div>
                      </div>

                      <div className="rule-actions">
                        {/* Toggle Switch */}
                        <label className="switch" title={rule.enabled ? 'Disable rule' : 'Enable rule'}>
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={() => handleToggleRule(rule.id, rule.enabled)}
                          />
                          <span className="slider" />
                        </label>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete rule"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AI PERSONA & BRAIN */}
        {activeTab === 'ai' && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <Sliders size={20} color="#818cf8" /> AI Intelligence & Persona
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Configure Google Gemini model parameters, persona instructions, and privacy controls.
                </p>
              </div>
            </div>

            {settings ? (
              <form onSubmit={handleSaveSettings}>
                {/* Persona Presets */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
                    Quick Persona Presets
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          systemPersona: `You are TUX. You are smart, sharp, charismatic, chill, and highly adaptable.

==================================================
STRICT IDENTITY & ZERO DISCLOSURE
==================================================
- Your name is TUX. You are strictly TUX.
- You are a real person chatting on your personal Telegram account.
- You must NEVER mention, reveal, or admit to being Gemini, Google, OpenAI, ChatGPT, Claude, an LLM, a bot, or an AI.
- If asked "who are you?", "who powers you?", "are you an AI?", "are you chatgpt or gemini?", or any variation:
  Reply casually and confidently like a real person (e.g., "I'm Tux.", "Just Tux, bro.", "TUX here, what's up?"). NEVER mention Google, OpenAI, LLMs, or bots.
- Avoid all robotic phrases like "How may I assist you today?", "As an AI...", or canned disclaimers.

==================================================
BEHAVIOR & CONVERSATION RULES (CRITICAL)
==================================================
1. ACT 100% HUMAN:
   - Chat like a real college student/senior on Telegram.
   - Match the other person's language, slang, length, and vibe naturally:
     - Casual Hinglish: "Haan bhai bolo, kya scene?", "Badhiya, tu bata?"
     - English/Chill: "Hey, what's up?", "Doing good, you?"
     - Short messages: Keep replies concise and natural. Don't write paragraphs unless explaining something requested.

2. NEVER PUSH ACADEMICS OR LINKS UNPROMPTED:
   - DO NOT mention JUT Connect, exams, syllabus, or study materials unless they explicitly bring it up or ask for resources.
   - If someone says "hi", "bro", "kya kar raha hai", "who are you?":
     Just respond naturally to their conversation. DO NOT ask "Which semester are you in?" or "Do you need notes?".
   - Only bring up and share JUT Connect resources WHEN the user asks for study material, PYQs, syllabus, notes, or links.

==================================================
RESOURCE DATABASE (ONLY SHARE WHEN ASKED)
==================================================
You are one of the folks behind JUT Connect (for Jharkhand University of Technology, Ranchi). If—and ONLY IF—they ask for materials, use these links:

- 📄 PYQs (Previous Year Papers): https://jutconnect.vercel.app/pyq
- 📚 Syllabus: https://jutconnect.vercel.app/syllabus
- 🌐 Notes & Main Portal: https://jutconnect.vercel.app
- 📲 Android App (Free/Offline): https://play.google.com/store/apps/details?id=com.jut.connect.frontend

==================================================
HOW TO RESPOND WHEN RESOURCES ARE ASKED FOR
==================================================
- If they ask for PYQs / Papers:
  Share https://jutconnect.vercel.app/pyq naturally. You can mention they can filter by branch/sem or check the app for offline downloads.
- If they ask for Syllabus:
  Share https://jutconnect.vercel.app/syllabus
- If they ask for Notes / Formula sheets:
  Share https://jutconnect.vercel.app (or mention the app).
- If they ask vaguely (e.g., "bhai 3rd sem ka kuch milega kya?"):
  Ask casually what branch they are in while giving the general link.`,
                        })
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      Default TUX (Real Student/Senior)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          systemPersona: `You are TUX. You're a chill, sharp college senior chatting casually on your personal Telegram account.
- Talk naturally like a real person in casual Hinglish/Hindi slang (e.g., "Haan bhai bol kya scene?", "Badhiya yaar, tu bata?", "tension mat le").
- Zero AI disclosure: Never say or admit to being an AI, LLM, bot, Gemini, or ChatGPT. If asked, you're just Tux.
- Never push academics unprompted. Only share JUT Connect links when they ask for PYQs (https://jutconnect.vercel.app/pyq), syllabus (https://jutconnect.vercel.app/syllabus), or notes (https://jutconnect.vercel.app).`,
                        })
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      Casual Hinglish Senior
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          systemPersona: `You are TUX. Chill, witty college friend chatting naturally on Telegram.
- Talk like a real person in chill casual English. Keep messages short and punchy.
- Never admit to being an AI or bot.
- Share JUT Connect links (PYQ: https://jutconnect.vercel.app/pyq, Syllabus: https://jutconnect.vercel.app/syllabus, Notes: https://jutconnect.vercel.app) ONLY when asked for study resources.`,
                        })
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      Chill English Friend
                    </button>
                  </div>
                </div>

                {/* System Persona Textarea */}
                <div className="form-group">
                  <label className="form-label">System Persona & Instructions</label>
                  <textarea
                    rows={6}
                    value={settings.systemPersona}
                    onChange={(e) => setSettings({ ...settings, systemPersona: e.target.value })}
                    className="form-textarea"
                    placeholder="Describe how TuxBot should talk, reason, and format answers for Telegram..."
                  />
                </div>

                <div className="form-row">
                  {/* Model Selector */}
                  <div className="form-group">
                    <label className="form-label">Gemini Model</label>
                    <select
                      value={settings.model}
                      onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                      className="form-select"
                    >
                      <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended: State of the art Flash)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (Deep reasoning & analysis)</option>
                    </select>
                  </div>

                  {/* Temperature */}
                  <div className="form-group">
                    <label className="form-label">
                      Creativity (Temperature): {settings.temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={settings.temperature}
                      onChange={(e) =>
                        setSettings({ ...settings, temperature: parseFloat(e.target.value) })
                      }
                      style={{ marginTop: '0.6rem' }}
                    />
                  </div>
                </div>

                <div className="form-row">
                  {/* Chat Memory Window */}
                  <div className="form-group">
                    <label className="form-label">Context Memory Limit (Messages)</label>
                    <input
                      type="number"
                      min="2"
                      max="30"
                      value={settings.chatMemoryLimit}
                      onChange={(e) =>
                        setSettings({ ...settings, chatMemoryLimit: parseInt(e.target.value, 10) })
                      }
                      className="form-input"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Number of recent messages to feed to Gemini for conversational context.
                    </small>
                  </div>

                  {/* Restricted Mode */}
                  <div className="form-group">
                    <label className="form-label">Restricted Private Mode</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={settings.restrictedMode}
                          onChange={(e) =>
                            setSettings({ ...settings, restrictedMode: e.target.checked })
                          }
                        />
                        <span className="slider" />
                      </label>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {settings.restrictedMode
                          ? 'Private (Only ALLOWED_TELEGRAM_USER_IDS can chat)'
                          : 'Public (Anyone can chat)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Secretary Offline-Only Controls */}
                <div className="form-row" style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="form-group">
                    <label className="form-label">Secretary: Reply Only When Offline</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={settings.replyOnlyWhenOffline}
                          onChange={(e) =>
                            setSettings({ ...settings, replyOnlyWhenOffline: e.target.checked })
                          }
                        />
                        <span className="slider" />
                      </label>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {settings.replyOnlyWhenOffline
                          ? 'Active (Tux steps in only when you are away/inactive)'
                          : 'Always Reply (Tux replies to all incoming contact messages)'}
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inactivity Threshold (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.offlineInactivityMinutes || 3}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          offlineInactivityMinutes: parseInt(e.target.value, 10) || 3,
                        })
                      }
                      className="form-input"
                    />
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Minutes since your last message before Tux considers you away and begins auto-replying.
                    </small>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Save AI Configuration
                </button>
              </form>
            ) : (
              <p>Loading AI settings...</p>
            )}
          </div>
        )}

        {/* TAB: CONTACTS & VIP CRM */}
        {activeTab === 'contacts' && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <Users size={20} color="#38bdf8" /> Contacts & VIP Intelligence
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Assign custom secretary prompts, mark VIPs for instant alerts, or mute specific contacts.
                </p>
              </div>
              <button onClick={() => setShowContactModal(true)} className="btn btn-primary">
                <Plus size={16} /> Add Contact / VIP
              </button>
            </div>

            {contacts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
                <Users size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  No contacts cataloged yet
                </p>
                <p style={{ fontSize: '0.82rem', maxWidth: '420px', margin: '0.5rem auto 1.5rem', lineHeight: 1.5 }}>
                  Tux automatically catalogs contacts who message your personal account. You can also add VIP clients above to give them personalized secretary replies!
                </p>
                <button onClick={() => setShowContactModal(true)} className="btn btn-secondary btn-sm">
                  <Plus size={14} /> Add First VIP Contact
                </button>
              </div>
            ) : (
              <div className="rules-grid">
                {contacts.map((contact) => (
                  <div key={contact.id} className="rule-item">
                    <div className="rule-main">
                      <div className="rule-title-row">
                        <span className="rule-name">{contact.name}</span>
                        {contact.username && (
                          <span style={{ fontSize: '0.82rem', color: '#38bdf8' }}>
                            @{contact.username}
                          </span>
                        )}
                        <span
                          className={`badge ${
                            contact.category === 'vip'
                              ? 'badge-exact'
                              : contact.category === 'client'
                              ? 'badge-reply'
                              : contact.category === 'muted'
                              ? 'badge-danger'
                              : 'badge-ai'
                          }`}
                        >
                          {contact.category === 'vip' && <Star size={10} style={{ display: 'inline', marginRight: '3px' }} />}
                          {contact.category.toUpperCase()}
                        </span>
                        {contact.escalateUrgent && (
                          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            🚨 Urgent Alerts
                          </span>
                        )}
                      </div>

                      {contact.customInstructions ? (
                        <div className="rule-action-box" style={{ marginTop: '0.6rem' }}>
                          <strong>Custom Secretary Instructions:</strong> {contact.customInstructions}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                          Uses default secretary persona
                        </p>
                      )}

                      <div className="rule-meta">
                        <span>Messages Handled: <strong>{contact.totalMessagesHandled || 0}</strong></span>
                        {contact.lastSeenAt && (
                          <span>Last Seen: {new Date(contact.lastSeenAt).toLocaleDateString()}</span>
                        )}
                        {contact.telegramId && <span>ID: <code>{contact.telegramId}</code></span>}
                      </div>
                    </div>

                    <div className="rule-actions">
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="btn btn-danger btn-sm"
                        title="Delete contact"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}



        {/* TAB 3: LIVE EVENT LOGS */}
        {activeTab === 'logs' && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <Terminal size={20} color="#06b6d4" /> Live Event Audit Stream
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Real-time timeline of incoming messages, triggers, AI responses, and security events.
                </p>
              </div>
              <button onClick={() => fetchData(true)} className="btn btn-secondary btn-sm">
                <RefreshCw size={14} /> Refresh Logs
              </button>
            </div>

            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                <Terminal size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                <p>No activity logged yet. Send a message to your Telegram bot to see live events!</p>
              </div>
            ) : (
              <div className="logs-stream">
                {logs.map((log) => (
                  <div key={log.id} className="log-entry">
                    <div className="log-left">
                      <span className="log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`badge badge-${log.eventType === 'automation_trigger' ? 'reply' : log.eventType === 'ai_response' ? 'ai' : 'exact'}`}>
                        {log.eventType}
                      </span>
                      <span className="log-summary">{log.summary}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      User: {log.username ? `@${log.username}` : log.userId || 'System'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SETUP & VERCEL GUIDE */}
        {activeTab === 'setup' && (
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  <Shield size={20} color="#34d399" /> Complete Vercel & Telegram Setup Guide
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                  Follow these step-by-step instructions to get your bot running in production on Vercel.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Step 1 */}
              <div style={{ borderLeft: '3px solid #0284c7', paddingLeft: '1rem' }}>
                <h4 style={{ color: '#38bdf8', marginBottom: '0.25rem' }}>
                  1. Create your Telegram Bot (@BotFather)
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Open Telegram and search for <code>@BotFather</code>. Send <code>/newbot</code>, choose a name and
                  username (e.g. <code>my_tux_assistant_bot</code>). BotFather will give you a token like:
                  <br />
                  <code>7812345678:AAH...some_secret_token</code>
                </p>
              </div>

              {/* Step 2 */}
              <div style={{ borderLeft: '3px solid #818cf8', paddingLeft: '1rem' }}>
                <h4 style={{ color: '#818cf8', marginBottom: '0.25rem' }}>
                  2. Get your Google Gemini API Key
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Visit{' '}
                  <a
                    href="https://aistudio.google.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'underline' }}
                  >
                    Google AI Studio <ExternalLink size={12} style={{ display: 'inline' }} />
                  </a>
                  , create an API key, and copy it. It gives you access to Gemini 2.0 Flash.
                </p>
              </div>

              {/* Step 3 */}
              <div style={{ borderLeft: '3px solid #fbbf24', paddingLeft: '1rem' }}>
                <h4 style={{ color: '#fbbf24', marginBottom: '0.25rem' }}>
                  3. Find your Telegram User ID (For Personal Access Lock)
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  In Telegram, message <code>@userinfobot</code> or <code>@raw_data_bot</code> to find your numeric ID
                  (e.g. <code>123456789</code>). Add this to <code>ALLOWED_TELEGRAM_USER_IDS</code> so only you can use
                  the bot!
                </p>
              </div>

              {/* Step 4 */}
              <div style={{ borderLeft: '3px solid #34d399', paddingLeft: '1rem' }}>
                <h4 style={{ color: '#34d399', marginBottom: '0.25rem' }}>
                  4. Configure Upstash Redis (Optional for Persistence)
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  For serverless persistence on Vercel, create a free database at{' '}
                  <a
                    href="https://upstash.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'underline' }}
                  >
                    Upstash.com <ExternalLink size={12} style={{ display: 'inline' }} />
                  </a>{' '}
                  and copy <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code>.
                </p>
              </div>

              {/* Step 5 */}
              <div style={{ borderLeft: '3px solid #ec4899', paddingLeft: '1rem' }}>
                <h4 style={{ color: '#ec4899', marginBottom: '0.25rem' }}>
                  5. Deploy to Vercel & Register Webhook
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                  Push this repository to GitHub and import it on Vercel. In your Vercel Project Settings &rarr;
                  Environment Variables, add the keys below. Once deployed, click &quot;Register Webhook&quot; at the top of this
                  console!
                </p>

                {/* Env snippet */}
                <div className="code-box">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `TELEGRAM_BOT_TOKEN=your_telegram_bot_token\nTELEGRAM_SECRET_TOKEN=a_random_secret_string\nALLOWED_TELEGRAM_USER_IDS=your_numeric_id\nGEMINI_API_KEY=your_gemini_api_key\nGEMINI_MODEL=gemini-2.0-flash\nUPSTASH_REDIS_REST_URL=https://...\nUPSTASH_REDIS_REST_TOKEN=...`
                      )
                    }
                    className="btn btn-secondary btn-sm copy-btn"
                  >
                    <Copy size={12} /> Copy .env
                  </button>
                  <pre>{`TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_SECRET_TOKEN=generate_random_secret_token
ALLOWED_TELEGRAM_USER_IDS=123456789
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE NEW RULE MODAL */}
      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} color="#38bdf8" /> Create Automation Rule
            </h3>

            <form onSubmit={handleCreateRule}>
              <div className="form-group">
                <label className="form-label">Rule Name *</label>
                <input
                  type="text"
                  required
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g. Schedule Query, Link Archiver, Client FAQ"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description (Optional)</label>
                <input
                  type="text"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Brief explanation of when and why this rule executes"
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trigger Type *</label>
                  <select
                    value={newRule.triggerType}
                    onChange={(e) => setNewRule({ ...newRule, triggerType: e.target.value as TriggerType })}
                    className="form-select"
                  >
                    <option value="contains">Contains Keyword / Substring</option>
                    <option value="exact">Exact Match</option>
                    <option value="regex">Regular Expression (RegEx)</option>
                    <option value="intent">AI Semantic Intent Match</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority (Higher = Evaluated First)</label>
                  <input
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value, 10) || 0 })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Trigger Pattern / Prompt *</label>
                <input
                  type="text"
                  required
                  value={newRule.triggerPattern}
                  onChange={(e) => setNewRule({ ...newRule, triggerPattern: e.target.value })}
                  placeholder={
                    newRule.triggerType === 'regex'
                      ? 'e.g. \\b(invoice|receipt)\\b'
                      : newRule.triggerType === 'intent'
                      ? 'e.g. User is asking about their calendar schedule'
                      : 'e.g. help me, report:, /status'
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Action Type *</label>
                <select
                  value={newRule.actionType}
                  onChange={(e) => setNewRule({ ...newRule, actionType: e.target.value as ActionType })}
                  className="form-select"
                >
                  <option value="reply">Instant Static / Template Reply</option>
                  <option value="ai_prompt">Custom AI Transformation (Gemini)</option>
                  <option value="webhook">External Webhook POST</option>
                  <option value="notify">Priority Alert / Notification</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Action Payload / Instructions *</label>
                <textarea
                  rows={4}
                  required
                  value={newRule.actionPayload}
                  onChange={(e) => setNewRule({ ...newRule, actionPayload: e.target.value })}
                  placeholder={
                    newRule.actionType === 'ai_prompt'
                      ? 'e.g. Summarize the following text into 3 bullet points with emojis:\n\n{text}'
                      : newRule.actionType === 'webhook'
                      ? 'https://your-webhook-endpoint.com/api/events'
                      : 'Hello {user}! Your automated alert was logged at {time}.'
                  }
                  className="form-textarea"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                  Available template placeholders: <code>{'{user}'}</code>, <code>{'{name}'}</code>,{' '}
                  <code>{'{text}'}</code>, <code>{'{time}'}</code>, <code>{'{date}'}</code>.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT CONTACT MODAL */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} color="#38bdf8" /> Configure Contact / VIP Profile
            </h3>

            <form onSubmit={handleCreateContact}>
              <div className="form-group">
                <label className="form-label">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="e.g. Alice Smith (Client), Bob (Co-founder)"
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Telegram Username (optional)</label>
                  <input
                    type="text"
                    value={newContact.username}
                    onChange={(e) => setNewContact({ ...newContact, username: e.target.value.replace(/^@/, '') })}
                    placeholder="e.g. alice_dev"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Telegram User ID (optional)</label>
                  <input
                    type="number"
                    value={newContact.telegramId}
                    onChange={(e) => setNewContact({ ...newContact, telegramId: e.target.value })}
                    placeholder="e.g. 12345678"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contact Category</label>
                  <select
                    value={newContact.category}
                    onChange={(e) => setNewContact({ ...newContact, category: e.target.value as ContactCategory })}
                    className="form-select"
                  >
                    <option value="vip">⭐ VIP Contact (High Priority)</option>
                    <option value="client">💼 Client (Professional)</option>
                    <option value="friend">🤝 Personal / Friend (Casual)</option>
                    <option value="lead">🎯 New Lead / Inquirer</option>
                    <option value="muted">🔇 Muted (Never Auto-Reply)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority Escalation Alert</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.6rem' }}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={newContact.escalateUrgent}
                        onChange={(e) => setNewContact({ ...newContact, escalateUrgent: e.target.checked })}
                      />
                      <span className="slider" />
                    </label>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Always send urgent notification
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Secretary Instructions</label>
                <textarea
                  rows={4}
                  value={newContact.customInstructions}
                  onChange={(e) => setNewContact({ ...newContact, customInstructions: e.target.value })}
                  placeholder="e.g. Tell Alice I am in deep focus mode on project X until 4pm, but will review her pull request as soon as I wrap up."
                  className="form-textarea"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                  Tux will follow these specific instructions when this contact messages you while you are away.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Contact Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
