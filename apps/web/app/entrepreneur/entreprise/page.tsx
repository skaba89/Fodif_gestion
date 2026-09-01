import Link from "next/link";
import styles from "../portal.module.css";

export default function CompanyProfilePage() {
  return (
    <main className={styles.main}>
      <p className={styles.eyebrow}>Mon entreprise</p>
      <h1 className={styles.title}>Fiche entreprise</h1>
      <p className={styles.lead}>Les informations ci-dessous alimenteront automatiquement vos futures demandes de financement.</p>

      <section className={`${styles.card} ${styles.formCard} ${styles.section}`}>
        <div className={styles.formGrid}>
          <div className={styles.field}><label>Raison sociale</label><input defaultValue="Agro Kindia SARL" /></div>
          <div className={styles.field}><label>Nom commercial</label><input defaultValue="Agro Kindia" /></div>
          <div className={styles.field}><label>RCCM</label><input defaultValue="GN.KAL.2024.B.00123" /></div>
          <div className={styles.field}><label>NIF</label><input defaultValue="123456789" /></div>
          <div className={styles.field}><label>Forme juridique</label><select defaultValue="SARL"><option>SARL</option><option>SA</option><option>Entreprise individuelle</option><option>Coopérative</option></select></div>
          <div className={styles.field}><label>Date de création</label><input type="date" defaultValue="2024-02-12" /></div>
          <div className={styles.field}><label>Secteur</label><select defaultValue="Agro-industrie"><option>Agro-industrie</option><option>Industrie</option><option>Services</option><option>Technologie</option></select></div>
          <div className={styles.field}><label>Nombre d'employés</label><input type="number" defaultValue="18" /></div>
          <div className={styles.field}><label>Région</label><select defaultValue="Kindia"><option>Kindia</option><option>Conakry</option><option>Boké</option><option>Kankan</option><option>Labé</option><option>Mamou</option><option>Faranah</option><option>Nzérékoré</option></select></div>
          <div className={styles.field}><label>Préfecture</label><input defaultValue="Kindia" /></div>
          <div className={styles.field}><label>Téléphone</label><input defaultValue="+224 620 00 00 00" /></div>
          <div className={styles.field}><label>Email</label><input type="email" defaultValue="contact@example.gn" /></div>
          <div className={`${styles.field} ${styles.fieldFull}`}><label>Description de l'activité</label><textarea defaultValue="Transformation et conditionnement de produits agricoles locaux destinés au marché guinéen." /></div>
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.primary} type="button">Enregistrer les modifications</button>
          <Link className={styles.secondary} href="/entrepreneur">Retour au tableau de bord</Link>
        </div>
      </section>
    </main>
  );
}
