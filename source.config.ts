import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { metaSchema } from 'fumadocs-core/source/schema';
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { docsPageSchema } from './lib/frontmatter-schema';
import { remarkUnnestLinks } from './lib/remark-unnest-links';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: docsPageSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // single dollar math is off so token tickers in prose are never parsed as tex
    remarkPlugins: [
      [remarkMath, { singleDollarTextMath: false }],
      remarkMdxMermaid,
      remarkUnnestLinks,
    ],
    rehypePlugins: (plugins) => [rehypeKatex, ...plugins],
    remarkImageOptions: { external: false },
    // the text variation selector keeps footnote back arrows from rendering as emoji
    remarkRehypeOptions: {
      footnoteBackContent: (_, rereferenceIndex) => [
        { type: 'text', value: '↩︎' },
        ...(rereferenceIndex > 1
          ? [
              {
                type: 'element' as const,
                tagName: 'sup',
                properties: {},
                children: [{ type: 'text' as const, value: String(rereferenceIndex) }],
              },
            ]
          : []),
      ],
    },
  },
});
