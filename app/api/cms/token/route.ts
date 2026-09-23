import { NextResponse } from 'next/server';

import { cmsSandbox } from '@/lib/cms/config';
import { getGitHubToken } from '@/lib/cms/session';

// large files such as pdf reports exceed the function body limit, so the browser uploads them
// straight to github with the signed in user's own token
export async function GET() {
  if (cmsSandbox)
    return NextResponse.json({ error: 'uploads are turned off in the sandbox' }, { status: 403 });
  const token = await getGitHubToken();
  if (!token) return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
