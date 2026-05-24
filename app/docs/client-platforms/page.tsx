import Link from 'next/link';
import { readFileSync } from 'fs';
import path from 'path';

function markdownToSections(content: string) {
  return content.split('\n');
}

export default function ClientPlatformsPage() {
  const mdPath = path.join(process.cwd(), 'mt5-bridge', 'CLIENT_PLATFORMS.md');
  let content: string;
  try {
    content = readFileSync(mdPath, 'utf8');
  } catch {
    content = '# Platform guide unavailable\n\nPlease contact support.';
  }

  const lines = markdownToSections(content);

  return (
    <main className="min-h-screen bg-[#0a0e17] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold gradient-text">MT5 Bridge — Platform Guide</h1>
          <Link href="/dashboard" className="text-sm text-cyan-400 hover:underline">
            ← Dashboard
          </Link>
        </div>
        <article className="prose prose-invert max-w-none text-gray-300 space-y-4">
          {lines.map((line, i) => {
            if (line.startsWith('# ')) {
              return null;
            }
            if (line.startsWith('## ')) {
              return (
                <h2 key={i} className="text-xl font-semibold text-white mt-8 mb-2">
                  {line.replace(/^## /, '')}
                </h2>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h3 key={i} className="text-lg font-medium text-cyan-300 mt-4 mb-2">
                  {line.replace(/^### /, '')}
                </h3>
              );
            }
            if (line.startsWith('|')) {
              return (
                <p key={i} className="font-mono text-xs text-gray-400 overflow-x-auto">
                  {line}
                </p>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <li key={i} className="ml-4 list-disc text-sm">
                  {line.replace(/^- /, '')}
                </li>
              );
            }
            if (line.startsWith('```')) return null;
            if (!line.trim()) return <br key={i} />;
            if (line.startsWith('**') && line.endsWith('**')) {
              return (
                <p key={i} className="text-sm font-semibold text-amber-200">
                  {line.replace(/\*\*/g, '')}
                </p>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed">
                {line}
              </p>
            );
          })}
        </article>
      </div>
    </main>
  );
}
