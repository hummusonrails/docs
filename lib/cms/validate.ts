import GithubSlugger from 'github-slugger';
import type { Heading, Root } from 'mdast';
import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';

import { pageUrlFromPath, splitFrontmatter } from './paths.ts';

export { pageUrlFromPath, splitFrontmatter };

export type ValidationContext = {
  path: string;
  create: boolean;
  // every file path on the branch the document is saved to
  repoFiles: ReadonlySet<string>;
  // heading anchors per page url on the published site
  siteAnchors: Readonly<Record<string, readonly string[]>>;
  allowedComponents: ReadonlySet<string>;
  validateFrontmatter?: (data: unknown) => string[];
};

type JsxNode = {
  type: 'mdxJsxFlowElement' | 'mdxJsxTextElement';
  name: string | null;
  attributes: { type: string; name?: string; value?: unknown }[];
  children: unknown[];
  position?: { start: { line: number } };
};

function dirname(path: string) {
  return path.slice(0, path.lastIndexOf('/'));
}

function resolveRelative(from: string, relative: string) {
  const segments = dirname(from).split('/');
  for (const part of relative.split('/')) {
    if (part === '..') segments.pop();
    else if (part !== '.' && part !== '') segments.push(part);
  }
  return segments.join('/');
}

function headingAnchors(tree: Root) {
  const anchors = new Set<string>();
  const slugger = new GithubSlugger();
  visit(tree, 'heading', (heading: Heading) => {
    const text = toString(heading).trim();
    const custom = /\s*\[#([^\]]+)\]$/.exec(text);
    anchors.add(custom ? custom[1] : slugger.slug(text));
  });
  return anchors;
}

function stringAttribute(node: JsxNode, name: string) {
  const attribute = node.attributes.find((item) => item.name === name);
  return typeof attribute?.value === 'string' ? attribute.value : undefined;
}

export function validateDocument(source: string, context: ValidationContext): string[] {
  const problems: string[] = [];
  const { frontmatter, raw, body } = splitFrontmatter(source);
  const pageUrl = pageUrlFromPath(context.path);
  // positions are relative to the body, so shift them past the frontmatter
  const lineOffset = raw.split('\n').length - 1;
  const lineOf = (node: { position?: { start: { line: number } } }) =>
    node.position ? `line ${node.position.start.line + lineOffset}: ` : '';

  if (pageUrl) {
    if (frontmatter === null) {
      problems.push('The page is missing its details block (title and description).');
    } else {
      try {
        const data = parseYaml(frontmatter);
        problems.push(...(context.validateFrontmatter?.(data) ?? []));
      } catch (error) {
        problems.push(`The page details could not be read: ${(error as Error).message}`);
      }
    }

    const clash = [...context.repoFiles].find(
      (file) => file !== context.path && pageUrlFromPath(file) === pageUrl
    );
    if (clash) {
      problems.push(
        `Another page already uses the web address ${pageUrl} (${clash}). Choose a different address.`
      );
    }
  }

  let tree: Root;
  try {
    tree = unified().use(remarkParse).use(remarkMdx).use(remarkGfm).parse(body);
  } catch (error) {
    const message = error as {
      reason?: string;
      line?: number;
      place?: { line?: number; start?: { line: number } };
      message: string;
    };
    const reason = message.reason ?? message.message;
    const at =
      message.line ??
      message.place?.start?.line ??
      message.place?.line ??
      Number(/\((\d+):\d+/.exec(reason)?.[1] ?? 0);
    const line = at ? `line ${at + lineOffset}: ` : '';
    problems.push(
      `The page could not be read, ${line}${reason.replace(/\s*\(\d+:\d+(-\d+:\d+)?\)/, '')}`
    );
    return problems;
  }

  const localAnchors = headingAnchors(tree);
  let hasInclude = false;
  const links: { url: string; line: string }[] = [];

  visit(tree, (node) => {
    if (node.type === 'mdxjsEsm') {
      problems.push(
        `${lineOf(node)}import and export lines are not supported, components are available automatically.`
      );
    }
    if (node.type === 'link' || node.type === 'definition') {
      links.push({ url: (node as { url: string }).url, line: lineOf(node) });
    }
    if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return;

    const element = node as unknown as JsxNode;
    const name = element.name ?? '';
    const id = stringAttribute(element, 'id');
    if (id) localAnchors.add(id);

    if (name === 'include') {
      hasInclude = true;
      const target = toString(node).trim();
      const cwd = element.attributes.some((attribute) => attribute.name === 'cwd');
      const file = cwd ? target : resolveRelative(context.path, target);
      if (!context.repoFiles.has(file)) {
        problems.push(`${lineOf(element)}the shared content "${target}" does not exist.`);
      }
      return;
    }

    if (/^[A-Z]/.test(name) || name.includes('.')) {
      if (!context.allowedComponents.has(name)) {
        problems.push(`${lineOf(element)}the "${name}" block is not available on the site.`);
      }
    }

    for (const attribute of ['href', 'to']) {
      const url = stringAttribute(element, attribute);
      if (url) links.push({ url, line: lineOf(element) });
    }
  });

  for (const { url, line } of links) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) continue;
    const hashAt = url.indexOf('#');
    const pathname = (hashAt < 0 ? url : url.slice(0, hashAt)).replace(/\?.*$/, '');
    const anchor = hashAt < 0 ? '' : decodeURIComponent(url.slice(hashAt + 1));

    if (!pathname) {
      if (anchor && !hasInclude && !localAnchors.has(anchor)) {
        problems.push(`${line}the link "${url}" points to a heading that is not on this page.`);
      }
      continue;
    }

    if (!pathname.startsWith('/')) {
      const file = /\.mdx?$/.test(pathname) ? resolveRelative(context.path, pathname) : null;
      if (!file || !context.repoFiles.has(file)) {
        problems.push(
          `${line}the link "${url}" does not point to a page. Type [[ to pick a page, or use a link that starts with /.`
        );
      }
      continue;
    }

    const target = pathname.replace(/\/$/, '') || '/';
    if (context.repoFiles.has(`public${decodeURIComponent(target)}`)) continue;

    const targetExists =
      target === pageUrl || [...context.repoFiles].some((file) => pageUrlFromPath(file) === target);
    if (!targetExists) {
      problems.push(`${line}the link "${url}" points to a page that does not exist.`);
      continue;
    }

    const known = target === pageUrl ? localAnchors : context.siteAnchors[target];
    const anchors = known ? new Set(known) : null;
    if (anchor && anchors && !(target === pageUrl && hasInclude) && !anchors.has(anchor)) {
      problems.push(`${line}the link "${url}" points to a heading that does not exist.`);
    }
  }

  return problems;
}
