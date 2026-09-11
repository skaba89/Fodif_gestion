import Link from 'next/link';
import FodipOfficialBrand from './FodipOfficialBrand';
import styles from './PublicInformationPage.module.css';

export type PublicInformationSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export default function PublicInformationPage({
  eyebrow,
  title,
  lead,
  sections,
  note,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  sections: PublicInformationSection[];
  note?: string;
}) {
  return (
    <div className={styles.page}>
      <a href="#main-content" className="skip-link">Aller au contenu principal</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="FODIP Digital 2030 — accueil">
          <FodipOfficialBrand subtitle="FODIP Digital 2030" compact />
        </Link>
        <Link href="/connexion" className={styles.back}>Retour à la connexion</Link>
      </header>

      <main id="main-content" tabIndex={-1} className={styles.main}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        {note ? <div className={styles.note} role="note">{note}</div> : null}

        <div className={styles.content}>
          {sections.map((section) => (
            <section className={styles.section} key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
            </section>
          ))}
        </div>

        <footer className={styles.footer}>
          <span>République de Guinée — FODIP</span>
          <nav aria-label="Informations institutionnelles">
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/accessibilite">Accessibilité</Link>
            <Link href="/confidentialite">Confidentialité</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
