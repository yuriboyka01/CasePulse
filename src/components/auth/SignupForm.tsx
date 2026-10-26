'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import type { BureauCode } from '@/types';

const BUREAUS: { code: BureauCode; label: string }[] = [
  { code: 'AICTE_APPROVAL', label: 'AICTE Approval Bureau' },
  { code: 'UGC_VIGILANCE', label: 'UGC Vigilance Directorate' },
  { code: 'STATE_DTE_MAHA', label: 'DTE Maharashtra' },
  { code: 'STATE_DTE_KAR', label: 'DTE Karnataka' },
  { code: 'NARC_ANTI_RAGGING', label: 'Anti-Ragging Monitoring Cell' },
  { code: 'CONSUMER_FORUM', label: 'Consumer Disputes Forum' },
];

const fieldClass = 'mt-1.5 h-11 w-full rounded-lg border border-[#DADBD4] bg-white px-3.5 text-sm text-[#252923] outline-none transition placeholder:text-[#A1A49C] focus:border-[#697451] focus:ring-4 focus:ring-[#697451]/10';
const labelClass = 'block text-xs font-semibold text-[#343830]';

export function SignupForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bureauCode, setBureauCode] = useState<BureauCode>('AICTE_APPROVAL');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }
    setIsPending(true);
    try {
      const response = await fetch('/api/auth/access-requests', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, bureauCode, note, password }),
      });
      const body = await response.json().catch(() => null) as { error?: { message?: string }; data?: { requestId?: string } } | null;
      if (!response.ok) {
        setErrorMessage(body?.error?.message || 'We could not submit your request. Please try again.');
        return;
      }
      setRequestId(body?.data?.requestId ?? null);
      setSubmitted(true);
    } catch {
      setErrorMessage('We could not reach the access service. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  if (submitted) {
    return (
      <section className="w-full max-w-[500px] rounded-2xl border border-[#E1E1D9] bg-white p-6 shadow-[0_16px_50px_rgba(36,41,32,0.08)] sm:p-9">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF1E8] text-[#4A5535]"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></span>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-[#252923]">Request received</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#696D64]">Your request is waiting for administrator review. We’ll only activate officer access after your identity and bureau assignment are verified.</p>
        <p className="mt-4 rounded-lg bg-[#F6F6F2] px-3.5 py-3 text-xs leading-relaxed text-[#696D64]">Your password is stored as a one-way hash and won’t be usable to sign in until the request is approved.</p>
        {requestId && <p className="mt-3 text-[11px] text-[#888B82]">Request reference: <span className="font-mono text-[#565A51]">{requestId}</span></p>}
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#4A5535] hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Return to sign in</Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[500px] rounded-2xl border border-[#E1E1D9] bg-white p-6 shadow-[0_16px_50px_rgba(36,41,32,0.08)] sm:p-9">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73776D] hover:text-[#343830]"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in</Link>
      <p className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#697451]">Officer access</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#252923]">Create your account</h1>
      <p className="mt-2 text-sm leading-relaxed text-[#696D64]">Submit your details for review. New accounts do not receive bureau access until an administrator approves the request.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className={labelClass} htmlFor="signup-name">Full name
          <input id="signup-name" required maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your full name" className={fieldClass} />
        </label>
        <label className={labelClass} htmlFor="signup-email">Work email
          <input id="signup-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organization.gov.in" className={fieldClass} />
        </label>
        <label className={labelClass} htmlFor="signup-bureau">Bureau you work with
          <select id="signup-bureau" value={bureauCode} onChange={(event) => setBureauCode(event.target.value as BureauCode)} className={fieldClass}>
            {BUREAUS.map((bureau) => <option key={bureau.code} value={bureau.code}>{bureau.label}</option>)}
          </select>
        </label>
        <label className={labelClass} htmlFor="signup-note">Why do you need access? <span className="font-normal text-[#888B82]">(optional)</span>
          <textarea id="signup-note" maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Role, office, or project context" className="mt-1.5 w-full rounded-lg border border-[#DADBD4] bg-white px-3.5 py-3 text-sm text-[#252923] outline-none transition placeholder:text-[#A1A49C] focus:border-[#697451] focus:ring-4 focus:ring-[#697451]/10" />
        </label>
        <label className={labelClass} htmlFor="signup-password">Create password
          <input id="signup-password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" className={fieldClass} />
        </label>
        <label className={labelClass} htmlFor="signup-confirm">Confirm password
          <input id="signup-confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" className={fieldClass} />
        </label>
        {errorMessage && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">{errorMessage}</p>}
        <button type="submit" disabled={isPending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4A5535] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D472C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4A5535] disabled:cursor-wait disabled:opacity-70">
          {isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Submitting…</> : <>Submit access request <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
        </button>
      </form>
    </section>
  );
}
