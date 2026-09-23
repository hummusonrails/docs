'use client';

import { useState, type FormEvent } from 'react';
import { stringify } from 'yaml';

import type { Collection } from '@/lib/cms/config';
import { pageUrlFromPath } from '@/lib/cms/paths';
import { siteUrl } from '@/lib/site';

type NewPageFormProps = {
  collection: Collection;
  allPaths: string[];
  onCancel: () => void;
  onCreate: (path: string, content: string) => Promise<void>;
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const previewInclude = '<include cwd>content/partials/_draft-expectations-partial.mdx</include>';

const inputClass = 'mt-1 w-full rounded-sm border bg-transparent px-2 py-1 text-sm';

export function NewPageForm({ collection, allPaths, onCancel, onCreate }: NewPageFormProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [author, setAuthor] = useState('');
  const [sme, setSme] = useState('');
  const [preview, setPreview] = useState(true);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const finalSlug = slug || slugify(title);
  const path = `${collection.directory}/${finalSlug || 'page'}.mdx`;
  const url = pageUrlFromPath(path) ?? '';
  const takenBy = allPaths.find((other) => pageUrlFromPath(other) === url);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError('add a title');
    if (!description.trim()) return setError('add a short description');
    if (!finalSlug) return setError('add a web address');
    if (takenBy) return setError('another page already uses this web address');
    setBusy(true);
    setError(undefined);
    const details: Record<string, string> = {
      title: title.trim(),
      sidebar_label: title.trim(),
      description: description.trim(),
    };
    if (author.trim()) details.dao_author = author.trim();
    if (sme.trim()) details.dao_sme = sme.trim();
    const body = [preview ? previewInclude : null, 'Start writing here.']
      .filter(Boolean)
      .join('\n\n');
    const content = `---\n${stringify(details, { lineWidth: 0 })}---\n\n${body}\n`;
    try {
      await onCreate(path, content);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'could not create the page');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-2 mb-2 space-y-2 rounded-sm border bg-fd-background p-2">
      <label className="block text-xs font-medium">
        Title
        <input
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-xs font-medium">
        Web address
        <input
          value={slug}
          onChange={(event) => setSlug(slugify(event.target.value))}
          placeholder={slugify(title) || 'page-name'}
          className={`${inputClass} font-mono text-xs`}
        />
        <span
          className={`mt-1 block break-all text-[11px] font-normal ${takenBy ? 'text-red-600' : 'text-fd-muted-foreground'}`}
        >
          {siteUrl.replace(/^https?:\/\//, '')}
          {url}
          {takenBy ? ' is already used' : ''}
        </span>
      </label>
      <label className="block text-xs font-medium">
        Description
        <textarea
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value.replace(/\n/g, ' '))}
          className={inputClass}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-medium">
          Author
          <input
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block text-xs font-medium">
          Expert
          <input
            value={sme}
            onChange={(event) => setSme(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={preview}
          onChange={(event) => setPreview(event.target.checked)}
        />
        Show the public preview notice
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-2 py-1 text-xs hover:underline">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-sm bg-fd-primary px-2.5 py-1 text-xs font-medium text-fd-primary-foreground disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
