import type { Metadata } from 'next';

import { CmsApp } from '@/components/cms/cms-app';
import { cmsSandbox } from '@/lib/cms/config';

export const metadata: Metadata = {
  title: 'Docs editor',
  robots: { index: false, follow: false },
};

// read on each request so the sandbox flag comes from the runtime environment
export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return <CmsApp sandbox={cmsSandbox} />;
}
