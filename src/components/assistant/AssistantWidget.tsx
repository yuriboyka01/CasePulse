'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  FileSearch,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { AssistantContext, AssistantResponse, AssistantSource, AssistantTurn } from '@/lib/assistant-types';
import { useAssistantModal } from './AssistantContext';

interface ChatMessage extends AssistantTurn {
  id: string;
  sources?: AssistantSource[];
}

function resolvePageContext(pathname: string): { context?: AssistantContext; key: string; label?: string } {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 2 && segments[0] === 'cases') {
    const id = decodeURIComponent(segments[1]);
    return { context: { caseId: id }, key: `case:${id}`, label: `Case ${id}` };
  }
  if (segments.length === 2 && segments[0] === 'institutions') {
    const id = decodeURIComponent(segments[1]);
    return { context: { institutionId: id }, key: `institution:${id}`, label: 'Institution profile' };
  }
  return { key: 'general' };
}

const QUICK_PROMPT_CHIPS = [
  'Show most recent cases',
  'Which institutions are Critical Risk?',
  'Summarize 7 cross-bureau overlaps',
  'List overdue SLA dockets',
];

function sourceIcon(type: AssistantSource['type']) {
  if (type === 'case') return <FileSearch className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />;
  if (type === 'institution') return <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />;
  return <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />;
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.code === 'AI_NOT_CONFIGURED') return 'The assistant is not connected yet. Add AI_API_KEY and AI_MODEL to the server environment, then restart CASEPULSE.';
    if (error.code === 'AI_PROVIDER_UNAVAILABLE' || error.code === 'AI_TIMEOUT') return 'The AI service is temporarily unavailable. Your records were not changed. Please try again shortly.';
    if (error.code.startsWith('AI_')) return error.message;
    return error.userFriendlyMessage;
  }
  return 'The assistant could not complete that request. Your records were not changed. Please try again.';
}

function renderInlineMarkdown(
  text: string,
  onSelectPrompt?: (prompt: string) => void
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\[.*?\]\(.*?\)|\*\*.*?\*\*|`.*?`|"(?:Show|List|Which|Summarize|What|Who).*?")/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        parts.push(
          <Link
            key={match.index}
            href={linkMatch[2]}
            className="text-brand font-semibold underline decoration-brand/40 underline-offset-2 hover:text-brand-strong"
          >
            {linkMatch[1]}
          </Link>
        );
      } else {
        parts.push(token);
      }
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-bold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      const rawCode = token.slice(1, -1);
      const cleanPrompt = rawCode.replace(/^["']|["']$/g, '').trim();
      const isPromptLike =
        onSelectPrompt &&
        (cleanPrompt.endsWith('?') ||
          rawCode.startsWith('"') ||
          rawCode.startsWith("'") ||
          QUICK_PROMPT_CHIPS.includes(cleanPrompt) ||
          /^(Show|List|Which|Summarize|What|Who|How|Find|View|Ask)\b/i.test(cleanPrompt));

      if (isPromptLike) {
        parts.push(
          <button
            key={match.index}
            type="button"
            onClick={() => onSelectPrompt(cleanPrompt)}
            title={`Click to ask: "${cleanPrompt}"`}
            className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 my-0.5 rounded-md bg-stone-200/80 dark:bg-black/60 text-[#4A5535] dark:text-[#8FA367] border border-[#4A5535]/30 dark:border-white/10 hover:bg-[#4A5535] hover:text-white dark:hover:bg-[#4A5535] dark:hover:text-white transition-colors cursor-pointer shadow-2xs group text-left"
          >
            <span>{cleanPrompt}</span>
            <span className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform text-[9px]">↵</span>
          </button>
        );
      } else {
        parts.push(
          <code
            key={match.index}
            className="font-mono text-[10px] px-1 py-0.5 rounded bg-stone-200/60 dark:bg-black/50 text-brand border border-line/60"
          >
            {rawCode}
          </code>
        );
      }
    } else if (token.startsWith('"') && token.endsWith('"') && onSelectPrompt) {
      const cleanPrompt = token.slice(1, -1).trim();
      parts.push(
        <button
          key={match.index}
          type="button"
          onClick={() => onSelectPrompt(cleanPrompt)}
          title={`Click to ask: "${cleanPrompt}"`}
          className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 my-0.5 rounded-md bg-stone-200/80 dark:bg-black/60 text-[#4A5535] dark:text-[#8FA367] border border-[#4A5535]/30 dark:border-white/10 hover:bg-[#4A5535] hover:text-white dark:hover:bg-[#4A5535] dark:hover:text-white transition-colors cursor-pointer shadow-2xs group text-left"
        >
          <span>{cleanPrompt}</span>
          <span className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform text-[9px]">↵</span>
        </button>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function formatMessageContent(content: string, onSelectPrompt?: (prompt: string) => void) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-ink">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-sm text-ink pt-1.5 pb-0.5 border-b border-line/40">
              {renderInlineMarkdown(line.slice(4), onSelectPrompt)}
            </h4>
          );
        }
        if (line.startsWith('#### ')) {
          return (
            <h5 key={idx} className="font-semibold text-xs uppercase tracking-wider text-ink-muted pt-1">
              {renderInlineMarkdown(line.slice(5), onSelectPrompt)}
            </h5>
          );
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5">
              <span className="text-brand shrink-0 leading-tight font-bold">•</span>
              <div className="flex-1 min-w-0">{renderInlineMarkdown(line.slice(2), onSelectPrompt)}</div>
            </div>
          );
        }
        if (line.match(/^\d+\.\s/)) {
          const match = line.match(/^(\d+\.)\s(.*)$/);
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1.5">
              <span className="font-mono text-[11px] font-bold text-brand shrink-0">{match?.[1]}</span>
              <div className="flex-1 min-w-0">{renderInlineMarkdown(match?.[2] ?? line, onSelectPrompt)}</div>
            </div>
          );
        }
        if (line.startsWith('> ')) {
          return (
            <blockquote key={idx} className="border-l-2 border-brand pl-2.5 my-1 text-[11px] italic text-ink-muted bg-brand-soft/40 py-1 rounded-r">
              {renderInlineMarkdown(line.slice(2), onSelectPrompt)}
            </blockquote>
          );
        }
        return <p key={idx} className="break-words">{renderInlineMarkdown(line, onSelectPrompt)}</p>;
      })}
    </div>
  );
}

function AssistantLauncher({
  context,
  contextKey,
  contextLabel,
}: {
  context?: AssistantContext;
  contextKey: string;
  contextLabel?: string;
}) {
  const { isOpen, openAssistant, closeAssistant } = useAssistantModal();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  async function sendMessage(rawText: string) {
    const content = rawText.trim();
    if (!content || isLoading) return;
    setError(null);
    setInput('');
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setIsLoading(true);
    try {
      const turns = updated.slice(-8).map(({ role, content: text }): AssistantTurn => ({ role, content: text }));
      const response: AssistantResponse = await apiClient.askAssistant(turns, context);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  const handleResetChat = () => {
    setMessages([]);
    setError(null);
    setInput('');
  };

  return (
    <>
      {/* 3D Tactile Floating Trigger Button (when chat is closed) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-50 pointer-events-auto">
          <button
            type="button"
            onClick={openAssistant}
            aria-label="Ask CASEPULSE AI casework assistant (⌘K)"
            className="group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-b from-[#586540] to-[#424C2F] text-white shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:translate-y-[1px] transition-all cursor-pointer border border-[#6b7b4f]/40"
          >
            {/* Glowing Pulse Indicator */}
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <Bot className="w-4 h-4 text-emerald-200 transition-transform group-hover:scale-110" />
            <span className="text-xs font-bold tracking-wide">Ask CASEPULSE AI</span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-white/25 bg-black/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-100">
              ⌘K
            </kbd>
          </button>
        </div>
      )}

      {/* Floating Glassmorphic Chat Window (NO full-screen backdrop overlay) */}
      {isOpen && (
        <aside
          role="dialog"
          aria-label="CASEPULSE AI casework assistant"
          className="fixed bottom-5 right-5 z-50 w-[390px] sm:w-[420px] h-[550px] max-h-[calc(100vh-80px)] bg-white/88 dark:bg-[#141814]/90 backdrop-blur-xl border border-stone-200/80 dark:border-white/12 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12)] rounded-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          {/* Tactical Glass Header */}
          <header className="flex items-center justify-between gap-3 border-b border-stone-200/80 dark:border-white/10 bg-[#EFECE6]/80 dark:bg-[#0E110E]/80 px-4 py-3 shrink-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-[#586540] to-[#424C2F] text-white shadow-xs">
                <Bot className="h-4 w-4" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-bold text-ink">CASEPULSE AI</h2>
                  <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-brand-soft text-brand font-semibold">
                    Local RAG
                  </span>
                </div>
                <p className="truncate text-[10px] text-ink-muted">
                  {contextLabel ? `Context: ${contextLabel}` : 'Regulatory Intelligence Engine'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={closeAssistant}
                title="Minimize assistant (⌘K)"
                aria-label="Minimize assistant"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Chat Messages Body */}
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5"
          >
            {messages.length === 0 && (
              <div className="space-y-3.5">
                {/* Welcome Card */}
                <div className="rounded-xl border border-stone-200/80 dark:border-white/10 bg-[#FAF9F5] dark:bg-[#1B211B]/60 p-3.5 shadow-2xs">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-ink">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    Evidence-Backed Regulatory AI
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-muted">
                    Ask questions regarding cases, multi-agency overlaps, statutory SLA deadlines, or target institutions. Powered by authoritative database records.
                  </p>
                </div>

                {/* Clickable Quick Prompt Chips */}
                <div>
                  <p className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                    Quick Intelligence Queries
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {QUICK_PROMPT_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void sendMessage(chip)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200/80 dark:border-white/10 bg-white/70 dark:bg-card/70 px-3 py-2 text-left text-xs font-medium text-ink-soft transition-all hover:border-brand/60 hover:bg-brand-soft hover:text-brand disabled:opacity-50 cursor-pointer shadow-2xs"
                      >
                        <span className="truncate">{chip}</span>
                        <span aria-hidden="true" className="text-brand shrink-0">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation turns */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] min-w-0 rounded-2xl px-3.5 py-2.5 ${
                    message.role === 'user'
                      ? 'rounded-br-sm bg-gradient-to-b from-[#586540] to-[#424C2F] text-white shadow-xs'
                      : 'rounded-bl-sm border border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#1B211B]/80 text-ink shadow-2xs'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed font-medium">
                      {message.content}
                    </p>
                  ) : (
                    formatMessageContent(message.content)
                  )}

                  {/* Supporting Records Cited */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2.5 border-t border-line/70 pt-2">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-muted">
                        Cited Evidence Dossiers ({message.sources.length})
                      </p>
                      <div className="space-y-1">
                        {message.sources.slice(0, 4).map((source) => (
                          <Link
                            key={`${source.type}:${source.id}`}
                            href={source.href}
                            className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold text-brand transition hover:bg-brand-soft"
                          >
                            {sourceIcon(source.type)}
                            <span className="min-w-0 truncate">{source.label}</span>
                            <span className="ml-auto text-[9px]">↗</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-stone-200/80 dark:border-white/10 bg-white/80 dark:bg-[#1B211B]/80 px-3.5 py-2.5 text-xs text-ink-muted flex items-center gap-2 shadow-2xs">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  <span>Analyzing cross-bureau case records…</span>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-50/70 dark:bg-red-950/40 p-2.5 text-xs leading-relaxed text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}
          </div>

          {/* Tactical Glass Input Dock */}
          <footer className="border-t border-stone-200/80 dark:border-white/10 bg-[#EFECE6]/60 dark:bg-[#0E110E]/80 p-2.5 shrink-0">
            <form onSubmit={handleSubmit} className="flex items-end gap-1.5 rounded-xl border border-stone-300 dark:border-white/10 bg-white dark:bg-black/40 p-1.5 focus-within:border-brand/70 shadow-2xs">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 1_200))}
                onKeyDown={handleKeyDown}
                maxLength={1_200}
                rows={1}
                placeholder="Ask about cases, overlaps, SLA..."
                aria-label="Ask CASEPULSE AI a question"
                className="max-h-24 min-h-8 flex-1 resize-y bg-transparent px-2 py-1 text-xs text-ink outline-none placeholder:text-ink-muted/70"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send question"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-[#586540] to-[#424C2F] text-white shadow-xs transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
            <p className="mt-1 px-1 text-[9px] leading-tight text-ink-muted flex items-center justify-between">
              <span>Read-only casework guidance.</span>
              <span className="font-mono">{input.length}/1200</span>
            </p>
          </footer>
        </aside>
      )}
      <span className="sr-only" aria-live="polite">Assistant context: {contextKey}</span>
    </>
  );
}

export function AssistantWidget() {
  const pathname = usePathname() ?? '/';
  const pageContext = resolvePageContext(pathname);
  return (
    <AssistantLauncher
      key={pageContext.key}
      context={pageContext.context}
      contextKey={pageContext.key}
      contextLabel={pageContext.label}
    />
  );
}
