import Link from "next/link";
import styles from "../portal.module.css";

export default function FundingApplicationPage() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Nouvelle demande</p>
      <h1 className={styles.title}>Demande de financement</h1>
      <p className={styles.lead}>Un parcours guidé pour constituer un dossier complet avant transmission aux équipes FODIP.</p>

      <div className={styles.wizard}>
        <aside className={`${styles.card} ${styles.wizardSteps}`}>
          <div className={`${styles.wizardStep} ${styles.wizardStepActive}`}>1. Programme & besoin</div>
          <div className={styles.wizardStep}>2. Projet & budget</div>
          <div className={styles.wizardStep}>3. Impact attendu</div>
          <div className={styles.wizardStep}>4. Documents</div>
          <div className={styles.wizardStep}>5. Vérification</div>
        </aside>

        <section className={`${styles.card} ${styles.formCard}`}>
          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label>Programme sollicité</label>
              <select defaultValue="TRANSFORMATION_LOCALE">
                <option value="TRANSFORMATION_LOCALE">Transformation locale</option>
                <option value="JEUNES">Entrepreneuriat jeunes</option>
                <option value="MODERNISATION">Modernisation PME</option>
              </select>
            </div>
            <div className={styles.field}><label>Montant demandé (GNF)</label><input type="number" defaultValue="450000000" /></div>
            <div className={styles.field}><label>Apport personnel (GNF)</label><input type="number" defaultValue="75000000" /></div>
            <div className={`${styles.field} ${styles.fieldFull}`}><label>Objet du financement</label><input defaultValue="Acquisition d'une ligne de conditionnement et fonds de roulement" /></div>
            <div className={`${styles.field} ${styles.fieldFull}`}><label>Description du projet</label><textarea defaultValue="Augmenter la capacité de transformation locale, réduire les pertes post-récolte et ouvrir deux nouveaux circuits de distribution." /></div>
            <div className={styles.field}><label>Emplois directs prévus</label><input type="number" defaultValue="12" /></div>
            <div className={styles.field}><label>Durée souhaitée (mois)</label><input type="number" defaultValue="36" /></div>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><h2>Pièces justificatives</h2><p>Checklist de démonstration avant branchement du stockage documentaire.</p></div></div>
            <div className={styles.docList}>
              <div className={styles.doc}><div><strong>RCCM</strong><span>Document légal de l'entreprise</span></div><span className={`${styles.status} ${styles.statusOk}`}>Reçu</span></div>
              <div className={styles.doc}><div><strong>NIF</strong><span>Numéro d'identification fiscale</span></div><span className={`${styles.status} ${styles.statusOk}`}>Reçu</span></div>
              <div className={styles.doc}><div><strong>Business plan</strong><span>PDF, 10 Mo maximum</span></div><button className={styles.secondary} type="button">Ajouter</button></div>
              <div className={styles.doc}><div><strong>États financiers</strong><span>Dernier exercice disponible</span></div><button className={styles.secondary} type="button">Ajouter</button></div>
            </div>
          </section>

          <div className={styles.notice}>Les valeurs de cet écran sont fictives. La soumission réelle sera activée après connexion du backend, de l'authentification et du stockage documentaire.</div>
          <div className={styles.buttonRow}>
            <button className={styles.primary} type="button">Enregistrer le brouillon</button>
            <Link className={styles.secondary} href="/entrepreneur/suivi">Voir le suivi</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
