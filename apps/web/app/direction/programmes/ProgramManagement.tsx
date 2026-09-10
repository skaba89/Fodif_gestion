'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { clientApi } from '../../../lib/client-api';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import { useToast } from '../../_shared/Toast';
import portal from '../../entrepreneur/portal.module.css';
import styles from '../../agent/agent.module.css';

type ProgramDocument = {
  code: string;
  libelle: string;
  typeDocument: string;
  obligatoire: boolean;
  validiteJours?: number | null;
  ordreAffichage?: number;
};

type ProgramVersion = {
  id: string;
  version: number;
  statut: 'BROUILLON' | 'ACTIVE' | 'ARCHIVEE';
  montantMin?: string | null;
  montantMax?: string | null;
  apportMinPct?: string | null;
  ancienneteMinMois?: number | null;
  rccmRequis: boolean;
  nifRequis: boolean;
  slaInstructionJours?: number | null;
  preparedByEmail?: string | null;
  submittedByEmail?: string | null;
  submittedAt?: string | null;
  approvedByEmail?: string | null;
  approvedAt?: string | null;
  nombreDossiers: number;
  documents: ProgramDocument[];
};

type ProgramSummary = {
  id: string;
  code: string;
  nom: string;
  statut: string;
  enveloppeTotale?: string | null;
  versionActive?: number | null;
  versionBrouillon?: number | null;
  brouillonSoumisAt?: string | null;
  brouillonApprouveAt?: string | null;
  nombreDossiers: number;
  nombreDossiersEngages: number;
};

type ProgramDetail = ProgramSummary & {
  description?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  versions: ProgramVersion[];
};

type DocumentDraft = {
  code: string;
  libelle: string;
  typeDocument: string;
  obligatoire: boolean;
  validiteJours: string;
};

const DOCUMENT_TYPES = [
  ['RCCM', 'Registre du Commerce et du Crédit Mobilier (RCCM)'],
  ['NIF', "Numéro d’Identification Fiscale (NIF)"],
  ['BUSINESS_PLAN', "Plan d’affaires / business plan"],
  ['ETATS_FINANCIERS', 'États financiers'],
  ['GARANTIE', 'Garantie'],
  ['AUTRE', 'Autre pièce'],
] as const;

function numberOrNull(value: string) { return value.trim() === '' ? null : Number(value); }
function money(value?: string | number | null) { return value == null ? '—' : `${Number(value).toLocaleString('fr-FR')} GNF`; }
function shortDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('fr-FR') : '—'; }
function blankDocument(): DocumentDraft { return { code: '', libelle: '', typeDocument: 'AUTRE', obligatoire: true, validiteJours: '' }; }

export default function ProgramManagementPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [detail, setDetail] = useState<ProgramDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { pushToast } = useToast();

  const load = useCallback(async () => {
    const items = await clientApi<ProgramSummary[]>('/api/direction/programmes');
    setPrograms(items);
    if (detail?.id) {
      const refreshed = await clientApi<ProgramDetail>(`/api/direction/programmes/${detail.id}`);
      setDetail(refreshed);
    }
  }, [detail?.id]);

  useEffect(() => { load().catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement impossible')); }, [load]);

  async function openProgram(id: string) {
    setMessage('');
    try { setDetail(await clientApi<ProgramDetail>(`/api/direction/programmes/${id}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Chargement du programme impossible'); }
  }

  async function runAction(path: string, success: string, init: RequestInit = { method: 'POST' }) {
    setBusy(true); setMessage('');
    try {
      const updated = await clientApi<ProgramDetail>(path, init);
      setDetail(updated);
      const items = await clientApi<ProgramSummary[]>('/api/direction/programmes');
      setPrograms(items);
      pushToast({ tone: 'success', title: success, message: 'Le référentiel programmes a été mis à jour et journalisé.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Opération impossible';
      setMessage(text);
      pushToast({ tone: 'error', title: 'Opération refusée', message: text });
    } finally { setBusy(false); }
  }

  const activeCount = programs.filter((program) => program.statut === 'ACTIVE').length;
  const drafts = programs.filter((program) => program.versionBrouillon != null).length;
  const totalDossiers = programs.reduce((sum, program) => sum + Number(program.nombreDossiers || 0), 0);

  return (
    <main className={portal.main}>
      <Breadcrumbs items={[{ label: 'Direction', href: '/direction/tableau-de-bord' }, { label: 'Programmes' }]} />
      <p className={portal.eyebrow}>Référentiel institutionnel</p>
      <h1 className={portal.title}>Programmes FODIP</h1>
      <p className={portal.lead}>
        Créez les programmes, préparez leurs règles et checklists, faites-les valider par un second acteur puis activez-les sans réécrire les dossiers historiques.
      </p>

      <section className={styles.metrics}>
        <article className={`${portal.card} ${styles.metric}`}><strong>{programs.length}</strong><span>Programmes</span></article>
        <article className={`${portal.card} ${styles.metric}`}><strong>{activeCount}</strong><span>Ouverts</span></article>
        <article className={`${portal.card} ${styles.metric}`}><strong>{drafts}</strong><span>Versions en préparation</span></article>
        <article className={`${portal.card} ${styles.metric}`}><strong>{totalDossiers}</strong><span>Dossiers rattachés</span></article>
      </section>

      {message ? <div className={`${portal.notice} ${portal.section}`} role="alert">{message}</div> : null}
      <CreateProgramForm busy={busy} onCreated={(created) => { setDetail(created); void load(); }} onError={setMessage} />

      <section className={portal.section}>
        <div className={portal.sectionHeader}><div><h2>Référentiel des programmes</h2><p>Les programmes non actifs restent invisibles aux nouvelles demandes PME.</p></div></div>
        {programs.length ? (
          <div className={portal.grid}>
            {programs.map((program) => (
              <article className={portal.card} key={program.id}>
                <p className={portal.eyebrow}>{program.code}</p>
                <h3>{program.nom}</h3>
                <p><strong>Statut :</strong> {program.statut} · <strong>V active :</strong> {program.versionActive ?? '—'} · <strong>Brouillon :</strong> {program.versionBrouillon ?? '—'}</p>
                <p><strong>Enveloppe :</strong> {money(program.enveloppeTotale)} · <strong>Dossiers :</strong> {program.nombreDossiers}</p>
                <div className={portal.buttonRow}><Button variant="outline" onClick={() => void openProgram(program.id)}>Ouvrir le programme</Button></div>
              </article>
            ))}
          </div>
        ) : <div className={portal.card}><h3>Aucun programme</h3><p>Créez le premier programme à partir du formulaire ci-dessus. Aucun programme officiel n’est ajouté automatiquement.</p></div>}
      </section>

      {detail ? (
        <ProgramDetailPanel
          detail={detail}
          busy={busy}
          runAction={runAction}
          onRefresh={(updated) => { setDetail(updated); void load(); }}
          onError={setMessage}
        />
      ) : null}
    </main>
  );
}

function CreateProgramForm({ busy, onCreated, onError }: { busy: boolean; onCreated: (program: ProgramDetail) => void; onError: (message: string) => void }) {
  const [code, setCode] = useState('');
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [enveloppe, setEnveloppe] = useState('');
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [apport, setApport] = useState('');
  const [anciennete, setAnciennete] = useState('');
  const [sla, setSla] = useState('');
  const [rccm, setRccm] = useState(false);
  const [nif, setNif] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); onError('');
    try {
      const created = await clientApi<ProgramDetail>('/api/direction/programmes', {
        method: 'POST',
        body: JSON.stringify({
          code: code.trim().toUpperCase(), nom, description: description || undefined,
          enveloppeTotale: numberOrNull(enveloppe), montantMin: numberOrNull(montantMin), montantMax: numberOrNull(montantMax),
          apportMinPct: numberOrNull(apport), ancienneteMinMois: numberOrNull(anciennete), slaInstructionJours: numberOrNull(sla),
          rccmRequis: rccm, nifRequis: nif, documents: [],
        }),
      });
      setCode(''); setNom(''); setDescription(''); setEnveloppe('');
      onCreated(created);
    } catch (error) { onError(error instanceof Error ? error.message : 'Création impossible'); }
  }

  return (
    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
      <div className={portal.sectionHeader}><div><h2>Créer un programme</h2><p>La création produit une version V1 en brouillon. Elle n’est jamais publiée automatiquement.</p></div></div>
      <form onSubmit={submit}>
        <div className={portal.formGrid}>
          <div className={portal.field}><label htmlFor="program-code">Code</label><input id="program-code" required maxLength={50} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="PROGRAMME-2026" /></div>
          <div className={portal.field}><label htmlFor="program-name">Nom</label><input id="program-name" required maxLength={255} value={nom} onChange={(event) => setNom(event.target.value)} /></div>
          <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="program-description">Description</label><textarea id="program-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="program-envelope">Enveloppe (GNF)</label><input id="program-envelope" type="number" min="1" value={enveloppe} onChange={(event) => setEnveloppe(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="program-min">Montant minimum</label><input id="program-min" type="number" min="1" value={montantMin} onChange={(event) => setMontantMin(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="program-max">Montant maximum</label><input id="program-max" type="number" min="1" value={montantMax} onChange={(event) => setMontantMax(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="program-apport">Apport minimum (%)</label><input id="program-apport" type="number" min="0" max="100" step="0.01" value={apport} onChange={(event) => setApport(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="program-age">Ancienneté minimum (mois)</label><input id="program-age" type="number" min="0" value={anciennete} onChange={(event) => setAnciennete(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="program-sla">SLA instruction (jours)</label><input id="program-sla" type="number" min="1" value={sla} onChange={(event) => setSla(event.target.value)} /></div>
          <label><input type="checkbox" checked={rccm} onChange={(event) => setRccm(event.target.checked)} /> RCCM requis</label>
          <label><input type="checkbox" checked={nif} onChange={(event) => setNif(event.target.checked)} /> NIF requis</label>
        </div>
        <div className={portal.buttonRow}><Button type="submit" loading={busy}>Créer le brouillon V1</Button></div>
      </form>
    </section>
  );
}

function ProgramDetailPanel({ detail, busy, runAction, onRefresh, onError }: {
  detail: ProgramDetail;
  busy: boolean;
  runAction: (path: string, success: string, init?: RequestInit) => Promise<void>;
  onRefresh: (program: ProgramDetail) => void;
  onError: (message: string) => void;
}) {
  const draft = useMemo(() => detail.versions.find((version) => version.statut === 'BROUILLON') ?? null, [detail.versions]);
  const active = detail.versions.find((version) => version.statut === 'ACTIVE') ?? null;

  return (
    <section className={portal.section} data-testid="program-management-detail">
      <div className={portal.sectionHeader}><div><p className={portal.eyebrow}>{detail.code}</p><h2>{detail.nom}</h2><p>{detail.description || 'Aucune description.'}</p></div></div>
      <div className={portal.grid}>
        <article className={portal.card}><strong>Statut programme</strong><p>{detail.statut}</p><p>Début : {shortDate(detail.dateDebut)} · Fin : {shortDate(detail.dateFin)}</p></article>
        <article className={portal.card}><strong>Enveloppe</strong><p>{money(detail.enveloppeTotale)}</p><p>{detail.nombreDossiers} dossiers dont {detail.nombreDossiersEngages} engagés</p></article>
        <article className={portal.card}><strong>Version active</strong><p>{active ? `V${active.version}` : 'Aucune'}</p><p>Les nouveaux dossiers utilisent uniquement cette version.</p></article>
      </div>

      <div className={portal.buttonRow}>
        {!draft ? <Button onClick={() => void runAction(`/api/direction/programmes/${detail.id}/versions`, 'Nouvelle version créée')} loading={busy}>Préparer une nouvelle version</Button> : null}
        {detail.statut === 'ACTIVE' ? <Button variant="outline" onClick={() => void runAction(`/api/direction/programmes/${detail.id}`, 'Programme clôturé', { method: 'PATCH', body: JSON.stringify({ statut: 'CLOTURE' }) })}>Clôturer</Button> : null}
        {detail.statut !== 'ARCHIVE' ? <Button variant="outline" onClick={() => void runAction(`/api/direction/programmes/${detail.id}`, 'Programme archivé', { method: 'PATCH', body: JSON.stringify({ statut: 'ARCHIVE' }) })}>Archiver</Button> : null}
      </div>

      {draft ? <DraftEditor programId={detail.id} draft={draft} busy={busy} runAction={runAction} onRefresh={onRefresh} onError={onError} /> : null}

      <section className={`${portal.card} ${portal.section}`}>
        <h3>Historique des versions</h3>
        {detail.versions.map((version) => (
          <div key={version.id} className={portal.notice}>
            <strong>V{version.version} · {version.statut}</strong>
            <p>{money(version.montantMin)} → {money(version.montantMax)} · apport {version.apportMinPct ?? '—'} % · {version.documents.length} pièce(s) configurée(s) · {version.nombreDossiers} dossier(s) verrouillé(s)</p>
            <p>Soumise : {shortDate(version.submittedAt)} {version.submittedByEmail ? `par ${version.submittedByEmail}` : ''} · Validée : {shortDate(version.approvedAt)} {version.approvedByEmail ? `par ${version.approvedByEmail}` : ''}</p>
          </div>
        ))}
      </section>
    </section>
  );
}

function DraftEditor({ programId, draft, busy, runAction, onRefresh, onError }: {
  programId: string;
  draft: ProgramVersion;
  busy: boolean;
  runAction: (path: string, success: string, init?: RequestInit) => Promise<void>;
  onRefresh: (program: ProgramDetail) => void;
  onError: (message: string) => void;
}) {
  const [montantMin, setMontantMin] = useState(String(draft.montantMin ?? ''));
  const [montantMax, setMontantMax] = useState(String(draft.montantMax ?? ''));
  const [apport, setApport] = useState(String(draft.apportMinPct ?? ''));
  const [anciennete, setAnciennete] = useState(String(draft.ancienneteMinMois ?? ''));
  const [sla, setSla] = useState(String(draft.slaInstructionJours ?? ''));
  const [rccm, setRccm] = useState(draft.rccmRequis);
  const [nif, setNif] = useState(draft.nifRequis);
  const [documents, setDocuments] = useState<DocumentDraft[]>(draft.documents.map((document) => ({
    code: document.code,
    libelle: document.libelle,
    typeDocument: document.typeDocument,
    obligatoire: document.obligatoire,
    validiteJours: String(document.validiteJours ?? ''),
  })));

  useEffect(() => {
    setMontantMin(String(draft.montantMin ?? '')); setMontantMax(String(draft.montantMax ?? ''));
    setApport(String(draft.apportMinPct ?? '')); setAnciennete(String(draft.ancienneteMinMois ?? ''));
    setSla(String(draft.slaInstructionJours ?? '')); setRccm(draft.rccmRequis); setNif(draft.nifRequis);
    setDocuments(draft.documents.map((document) => ({ code: document.code, libelle: document.libelle, typeDocument: document.typeDocument, obligatoire: document.obligatoire, validiteJours: String(document.validiteJours ?? '') })));
  }, [draft]);

  async function save(event: FormEvent) {
    event.preventDefault(); onError('');
    try {
      const updated = await clientApi<ProgramDetail>(`/api/direction/programmes/${programId}/versions/${draft.version}`, {
        method: 'PATCH',
        body: JSON.stringify({
          montantMin: numberOrNull(montantMin), montantMax: numberOrNull(montantMax), apportMinPct: numberOrNull(apport),
          ancienneteMinMois: numberOrNull(anciennete), slaInstructionJours: numberOrNull(sla), rccmRequis: rccm, nifRequis: nif,
          documents: documents.filter((document) => document.code.trim() && document.libelle.trim()).map((document, index) => ({
            code: document.code.trim().toUpperCase(), libelle: document.libelle.trim(), typeDocument: document.typeDocument,
            obligatoire: document.obligatoire, validiteJours: numberOrNull(document.validiteJours), ordreAffichage: (index + 1) * 10,
          })),
        }),
      });
      onRefresh(updated);
    } catch (error) { onError(error instanceof Error ? error.message : 'Enregistrement impossible'); }
  }

  function updateDocument(index: number, patch: Partial<DocumentDraft>) {
    setDocuments((current) => current.map((document, position) => position === index ? { ...document, ...patch } : document));
  }

  return (
    <section className={`${portal.card} ${portal.formCard} ${portal.section}`} data-testid="program-rule-draft">
      <div className={portal.sectionHeader}><div><h3>Règles V{draft.version} · Brouillon</h3><p>Toute modification après soumission annule automatiquement la validation précédente.</p></div></div>
      <form onSubmit={save}>
        <div className={portal.formGrid}>
          <div className={portal.field}><label htmlFor="rule-min">Montant minimum</label><input id="rule-min" type="number" min="1" value={montantMin} onChange={(event) => setMontantMin(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="rule-max">Montant maximum</label><input id="rule-max" type="number" min="1" value={montantMax} onChange={(event) => setMontantMax(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="rule-apport">Apport minimum (%)</label><input id="rule-apport" type="number" min="0" max="100" step="0.01" value={apport} onChange={(event) => setApport(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="rule-age">Ancienneté minimum (mois)</label><input id="rule-age" type="number" min="0" value={anciennete} onChange={(event) => setAnciennete(event.target.value)} /></div>
          <div className={portal.field}><label htmlFor="rule-sla">SLA instruction (jours)</label><input id="rule-sla" type="number" min="1" value={sla} onChange={(event) => setSla(event.target.value)} /></div>
          <label><input type="checkbox" checked={rccm} onChange={(event) => setRccm(event.target.checked)} /> RCCM requis</label>
          <label><input type="checkbox" checked={nif} onChange={(event) => setNif(event.target.checked)} /> NIF requis</label>
        </div>

        <div className={portal.sectionHeader}><div><h4>Checklist documentaire</h4><p>Un type documentaire ne peut apparaître qu’une fois dans une version.</p></div><Button variant="outline" onClick={() => setDocuments((current) => [...current, blankDocument()])}>Ajouter une pièce</Button></div>
        {documents.map((document, index) => (
          <div className={portal.formGrid} key={`${index}-${document.typeDocument}`}>
            <div className={portal.field}><label htmlFor={`doc-type-${index}`}>Type</label><select id={`doc-type-${index}`} value={document.typeDocument} onChange={(event) => {
              const type = event.target.value;
              const standard = DOCUMENT_TYPES.find(([value]) => value === type);
              updateDocument(index, { typeDocument: type, code: document.code || type, libelle: document.libelle || standard?.[1] || '' });
            }}>{DOCUMENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
            <div className={portal.field}><label htmlFor={`doc-code-${index}`}>Code</label><input id={`doc-code-${index}`} value={document.code} onChange={(event) => updateDocument(index, { code: event.target.value.toUpperCase() })} /></div>
            <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor={`doc-label-${index}`}>Libellé</label><input id={`doc-label-${index}`} value={document.libelle} onChange={(event) => updateDocument(index, { libelle: event.target.value })} /></div>
            <div className={portal.field}><label htmlFor={`doc-validity-${index}`}>Validité maximale (jours)</label><input id={`doc-validity-${index}`} type="number" min="1" value={document.validiteJours} onChange={(event) => updateDocument(index, { validiteJours: event.target.value })} /></div>
            <label><input type="checkbox" checked={document.obligatoire} onChange={(event) => updateDocument(index, { obligatoire: event.target.checked })} /> Obligatoire</label>
            <Button variant="ghost" onClick={() => setDocuments((current) => current.filter((_, position) => position !== index))}>Retirer</Button>
          </div>
        ))}

        <div className={portal.buttonRow}><Button type="submit" loading={busy}>Enregistrer le brouillon</Button></div>
      </form>

      <div className={portal.notice}>
        <strong>Maker-checker</strong>
        <p>Préparée par : {draft.preparedByEmail ?? 'non identifié'} · Soumise : {draft.submittedAt ? `${shortDate(draft.submittedAt)} par ${draft.submittedByEmail ?? '—'}` : 'non'} · Validée : {draft.approvedAt ? `${shortDate(draft.approvedAt)} par ${draft.approvedByEmail ?? '—'}` : 'non'}.</p>
      </div>
      <div className={portal.buttonRow}>
        <Button variant="outline" onClick={() => void runAction(`/api/direction/programmes/${programId}/versions/${draft.version}/submit`, `V${draft.version} soumise en revue`)} loading={busy}>Soumettre en revue</Button>
        {draft.submittedAt && !draft.approvedAt ? <Button onClick={() => void runAction(`/api/direction/programmes/${programId}/versions/${draft.version}/approve`, `V${draft.version} validée`)} loading={busy}>Valider comme second acteur</Button> : null}
        {draft.approvedAt ? <Button onClick={() => void runAction(`/api/direction/programmes/${programId}/versions/${draft.version}/activate`, `V${draft.version} activée`)} loading={busy}>Activer cette version</Button> : null}
      </div>
    </section>
  );
}
