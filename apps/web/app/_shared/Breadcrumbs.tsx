import Link from 'next/link';
import styles from './Breadcrumbs.module.css';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ items, ariaLabel = 'Fil d’Ariane' }: { items: BreadcrumbItem[]; ariaLabel?: string }) {
  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li className={styles.item} key={`${item.href ?? 'current'}-${item.label}`}>
              {!current && item.href ? (
                <Link className={styles.link} href={item.href}>{item.label}</Link>
              ) : (
                <span className={styles.current} aria-current={current ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
