import { RootProvider } from 'fumadocs-ui/provider/next';
import 'katex/dist/katex.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';

import { siteName, siteUrl } from '@/lib/site';

import './global.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s | ${siteName}`,
    default: siteName,
  },
  icons: {
    icon: '/img/favicon.ico',
  },
  // sandbox deployments are for trying the editor and must not be indexed
  ...(process.env.CMS_SANDBOX === 'true' ? { robots: { index: false, follow: false } } : {}),
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ hotKey: false }}>{children}</RootProvider>
        <Script
          src="https://cdn.usefathom.com/script.js"
          data-site="QLNDABBR"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
