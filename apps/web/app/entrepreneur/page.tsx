import Link from "next/link";
import styles from "./portal.module.css";

const steps = [
  { title: "Profil entreprise", text: "Identité, RCCM, NIF, secteur et coordonnées.", status: "Complet", ok: true },
  { title: "Dossier de financement", text: "Complétez le besoin, le plan de financement et l'impact attendu.", status: "En cours", ok: false },
  { title: "Pièces justificatives", text: "Ajoutez les documents demandés avant soumission.", status: "À faire", ok: false },
];

const programs = [
  { tag: "Agro-industrie", name: "Transformation locale", text: "Soutien aux PME qui transforment localement des produits agricoles.", amount: "50 M – 2 Md GNF" },
  { tag: "Jeunes", name: "Entrepreneuriat jeunes", text: "Financement et accompagnement des entreprises portées par de jeunes dirigeants.", amount: "25 M – 750 M GNF" },
  { tag: "Industrie", name: "Modernisation PME", text: "Investissement productif, équipements et montée en capacité industrielle.", amount: "100 M – 5 Md GNF" },
];

export default function EntrepreneurDashboard() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Espace entrepreneur</p>
      <h1 className={styles.title}>Bienvenue sur votre espace FODIP</h1>
      <p className={styles.lead}>Préparez votre entreprise, déposez une demande de financement et suivez son traitement depuis un seul espace.</p>

      <section className={styles.hero}>
        <div className={`${styles.card} ${styles.heroCard}`}>
          <h2>Votre dossier est prêt à 64 %</h2>
          <p>Votre profil entreprise est complet. Il reste à finaliser le plan de financement et à déposer deux pièces justificatives.</p>
          <div className={styles.progress}><span /></div>
          <div className={styles.progressLine}><span>Progression du dossier</span><strong>64 %</strong></div>
          <div className={styles.buttonRow}>
            <Link className={styles.primary} href="/entrepreneur/demande">Continuer ma demande</Link>
            <Link className={styles.secondary} href="/entrepreneur/suivi">Voir mes dossiers</Link>
          </div>
        </div>
        <div className={`${styles.card} ${styles.quick}`}>
          <p className={styles.eyebrow}>Référence PME</p>
          <strong>FODIP-PME-000421</strong>
          <small>Compte démonstration · Kindia · Agro-industrie</small>
          <div className={styles.buttonRow}><Link className={styles.secondary} href="/entrepreneur/entreprise">Mettre à jour ma fiche</Link></div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><h2>Votre parcours</h2><p>Les étapes indispensables avant soumission au FODIP.</p></div></div>
        <div className={styles.grid3}>
          {steps.map((step, i) => (
            <article className={`${styles.card} ${styles.step}`} key={step.title}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}>{i + 1}</span>
                <span className={`${styles.status} ${step.ok ? styles.statusOk : ""}`}>{step.status}</span>
              </div>
              <h3>{step.title}</h3><p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}><div><h2>Programmes accessibles</h2><p>Exemples de programmes affichés à partir de critères d'éligibilité.</p></div></div>
        <div className={styles.programs}>
          {programs.map((program) => (
            <article className={`${styles.card} ${styles.program}`} key={program.name}>
              <span className={styles.programTag}>{program.tag}</span><h3>{program.name}</h3><p>{program.text}</p>
              <div className={styles.meta}><span>Montant indicatif</span><strong>{program.amount}</strong></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
