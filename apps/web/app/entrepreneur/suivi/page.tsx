import Link from "next/link";
import styles from "../portal.module.css";

const dossiers = [
  { numero: "FODIP-2026-001845", programme: "Transformation locale", montant: "450 M GNF", statut: "ANALYSE", date: "28/08/2026" },
  { numero: "FODIP-2026-001102", programme: "Modernisation PME", montant: "180 M GNF", statut: "CLOTURE", date: "12/03/2026" },
];

export default function TrackingPage() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Mes dossiers</p>
      <h1 className={styles.title}>Suivi de mes demandes</h1>
      <p className={styles.lead}>Consultez le statut, les prochaines actions et l'historique de traitement de chaque dossier.</p>

      <section className={`${styles.card} ${styles.tableCard} ${styles.section}`}>
        <table className={styles.table}>
          <thead><tr><th>Dossier</th><th>Programme</th><th>Montant</th><th>Soumis le</th><th>Statut</th></tr></thead>
          <tbody>
            {dossiers.map((dossier) => (
              <tr key={dossier.numero}><td><strong>{dossier.numero}</strong></td><td>{dossier.programme}</td><td>{dossier.montant}</td><td>{dossier.date}</td><td><span className={styles.pill}>{dossier.statut}</span></td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.hero}>
        <div className={`${styles.card} ${styles.timeline}`}>
          <div className={styles.sectionHeader}><div><h2>FODIP-2026-001845</h2><p>Historique du dossier actif</p></div></div>
          <div className={styles.timelineItem}><strong>Dossier créé</strong><span>26 août 2026 · Brouillon initial</span></div>
          <div className={styles.timelineItem}><strong>Dossier soumis</strong><span>28 août 2026 · Réception confirmée</span></div>
          <div className={styles.timelineItem}><strong>Vérification administrative terminée</strong><span>30 août 2026 · Pièces principales conformes</span></div>
          <div className={styles.timelineItem}><strong>Analyse en cours</strong><span>1 septembre 2026 · Étude financière et impact</span></div>
        </div>
        <aside className={`${styles.card} ${styles.quick}`}>
          <p className={styles.eyebrow}>Prochaine étape</p>
          <strong>Analyse</strong>
          <small>Le dossier est actuellement étudié. Aucune action n'est requise pour le moment.</small>
          <div className={styles.buttonRow}><Link className={styles.secondary} href="/entrepreneur/demande">Ouvrir le brouillon</Link></div>
        </aside>
      </section>
    </main>
  );
}
