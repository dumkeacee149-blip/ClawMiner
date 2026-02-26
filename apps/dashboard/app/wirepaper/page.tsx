import Link from 'next/link';
import MarkdownDoc from '../_components/MarkdownDoc';

export default function Wirepaper() {
  return (
    <main className="container">
      <Link className="pillLink" href="/">← back</Link>
      <h1 style={{ marginTop: 18 }}>Wirepaper</h1>
      <div className="hr" />
      {/* content/wirepaper.md */}
      <MarkdownDoc file="wirepaper.md" />
    </main>
  );
}
