import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import ExplorerClient from './ExplorerClient';

export const metadata: Metadata = {
  title: 'Relationship Explorer | CASEPULSE',
  description:
    'Interactive visual network topology mapping connections between regulated institutions, complaint dockets, and coordinating bureaus.',
};

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading Regulatory Relationship Topology...</p>
        </div>
      }
    >
      <ExplorerClient />
    </Suspense>
  );
}
