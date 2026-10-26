'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { AuthControls } from './AuthControls';

export function LoginForm({ isOidcConfigured, isDemoMode }: { isOidcConfigured: boolean; isDemoMode: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (!result || result.error) {
        setErrorMessage('We couldn’t sign you in with those details. Check your email and password, or wait for an administrator to approve your access request.');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setErrorMessage('Sign-in is temporarily unavailable. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <Link href="/" className="inline-flex items-center gap-3" aria-label="CASEPULSE home">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A5535] text-white shadow-sm"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
        <span><span className="block text-sm font-bold tracking-[0.08em] text-[#252923]">CASEPULSE</span><span className="block text-[9px] uppercase tracking-[0.18em] text-[#77796F]">Regulatory intelligence</span></span>
      </Link>

      <div className="mt-9">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#697451]">Officer workspace</p>
        <h1 className="mt-2 font-display text-[34px] font-semibold leading-tight tracking-tight text-[#252923]">Welcome back</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#696D64]">Sign in to monitor institution cases and coordinate work across bureaus.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <label className="block text-xs font-semibold text-[#343830]" htmlFor="login-email">Work email
          <input id="login-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organization.gov.in" className="mt-1.5 h-11 w-full rounded-lg border border-[#DADBD4] bg-white px-3.5 text-sm text-[#252923] outline-none transition placeholder:text-[#A1A49C] focus:border-[#697451] focus:ring-4 focus:ring-[#697451]/10" />
        </label>
        <label className="block text-xs font-semibold text-[#343830]" htmlFor="login-password">Password
          <span className="relative mt-1.5 block">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-11 w-full rounded-lg border border-[#DADBD4] bg-white px-3.5 pr-11 text-sm text-[#252923] outline-none transition placeholder:text-[#A1A49C] focus:border-[#697451] focus:ring-4 focus:ring-[#697451]/10" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-[#77796F] hover:text-[#252923] focus-visible:outline-2 focus-visible:outline-[#697451]">
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </span>
        </label>
        {errorMessage && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">{errorMessage}</p>}
        <button type="submit" disabled={isPending} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#4A5535] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#3D472C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4A5535] disabled:cursor-wait disabled:opacity-70">
          {isPending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" /></>}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3 text-xs">
        <Link href="/signup" className="font-semibold text-[#4A5535] underline-offset-4 hover:underline">Sign up for officer access</Link>
        <span className="text-right text-[#888B82]">Forgot password? Contact your administrator.</span>
      </div>

      {isOidcConfigured && <div className="mt-6 border-t border-[#E5E5DE] pt-5"><p className="mb-3 text-center text-[11px] text-[#888B82]">or use organization sign-in</p><AuthControls isOidcConfigured={isOidcConfigured} isDemoMode={false} className="justify-center" /></div>}

      {isDemoMode && <div className="mt-7 border-t border-[#E5E5DE] pt-5">
        <p className="mb-3 text-center text-[11px] font-medium text-[#888B82]">For evaluation and guided demos</p>
        <form action="/api/demo/enter" method="post">
          <button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#DADBD4] bg-white px-4 text-sm font-semibold text-[#343830] transition hover:border-[#AEB39F] hover:bg-[#F7F7F3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#697451]">
            Continue as Demo Officer <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] leading-relaxed text-[#969990]">Opens an evaluation session with sample cases.</p>
      </div>}

      <p className="mt-8 text-center text-[10px] leading-relaxed text-[#9A9D94]">Officer accounts are individually provisioned. Signup requests require administrative approval before access is granted.</p>
    </div>
  );
}
