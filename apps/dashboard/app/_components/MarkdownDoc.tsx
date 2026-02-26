import fs from 'node:fs/promises';
import path from 'node:path';
import ReactMarkdown from 'react-markdown';

export default async function MarkdownDoc({
  file,
}: {
  /** Path under apps/dashboard/content */
  file: string;
}) {
  const p = path.join(process.cwd(), 'content', file);
  const md = await fs.readFile(p, 'utf8');

  return (
    <article className="markdown">
      <ReactMarkdown>{md}</ReactMarkdown>
    </article>
  );
}
