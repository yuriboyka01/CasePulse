import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#F4F4EF] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/login" className="inline-flex items-center gap-3" aria-label="CASEPULSE sign in">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A5535] text-white shadow-sm"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
            <span><span className="block text-sm font-bold tracking-[0.08em] text-[#252923]">CASEPULSE</span><span className="block text-[9px] uppercase tracking-[0.18em] text-[#77796F]">Officer workspace</span></span>
          </Link>
          <span className="hidden text-xs text-[#888B82] sm:block">Access is reviewed by an administrator</span>
        </header>
        <div className="flex justify-center"><SignupForm /></div>
      </div>
    </div>
  );
}
