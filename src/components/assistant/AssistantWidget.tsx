'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, FileSearch, MessageCircle, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
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

const GENERAL_PROMPTS = [
  'Find cases involving capitation fees',
  'Explain a recorded relationship',
  'Summarize an institutionâ€™s case history',
];

function suggestions(context?: AssistantContext): string[] {
  if (context?.caseId) {
    return ['Summarize this case', 'Explain its recorded relationships', 'What actions are recorded for this case?'];
  }
  if (context?.institutionId) {
    return ['Summarize this institutionâ€™s recorded case history', 'Find recorded relationships', 'What patterns are visible in these records?'];
  }
  return GENERAL_PROMPTS;
}

function sourceIcon(type: AssistantSource['type']) {
  if (type === 'case') return <FileSearch className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  if (type === 'institution') return <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  return <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
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

function AssistantLauncher({ context, contextKey, contextLabel }: { context?: AssistantContext; contextKey: string; contextLabel?: string }) {
  const { isOpen, closeAssistant } = useAssistantModal();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const promptSuggestions = suggestions(context);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
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
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      }]);
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

  if (!isOpen) {
    return <span className="sr-only" aria-live="polite">Assistant context: {contextKey}</span>;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-end sm:p-6 p-2 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={closeAssistant} aria-hidden="true" />
      <section
        role="dialog"
        aria-label="CASEPULSE AI casework assistant"
        className="relative z-10 flex h-[min(680px,calc(100dvh-4rem))] w-full sm:w-[460px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line bg-card-muted px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-[var(--primary-foreground)] shadow-xs"><Bot className="h-4.5 w-4.5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-ink">CASEPULSE AI</h2>
                <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-brand-soft text-brand font-semibold">Command Assistant</span>
              </div>
              <p className="truncate text-[11px] text-ink-muted">{contextLabel ? `Context: ${contextLabel}` : 'Evidence-backed casework assistant'}</p>
            </div>
          </div>
          <button type="button" onClick={closeAssistant} aria-label="Close assistant" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-raised hover:text-ink"><X className="h-4 w-4" /></button>
        </header>

        <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions text" className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-card-muted/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Sparkles className="h-4 w-4 text-brand" /> Ask with evidence in mind</div>
                <p className="text-xs leading-relaxed text-ink-muted">I can summarize authorized records and explain recorded relationships. I cannot approve reviews or change case data. Use only synthetic or explicitly approved demo data with a hosted provider.</p>
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">Suggested questions</p>
                <div className="space-y-2">
                  {promptSuggestions.map((prompt) => (
                    <button key={prompt} type="button" disabled={isLoading} onClick={() => void sendMessage(prompt)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5 text-left text-xs font-medium text-ink-soft transition hover:border-brand/50 hover:bg-brand-soft disabled:opacity-50">
                      <span>{prompt}</span><span aria-hidden="true" className="text-brand">↗</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] min-w-0 rounded-2xl px-3.5 py-3 ${message.role === 'user' ? 'rounded-br-md bg-brand text-[var(--primary-foreground)]' : 'rounded-bl-md border border-line bg-card-muted text-ink'}`}>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 border-t border-line/70 pt-2.5">
                    <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-ink-muted">Supporting records</p>
                    <div className="space-y-1.5">
                      {message.sources.map((source) => (
                        <Link key={`${source.type}:${source.id}`} href={source.href} onClick={closeAssistant} className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-[10px] text-brand transition hover:bg-brand-soft">
                          {sourceIcon(source.type)}<span className="min-w-0 truncate">{source.label}</span><span className="ml-auto">↗</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-line bg-card-muted px-4 py-3 text-xs text-ink-muted"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-brand" />Reviewing authorized records…</div></div>}
          {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs leading-relaxed text-danger">{error}</div>}
        </div>

        <div className="border-t border-line bg-card px-3 py-3">
          <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded-xl border border-line bg-background p-2 focus-within:border-brand/60">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value.slice(0, 1_200))}
              onKeyDown={handleKeyDown}
              maxLength={1_200}
              rows={1}
              placeholder="Ask about cases or relationships…"
              aria-label="Ask CASEPULSE AI a question"
              className="max-h-28 min-h-9 flex-1 resize-y bg-transparent px-2 py-2 text-xs text-ink outline-none placeholder:text-ink-muted"
            />
            <button type="submit" disabled={isLoading || !input.trim()} aria-label="Send question" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-[var(--primary-foreground)] transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
          </form>
          <p className="mt-2 px-1 text-[9px] leading-relaxed text-ink-muted">AI-generated guidance only. Verify cited records before acting. The assistant is read-only.</p>
        </div>
      </section>
      <span className="sr-only" aria-live="polite">Assistant context: {contextKey}</span>
    </div>
  );
}

export function AssistantWidget() {
  const pathname = usePathname() ?? '/';
  const pageContext = resolvePageContext(pathname);
  return <AssistantLauncher key={pageContext.key} context={pageContext.context} contextKey={pageContext.key} contextLabel={pageContext.label} />;
}
