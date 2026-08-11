'use client';

// DiffBlock — the console's signature surface.
//
// A change event is, literally, a diff between two snapshots. So it renders as
// one: a gutter carrying the real added/deleted counts from diff_json, and the
// changed lines themselves. Nothing here is decorative; the numbers in the
// gutter are the size of the change.

function classify(line) {
  const t = line.trimStart();
  if (t.startsWith('+')) return 'diff-line diff-line--add';
  if (t.startsWith('-')) return 'diff-line diff-line--del';
  return 'diff-line';
}

/**
 * @param {object}   change    a row from /api/changes
 * @param {number}   maxLines  how many lines to show before truncating
 */
export default function DiffBlock({ change, maxLines = 6 }) {
  if (!change) return null;

  const added = change.diff_json?.added_lines || [];
  const deleted = change.diff_json?.deleted_lines || [];
  const lines = [...added, ...deleted];
  const shown = lines.slice(0, maxLines);
  const hidden = lines.length - shown.length;

  return (
    <div className="diff">
      <div className="diff-gutter" aria-hidden="true">
        <span className="g-id">{change.id}</span>
        <span className="g-add">+{added.length}</span>
        <span className="g-del">−{deleted.length}</span>
      </div>

      <div className="diff-body">
        <span className="sr-only">
          {added.length} lines added, {deleted.length} lines removed
        </span>

        {shown.length === 0 ? (
          <span className="diff-line" style={{ color: 'var(--text-muted)' }}>
            No line-level diff recorded for this change.
          </span>
        ) : (
          shown.map((line, i) => (
            <span key={i} className={classify(line)}>
              {line}
            </span>
          ))
        )}

        {hidden > 0 && (
          <span
            className="diff-line"
            style={{ color: 'var(--text-muted)', marginTop: 6 }}
          >
            … {hidden} more {hidden === 1 ? 'line' : 'lines'}
          </span>
        )}
      </div>
    </div>
  );
}
