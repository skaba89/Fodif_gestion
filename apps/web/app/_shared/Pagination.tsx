'use client';

export interface PaginationProps {
  page: number;
  limite: number;
  total: number;
  onChange: (page: number) => void;
  /** CSS module class for the prev/next buttons - reuses the caller's own `secondary` class so the
   * pagination controls stay visually consistent with each portal's existing buttons. */
  buttonClassName: string;
  /** CSS module class for the row wrapper - reuses the caller's own `buttonRow` class. */
  rowClassName: string;
}

/**
 * Shared prev/next pagination control for high-volume server-paginated lists (axe C5 -
 * docs/14-ROADMAP-SAAS-PREMIUM.md). Renders nothing when everything fits on one page, so pages
 * with few results (the common case for a small/medium PME portfolio today) look unchanged.
 */
export default function Pagination({ page, limite, total, onChange, buttonClassName, rowClassName }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / limite));
  if (pageCount <= 1) return null;
  return (
    <div className={rowClassName} role="navigation" aria-label="Pagination">
      <button type="button" className={buttonClassName} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Précédent
      </button>
      <span style={{ alignSelf: 'center', fontSize: '0.85rem' }}>Page {page} sur {pageCount} ({total} au total)</span>
      <button type="button" className={buttonClassName} disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        Suivant →
      </button>
    </div>
  );
}
