-- FODIP Digital 2030
-- Initial PostgreSQL transactional schema
-- Draft v0.1 - to be converted into managed migrations when backend implementation starts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prefectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES regions(id),
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prefecture_id UUID NOT NULL REFERENCES prefectures(id),
    code VARCHAR(30) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS secteurs_activite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(200) NOT NULL,
    parent_id UUID REFERENCES secteurs_activite(id),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entreprises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_fodip VARCHAR(30) UNIQUE NOT NULL,
    raison_sociale VARCHAR(255) NOT NULL,
    nom_commercial VARCHAR(255),
    rccm VARCHAR(100),
    nif VARCHAR(100),
    forme_juridique VARCHAR(100),
    date_creation DATE,
    secteur_id UUID REFERENCES secteurs_activite(id),
    description_activite TEXT,
    nombre_employes INTEGER NOT NULL DEFAULT 0 CHECK (nombre_employes >= 0),
    chiffre_affaires_annuel NUMERIC(20,2) CHECK (chiffre_affaires_annuel IS NULL OR chiffre_affaires_annuel >= 0),
    telephone VARCHAR(50),
    email VARCHAR(255),
    site_web VARCHAR(255),
    region_id UUID REFERENCES regions(id),
    prefecture_id UUID REFERENCES prefectures(id),
    commune_id UUID REFERENCES communes(id),
    adresse TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    statut VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_entreprises_rccm UNIQUE (rccm),
    CONSTRAINT uq_entreprises_nif UNIQUE (nif)
);

CREATE TABLE IF NOT EXISTS entreprise_dirigeants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entreprise_id UUID NOT NULL REFERENCES entreprises(id),
    nom VARCHAR(150) NOT NULL,
    prenom VARCHAR(150),
    fonction VARCHAR(150),
    telephone VARCHAR(50),
    email VARCHAR(255),
    genre VARCHAR(30),
    date_naissance DATE,
    nationalite VARCHAR(100),
    dirigeant_principal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programmes_fodip (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    montant_min NUMERIC(20,2),
    montant_max NUMERIC(20,2),
    date_debut DATE,
    date_fin DATE,
    statut VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_programme_montants CHECK (
        montant_min IS NULL OR montant_max IS NULL OR montant_min <= montant_max
    )
);

CREATE TABLE IF NOT EXISTS utilisateurs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    prenom VARCHAR(150),
    telephone VARCHAR(50),
    password_hash TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_required BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS utilisateur_roles (
    utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (utilisateur_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS dossiers_financement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_dossier VARCHAR(50) UNIQUE NOT NULL,
    entreprise_id UUID NOT NULL REFERENCES entreprises(id),
    programme_id UUID REFERENCES programmes_fodip(id),
    montant_demande NUMERIC(20,2) NOT NULL CHECK (montant_demande > 0),
    apport_personnel NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (apport_personnel >= 0),
    objet_financement TEXT NOT NULL,
    description_projet TEXT,
    nombre_emplois_prevus INTEGER NOT NULL DEFAULT 0 CHECK (nombre_emplois_prevus >= 0),
    statut VARCHAR(50) NOT NULL DEFAULT 'BROUILLON',
    date_soumission TIMESTAMPTZ,
    agent_responsable_id UUID REFERENCES utilisateurs(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dossier_statuts_historique (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID NOT NULL REFERENCES dossiers_financement(id),
    ancien_statut VARCHAR(50),
    nouveau_statut VARCHAR(50) NOT NULL,
    commentaire TEXT,
    utilisateur_id UUID REFERENCES utilisateurs(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dossier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID NOT NULL REFERENCES dossiers_financement(id),
    type_document VARCHAR(100) NOT NULL,
    nom_fichier VARCHAR(500) NOT NULL,
    storage_key VARCHAR(1000) NOT NULL,
    mime_type VARCHAR(100),
    taille_octets BIGINT CHECK (taille_octets IS NULL OR taille_octets >= 0),
    checksum_sha256 VARCHAR(64),
    statut_verification VARCHAR(30) NOT NULL DEFAULT 'A_VERIFIER',
    verified_by UUID REFERENCES utilisateurs(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modeles_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    nom VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS criteres_scoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modele_id UUID NOT NULL REFERENCES modeles_scoring(id),
    code VARCHAR(100) NOT NULL,
    libelle VARCHAR(255) NOT NULL,
    categorie VARCHAR(100),
    poids NUMERIC(6,3) NOT NULL CHECK (poids >= 0),
    score_max NUMERIC(10,2) NOT NULL DEFAULT 100 CHECK (score_max > 0),
    ordre_affichage INTEGER,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (modele_id, code)
);

CREATE TABLE IF NOT EXISTS scores_dossier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID NOT NULL REFERENCES dossiers_financement(id),
    modele_id UUID NOT NULL REFERENCES modeles_scoring(id),
    score_total NUMERIC(6,2),
    niveau_risque VARCHAR(30),
    recommandation VARCHAR(50),
    calcule_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valide_par UUID REFERENCES utilisateurs(id),
    valide_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS decisions_comite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dossier_id UUID NOT NULL REFERENCES dossiers_financement(id),
    decision VARCHAR(50) NOT NULL,
    montant_approuve NUMERIC(20,2),
    taux_interet NUMERIC(8,4),
    duree_mois INTEGER,
    differe_mois INTEGER,
    garanties TEXT,
    conditions TEXT,
    commentaire TEXT,
    date_decision TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_financement VARCHAR(50) UNIQUE NOT NULL,
    dossier_id UUID NOT NULL REFERENCES dossiers_financement(id),
    entreprise_id UUID NOT NULL REFERENCES entreprises(id),
    montant_accorde NUMERIC(20,2) NOT NULL CHECK (montant_accorde > 0),
    taux_interet NUMERIC(8,4),
    duree_mois INTEGER,
    date_signature DATE,
    date_debut DATE,
    date_fin_prevue DATE,
    statut VARCHAR(50) NOT NULL DEFAULT 'ACTIF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decaissements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financement_id UUID NOT NULL REFERENCES financements(id),
    numero_decaissement INTEGER NOT NULL CHECK (numero_decaissement > 0),
    montant NUMERIC(20,2) NOT NULL CHECK (montant > 0),
    date_prevue DATE,
    date_effective DATE,
    reference_bancaire VARCHAR(255),
    statut VARCHAR(30) NOT NULL DEFAULT 'PREVU',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (financement_id, numero_decaissement)
);

CREATE TABLE IF NOT EXISTS echeances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financement_id UUID NOT NULL REFERENCES financements(id),
    numero_echeance INTEGER NOT NULL CHECK (numero_echeance > 0),
    date_echeance DATE NOT NULL,
    capital_du NUMERIC(20,2) NOT NULL DEFAULT 0,
    interet_du NUMERIC(20,2) NOT NULL DEFAULT 0,
    montant_total_du NUMERIC(20,2) NOT NULL DEFAULT 0,
    statut VARCHAR(30) NOT NULL DEFAULT 'A_VENIR',
    UNIQUE (financement_id, numero_echeance)
);

CREATE TABLE IF NOT EXISTS remboursements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financement_id UUID NOT NULL REFERENCES financements(id),
    echeance_id UUID REFERENCES echeances(id),
    montant_paye NUMERIC(20,2) NOT NULL CHECK (montant_paye > 0),
    date_paiement DATE NOT NULL,
    reference_paiement VARCHAR(255),
    moyen_paiement VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suivis_impact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entreprise_id UUID NOT NULL REFERENCES entreprises(id),
    financement_id UUID REFERENCES financements(id),
    periode DATE NOT NULL,
    chiffre_affaires NUMERIC(20,2),
    nombre_employes INTEGER,
    emplois_femmes INTEGER,
    emplois_hommes INTEGER,
    emplois_jeunes INTEGER,
    emplois_crees INTEGER,
    emplois_maintenus INTEGER,
    chiffre_export NUMERIC(20,2),
    production_locale NUMERIC(20,2),
    commentaire TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    utilisateur_id UUID REFERENCES utilisateurs(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dossiers_entreprise ON dossiers_financement(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_statut ON dossiers_financement(statut);
CREATE INDEX IF NOT EXISTS idx_documents_dossier ON dossier_documents(dossier_id);
CREATE INDEX IF NOT EXISTS idx_financements_entreprise ON financements(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_echeances_financement_date ON echeances(financement_id, date_echeance);
CREATE INDEX IF NOT EXISTS idx_impact_entreprise_periode ON suivis_impact(entreprise_id, periode);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id, created_at DESC);
