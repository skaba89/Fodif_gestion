'use client';

import type { ReactNode } from 'react';
import styles from './ResponsiveTable.module.css';

export type ResponsiveColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

export default function ResponsiveTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  emptyMessage = 'Aucune donnée disponible.',
}: {
  rows: T[];
  columns: ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
  caption: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <div className={styles.empty} role="status">{emptyMessage}</div>;
  }

  return (
    <div className={styles.region}>
      <div className={styles.desktop} tabIndex={0} role="region" aria-label={`${caption} — tableau défilable horizontalement si nécessaire`}>
        <table className={styles.table}>
          <caption className={styles.caption}>{caption}</caption>
          <thead>
            <tr>{columns.map((column) => <th scope="col" key={column.key}>{column.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobile} role="list" aria-label={`${caption} — vue mobile`}>
        {rows.map((row) => (
          <article className={styles.card} role="listitem" key={rowKey(row)}>
            <dl className={styles.definitionList}>
              {columns.map((column) => (
                <div key={column.key}>
                  <dt>{column.header}</dt>
                  <dd>{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
