import { NextResponse } from 'next/server';
import { parse as parseYaml } from 'yaml';

import { branchFor, cmsConfig, collectionFor, isEditablePath } from '@/lib/cms/config';
import { withGitHub } from '@/lib/cms/session';
import { splitFrontmatter } from '@/lib/cms/paths';
import { contentDir } from '@/lib/site';
import { source } from '@/lib/source';

function fileName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.mdx$/, '');
}

export const GET = withGitHub(async (github) => {
  const [paths, drafts] = await Promise.all([
    github.listFiles(cmsConfig.baseBranch),
    github.listBranches(cmsConfig.branchPrefix),
  ]);
  const pages = new Map(source.getPages().map((page) => [`${contentDir}/${page.path}`, page]));
  const draftBranches = new Set(drafts);

  const published = paths.filter(isEditablePath).map((path) => {
    const page = pages.get(path);
    return {
      path,
      collection: collectionFor(path)!.id,
      title: page?.data.title ?? fileName(path),
      label: page?.data.sidebar_label ?? page?.data.title ?? fileName(path),
      hasDraft: draftBranches.has(branchFor(path)),
      isNew: false,
    };
  });

  // a branch that matches no published page holds a page created in the editor
  const publishedBranches = new Set(published.map((file) => branchFor(file.path)));
  const newBranches = drafts.filter((branch) => !publishedBranches.has(branch));
  const added = await Promise.all(
    newBranches.map((branch) => github.listAddedFiles(cmsConfig.baseBranch, branch))
  );
  const createdPaths = added
    .flat()
    .filter((path, index, all) => isEditablePath(path) && all.indexOf(path) === index)
    .filter((path) => newBranches.includes(branchFor(path)));
  const created = await Promise.all(
    createdPaths.map(async (path) => {
      const file = await github.getFile(path, branchFor(path));
      const { frontmatter } = splitFrontmatter(file?.content ?? '');
      let data: { title?: unknown; sidebar_label?: unknown } = {};
      try {
        data = (frontmatter ? parseYaml(frontmatter) : {}) ?? {};
      } catch {
        data = {};
      }
      const title = typeof data.title === 'string' ? data.title : fileName(path);
      const label = typeof data.sidebar_label === 'string' ? data.sidebar_label : title;
      return {
        path,
        collection: collectionFor(path)!.id,
        title,
        label,
        hasDraft: true,
        isNew: true,
      };
    })
  );

  return NextResponse.json({ files: [...published, ...created] });
});
