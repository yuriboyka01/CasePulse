import React, { Suspense } from 'react';
import { CASES } from '@/data/synthetic-dataset';
import CaseDetailClient from './CaseDetailClient';

export function generateStaticParams() {
  return CASES.map((c) => ({
    id: c.id,
  }));
}

async function CaseDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CaseDetailClient caseId={id} />;
}

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading regulatory case dossier...</p>
        </div>
      }
    >
      <CaseDetailContent params={params} />
    </Suspense>
  );
}
