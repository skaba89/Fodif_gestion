'use client';

import { FormEvent, useEffect, useState } from 'react';
import { clientApi } from '../../../lib/client-api';
import Breadcrumbs from '../../_shared/Breadcrumbs';
import Button from '../../_shared/Button';
import { useToast } from '../../_shared/Toast';
import portal from '../../entrepreneur/portal.module.css';

type ProgramDocument = { code: string; libelle: string; typeDocument: string; obligatoire: boolean; validiteJours?: number | null; ordreAffichage?: number };
type ProgramVersion = {
  id: string; version: number; statut: 'BROUILLON' | 'ACTIVE' | 'ARCHIVEE';
  montantMin?: string | null; montantMax?: string | null; apportMinPct?: string | null; ancienneteMinMois?: number | null;
  rccmRequis: boolean; nifRequis: boolean; slaInstructionJours?: number | null; preparedByEmail?: string | null;
  submittedByEmail?: string | null; submittedAt?: string | null; approvedByEmail?: string | null; approvedAt?: string | null;
  nombreDossiers: number; documents: ProgramDocument[];
};
type ProgramSummary = {
  id: string; code: string; nom: string; description?: string | null; statut: string; enveloppeTotale?: string | null;
  dateDebut?: string | null; dateFin?: string | null; versionActive?: number | null; versionBrouillon?: number | null;
  nombreDossiers: number; nombreDossiersEngages: number;
};
type ProgramDetail = ProgramSummary & { versions: ProgramVersion[] };
type DocumentDraft = { code: string; libelle: string; typeDocument: string; obligatoire: boolean; validiteJours: string };

const DOC_TYPES = ['RCCM', 'NIF', 'BUSINESS_PLAN', 'ETATS_FINANCIERS', 'GARANTIE', 'AUTRE'] as const;
function numberOrNull(value: string) { return value.trim() === '' ? null : Number(value); }
function money(value?: string | number | null) { return value == null ? '—' : `${Number(value).toLocaleString('fr-FR')} GNF`; }
function date(value?: string | null) { return value ? new Date(value).toLocaleDateString('fr-FR') : '—'; }

export default function ProgramManagement() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [detail, setDetail] = useState<ProgramDetail | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { pushToast } = useToast();

  useEffect(() => {
    clientApi<ProgramSummary[]>('/api/direction/programmes')
      .then(setPrograms)
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Chargement impossible'));
  }, []);

  async function refresh(programId?: string) {
    const items = await clientApi<ProgramSummary[]>('/api/direction/programmes');
    setPrograms(items);
    const id = programId ?? detail?.id;
    if (id) setDetail(await clientApi<ProgramDetail>(`/api/direction/programmes/${id}`));
  }

  async function openProgram(id: string) {
    setMessage('');
    try { setDetail(await clientApi<ProgramDetail>(`/api/direction/programmes/${id}`)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Chargement impossible'); }
  }

  async function action(path: string, success: string, init: RequestInit = { method: 'POST' }) {
    setBusy(true); setMessage('');
    try {
      const updated = await clientApi<ProgramDetail>(path, init);
      setDetail(updated);
      await refresh(updated.id);
      pushToast({ tone: 'success', title: success, message: 'Le référentiel a été mis à jour et journalisé.' });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Opération impossible';
      setMessage(text); pushToast({ tone: 'error', title: 'Opération refusée', message: text });
    } finally { setBusy(false); }
  }

  const activeCount = programs.filter((program) => program.statut === 'ACTIVE').length;
  const draftCount = programs.filter((program) => program.versionBrouillon != null).length;
  const dossierCount = programs.reduce((sum, program) => sum + Number(program.nombreDossiers || 0), 0);

  return (
    <main className={portal.main}>
      <Breadcrumbs items={[{ label: 'Direction', href: '/direction/tableau-de-bord' }, { label: 'Programmes' }]} />
      <p className={portal.eyebrow}>Référentiel institutionnel</p>
      <h1 className={portal.title}>Programmes FODIP</h1>
      <p className={portal.lead}>Créez, versionnez, faites valider puis activez les programmes sans réécrire les règles des dossiers historiques.</p>

      <section className={`${portal.programs} ${portal.section}`} aria-label="Indicateurs programmes">
        <article className={`${portal.card} ${portal.program}`}><h3>{programs.length}</h3><p>Programmes référencés</p></article>
        <article className={`${portal.card} ${portal.program}`}><h3>{activeCount}</h3><p>Programmes ouverts</p></article>
        <article className={`${portal.card} ${portal.program}`}><h3>{draftCount}</h3><p>Versions en préparation</p></article>
        <article className={`${portal.card} ${portal.program}`}><h3>{dossierCount}</h3><p>Dossiers rattachés</p></article>
      </section>

      {message ? <div className={`${portal.notice} ${portal.section}`} role="alert">{message}</div> : null}
      <CreateProgramForm busy={busy} onCreated={async (program) => { setDetail(program); await refresh(program.id); }} onError={setMessage} />

      <section className={portal.section}>
        <div className={portal.sectionHeader}><div><h2>Référentiel</h2><p>Un brouillon reste invisible aux nouvelles demandes tant qu’il n’est pas activé.</p></div></div>
        <div className={portal.programs}>
          {programs.map((program) => (
            <article className={`${portal.card} ${portal.program}`} key={program.id}>
              <span className={portal.programTag}>{program.code}</span><h3>{program.nom}</h3>
              <p><strong>{program.statut}</strong> · V active {program.versionActive ?? '—'} · Brouillon {program.versionBrouillon ?? '—'}</p>
              <p>Enveloppe : {money(program.enveloppeTotale)} · {program.nombreDossiers} dossier(s)</p>
              <div className={portal.buttonRow}><Button variant="outline" onClick={() => void openProgram(program.id)}>Ouvrir le programme</Button></div>
            </article>
          ))}
        </div>
      </section>

      {detail ? <ProgramPanel key={detail.id} detail={detail} busy={busy} action={action} onUpdated={async (updated) => { setDetail(updated); await refresh(updated.id); }} onError={setMessage} /> : null}
    </main>
  );
}

function CreateProgramForm({ busy, onCreated, onError }: { busy: boolean; onCreated: (program: ProgramDetail) => Promise<void>; onError: (message: string) => void }) {
  const [code, setCode] = useState(''); const [nom, setNom] = useState(''); const [description, setDescription] = useState('');
  const [enveloppe, setEnveloppe] = useState(''); const [min, setMin] = useState(''); const [max, setMax] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); onError('');
    try {
      const created = await clientApi<ProgramDetail>('/api/direction/programmes', { method: 'POST', body: JSON.stringify({
        code: code.trim().toUpperCase(), nom, description: description || undefined, enveloppeTotale: numberOrNull(enveloppe),
        montantMin: numberOrNull(min), montantMax: numberOrNull(max), documents: [],
      }) });
      setCode(''); setNom(''); setDescription(''); setEnveloppe(''); setMin(''); setMax(''); await onCreated(created);
    } catch (error) { onError(error instanceof Error ? error.message : 'Création impossible'); }
  }

  return <section className={`${portal.card} ${portal.formCard} ${portal.section}`}>
    <div className={portal.sectionHeader}><div><h2>Créer un programme</h2><p>La création produit V1 en brouillon ; aucune publication automatique.</p></div></div>
    <form onSubmit={submit}><div className={portal.formGrid}>
      <div className={portal.field}><label htmlFor="program-code">Code</label><input id="program-code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></div>
      <div className={portal.field}><label htmlFor="program-name">Nom</label><input id="program-name" required value={nom} onChange={(e) => setNom(e.target.value)} /></div>
      <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor="program-description">Description</label><textarea id="program-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="program-envelope">Enveloppe (GNF)</label><input id="program-envelope" type="number" min="1" value={enveloppe} onChange={(e) => setEnveloppe(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="program-min">Montant minimum</label><input id="program-min" type="number" min="1" value={min} onChange={(e) => setMin(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="program-max">Montant maximum</label><input id="program-max" type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} /></div>
    </div><div className={portal.buttonRow}><Button type="submit" loading={busy}>Créer le brouillon V1</Button></div></form>
  </section>;
}

function ProgramPanel({ detail, busy, action, onUpdated, onError }: {
  detail: ProgramDetail; busy: boolean; action: (path: string, success: string, init?: RequestInit) => Promise<void>;
  onUpdated: (program: ProgramDetail) => Promise<void>; onError: (message: string) => void;
}) {
  const draft = detail.versions.find((version) => version.statut === 'BROUILLON') ?? null;
  const active = detail.versions.find((version) => version.statut === 'ACTIVE') ?? null;
  return <section className={portal.section} data-testid="program-management-detail">
    <div className={portal.sectionHeader}><div><span className={portal.programTag}>{detail.code}</span><h2>{detail.nom}</h2><p>{detail.description || 'Aucune description.'}</p></div></div>
    <div className={portal.programs}>
      <article className={`${portal.card} ${portal.program}`}><h3>{detail.statut}</h3><p>Statut · ouverture {date(detail.dateDebut)} → {date(detail.dateFin)}</p></article>
      <article className={`${portal.card} ${portal.program}`}><h3>{money(detail.enveloppeTotale)}</h3><p>Enveloppe · {detail.nombreDossiers} dossier(s)</p></article>
      <article className={`${portal.card} ${portal.program}`}><h3>{active ? `V${active.version}` : 'Aucune'}</h3><p>Version active</p></article>
    </div>
    <div className={portal.buttonRow}>
      {!draft ? <Button loading={busy} onClick={() => void action(`/api/direction/programmes/${detail.id}/versions`, 'Nouvelle version créée')}>Préparer une nouvelle version</Button> : null}
      {detail.statut === 'ACTIVE' ? <Button variant="outline" onClick={() => void action(`/api/direction/programmes/${detail.id}`, 'Programme clôturé', { method: 'PATCH', body: JSON.stringify({ statut: 'CLOTURE' }) })}>Clôturer</Button> : null}
      {detail.statut !== 'ARCHIVE' ? <Button variant="outline" onClick={() => void action(`/api/direction/programmes/${detail.id}`, 'Programme archivé', { method: 'PATCH', body: JSON.stringify({ statut: 'ARCHIVE' }) })}>Archiver</Button> : null}
    </div>
    {draft ? <DraftEditor key={draft.id} programId={detail.id} draft={draft} busy={busy} action={action} onUpdated={onUpdated} onError={onError} /> : null}
    <section className={`${portal.card} ${portal.formCard} ${portal.section}`}><h3>Historique des versions</h3>
      {detail.versions.map((version) => <div className={portal.notice} key={version.id}><strong>V{version.version} · {version.statut}</strong><p>{money(version.montantMin)} → {money(version.montantMax)} · {version.documents.length} pièce(s) · {version.nombreDossiers} dossier(s)</p><p>Soumise {date(version.submittedAt)} {version.submittedByEmail ? `par ${version.submittedByEmail}` : ''} · Validée {date(version.approvedAt)} {version.approvedByEmail ? `par ${version.approvedByEmail}` : ''}</p></div>)}
    </section>
  </section>;
}

function DraftEditor({ programId, draft, busy, action, onUpdated, onError }: {
  programId: string; draft: ProgramVersion; busy: boolean; action: (path: string, success: string, init?: RequestInit) => Promise<void>;
  onUpdated: (program: ProgramDetail) => Promise<void>; onError: (message: string) => void;
}) {
  const [min, setMin] = useState(String(draft.montantMin ?? '')); const [max, setMax] = useState(String(draft.montantMax ?? ''));
  const [apport, setApport] = useState(String(draft.apportMinPct ?? '')); const [age, setAge] = useState(String(draft.ancienneteMinMois ?? ''));
  const [sla, setSla] = useState(String(draft.slaInstructionJours ?? '')); const [rccm, setRccm] = useState(draft.rccmRequis); const [nif, setNif] = useState(draft.nifRequis);
  const [documents, setDocuments] = useState<DocumentDraft[]>(draft.documents.map((doc) => ({ code: doc.code, libelle: doc.libelle, typeDocument: doc.typeDocument, obligatoire: doc.obligatoire, validiteJours: String(doc.validiteJours ?? '') })));

  async function save(event: FormEvent) {
    event.preventDefault(); onError('');
    try {
      const updated = await clientApi<ProgramDetail>(`/api/direction/programmes/${programId}/versions/${draft.version}`, { method: 'PATCH', body: JSON.stringify({
        montantMin: numberOrNull(min), montantMax: numberOrNull(max), apportMinPct: numberOrNull(apport), ancienneteMinMois: numberOrNull(age),
        slaInstructionJours: numberOrNull(sla), rccmRequis: rccm, nifRequis: nif,
        documents: documents.filter((doc) => doc.code.trim() && doc.libelle.trim()).map((doc, index) => ({ ...doc, code: doc.code.trim().toUpperCase(), libelle: doc.libelle.trim(), validiteJours: numberOrNull(doc.validiteJours), ordreAffichage: (index + 1) * 10 })),
      }) }); await onUpdated(updated);
    } catch (error) { onError(error instanceof Error ? error.message : 'Enregistrement impossible'); }
  }

  function updateDoc(index: number, patch: Partial<DocumentDraft>) { setDocuments((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }
  return <section className={`${portal.card} ${portal.formCard} ${portal.section}`} data-testid="program-rule-draft">
    <h3>Règles V{draft.version} · Brouillon</h3><p>Toute modification après soumission impose une nouvelle revue.</p>
    <form onSubmit={save}><div className={portal.formGrid}>
      <div className={portal.field}><label htmlFor="rule-min">Montant minimum</label><input id="rule-min" type="number" min="1" value={min} onChange={(e) => setMin(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="rule-max">Montant maximum</label><input id="rule-max" type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="rule-apport">Apport minimum (%)</label><input id="rule-apport" type="number" min="0" max="100" step="0.01" value={apport} onChange={(e) => setApport(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="rule-age">Ancienneté minimum (mois)</label><input id="rule-age" type="number" min="0" value={age} onChange={(e) => setAge(e.target.value)} /></div>
      <div className={portal.field}><label htmlFor="rule-sla">SLA instruction (jours)</label><input id="rule-sla" type="number" min="1" value={sla} onChange={(e) => setSla(e.target.value)} /></div>
      <label><input type="checkbox" checked={rccm} onChange={(e) => setRccm(e.target.checked)} /> RCCM requis</label><label><input type="checkbox" checked={nif} onChange={(e) => setNif(e.target.checked)} /> NIF requis</label>
    </div>
    <div className={portal.sectionHeader}><div><h3>Checklist documentaire</h3><p>Chaque type documentaire est unique dans une version.</p></div><Button variant="outline" onClick={() => setDocuments((rows) => [...rows, { code: '', libelle: '', typeDocument: 'AUTRE', obligatoire: true, validiteJours: '' }])}>Ajouter une pièce</Button></div>
    {documents.map((doc, index) => <div className={portal.formGrid} key={index}>
      <div className={portal.field}><label htmlFor={`doc-type-${index}`}>Type</label><select id={`doc-type-${index}`} value={doc.typeDocument} onChange={(e) => updateDoc(index, { typeDocument: e.target.value, code: doc.code || e.target.value })}>{DOC_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}</select></div>
      <div className={portal.field}><label htmlFor={`doc-code-${index}`}>Code</label><input id={`doc-code-${index}`} value={doc.code} onChange={(e) => updateDoc(index, { code: e.target.value.toUpperCase() })} /></div>
      <div className={`${portal.field} ${portal.fieldFull}`}><label htmlFor={`doc-label-${index}`}>Libellé</label><input id={`doc-label-${index}`} value={doc.libelle} onChange={(e) => updateDoc(index, { libelle: e.target.value })} /></div>
      <div className={portal.field}><label htmlFor={`doc-valid-${index}`}>Validité (jours)</label><input id={`doc-valid-${index}`} type="number" min="1" value={doc.validiteJours} onChange={(e) => updateDoc(index, { validiteJours: e.target.value })} /></div>
      <label><input type="checkbox" checked={doc.obligatoire} onChange={(e) => updateDoc(index, { obligatoire: e.target.checked })} /> Obligatoire</label><Button variant="ghost" onClick={() => setDocuments((rows) => rows.filter((_, i) => i !== index))}>Retirer</Button>
    </div>)}
    <div className={portal.buttonRow}><Button type="submit" loading={busy}>Enregistrer le brouillon</Button></div></form>
    <div className={`${portal.notice} ${portal.section}`}><strong>Maker-checker</strong><p>Préparée par {draft.preparedByEmail ?? '—'} · Soumise {date(draft.submittedAt)} · Validée {date(draft.approvedAt)}.</p></div>
    <div className={portal.buttonRow}>
      <Button variant="outline" loading={busy} onClick={() => void action(`/api/direction/programmes/${programId}/versions/${draft.version}/submit`, `V${draft.version} soumise en revue`)}>Soumettre en revue</Button>
      {draft.submittedAt && !draft.approvedAt ? <Button loading={busy} onClick={() => void action(`/api/direction/programmes/${programId}/versions/${draft.version}/approve`, `V${draft.version} validée`)}>Valider comme second acteur</Button> : null}
      {draft.approvedAt ? <Button loading={busy} onClick={() => void action(`/api/direction/programmes/${programId}/versions/${draft.version}/activate`, `V${draft.version} activée`)}>Activer cette version</Button> : null}
    </div>
  </section>;
}
