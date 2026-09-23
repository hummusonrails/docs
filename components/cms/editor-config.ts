import { fumadocsUiComponents, type FileProvider } from '@fumadocs-editor/ui';

import glossary from '@/public/glossary.json';
import { pageUrlFromPath } from '@/lib/cms/paths';
import { allowedComponentNames } from '@/lib/mdx-component-names';

// only offer blocks the site can render, so the slash menu cannot break a deploy
export const editorComponents = fumadocsUiComponents.filter(
  (spec) => spec.name === 'include' || allowedComponentNames.has(spec.name)
);

function relativePath(fromFile: string, toFile: string) {
  const from = fromFile.split('/').slice(0, -1);
  const to = toFile.split('/');
  let shared = 0;
  while (shared < from.length && from[shared] === to[shared]) shared++;
  const up = from.slice(shared).map(() => '..');
  return [...(up.length ? up : ['.']), ...to.slice(shared)].join('/');
}

// feeds the [[ link picker and include autocomplete: page urls, glossary terms and partials
export function createFileProvider(openPath: string, repoPaths: string[]): FileProvider {
  const pages = repoPaths
    .map(pageUrlFromPath)
    .filter((url): url is string => Boolean(url))
    .sort();
  const terms = Object.keys(glossary).map((key) => `/dao-glossary#${key}`);
  const partials = repoPaths
    .filter((path) => path.startsWith('content/partials/'))
    .map((path) => relativePath(openPath, path));
  return { list: async () => [...pages, ...terms, ...partials] };
}
