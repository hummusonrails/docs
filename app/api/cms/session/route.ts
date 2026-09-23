import { NextResponse } from 'next/server';

import { cmsConfig, cmsSandbox } from '@/lib/cms/config';
import { withGitHub } from '@/lib/cms/session';

export const GET = withGitHub(async (github) =>
  NextResponse.json({
    ...(await github.getViewer()),
    sandbox: cmsSandbox,
    repository: {
      owner: cmsConfig.owner,
      repo: cmsConfig.repo,
      baseBranch: cmsConfig.baseBranch,
    },
  })
);
