import React, { Suspense } from 'react';
import { INSTITUTIONS } from '@/data/synthetic-dataset';
import InstitutionDetailClient from './InstitutionDetailClient';

export function generateStaticParams() {
  return INSTITUTIONS.map((inst) => ({
    id: inst.id,
  }));
}

async function InstitutionDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InstitutionDetailClient instId={id} />;
}

export default function InstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading institutional regulatory profile...</p>
        </div>
      }
    >
      <InstitutionDetailContent params={params} />
    </Suspense>
  );
}
