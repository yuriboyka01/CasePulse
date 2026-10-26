import { LoginForm } from '@/components/auth/LoginForm';
import { getAuthUiConfig } from '@/lib/server/auth-presentation';

export default function LoginPage() {
  const { isOidcConfigured, isDemoMode } = getAuthUiConfig();

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(480px,0.92fr)]">
      <section className="relative hidden overflow-hidden bg-[#273124] px-12 py-10 text-[#F7F7F1] lg:flex lg:flex-col xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-28 h-[440px] w-[440px] rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 top-44 h-[280px] w-[280px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10"><span className="font-display text-lg font-bold">C</span></span>
          <span><span className="block text-sm font-bold tracking-[0.12em]">CASEPULSE</span><span className="block text-[9px] uppercase tracking-[0.2em] text-white/55">Inter-bureau intelligence</span></span>
        </div>
        <div className="relative my-auto max-w-xl py-20">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C0CBA5]">A shared view for authorized officers</p>
          <h2 className="mt-5 font-display text-5xl font-medium leading-[1.08] tracking-tight xl:text-6xl">One institution.<br />Every case in view.</h2>
          <p className="mt-6 max-w-lg text-sm leading-7 text-white/65">CASEPULSE brings institution-related complaints and bureau actions into one workspace, so teams can track progress and coordinate with context.</p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="block text-sm font-semibold">Case tracking</span><span className="mt-1 block text-xs leading-relaxed text-white/55">Current status, history, and next action.</span></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><span className="block text-sm font-semibold">Overlap review</span><span className="mt-1 block text-xs leading-relaxed text-white/55">Explainable matches for human review.</span></div>
          </div>
        </div>
        <p className="relative text-[10px] text-white/40">Authorized bureau officers only · SIH 2026 prototype</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <LoginForm isOidcConfigured={isOidcConfigured} isDemoMode={isDemoMode} />
      </section>
    </div>
  );
}
