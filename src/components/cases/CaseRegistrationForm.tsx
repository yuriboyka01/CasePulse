'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Save } from 'lucide-react';
import { ApiClientError, apiClient, type NewCasePayload } from '@/lib/api-client';
import type { BureauCode, CaseComplaint, CaseSeverity, ComplaintCategory, ComplainantType, Institution } from '@/types';

const BUREAU_LABELS: Record<BureauCode, string> = {
  AICTE_APPROVAL: 'AICTE Approval Bureau',
  UGC_VIGILANCE: 'UGC Vigilance Directorate',
  STATE_DTE_MAHA: 'DTE Maharashtra',
  STATE_DTE_KAR: 'DTE Karnataka',
  NARC_ANTI_RAGGING: 'Anti-Ragging Monitoring Cell',
  CONSUMER_FORUM: 'Consumer Disputes Forum',
};

const CATEGORIES: { value: ComplaintCategory; label: string }[] = [
  { value: 'CAPITATION_FEE', label: 'Capitation fee' },
  { value: 'WITHHOLDING_DOCUMENTS', label: 'Withholding documents' },
  { value: 'GHOST_FACULTY', label: 'Ghost faculty' },
  { value: 'RAGGING_HARASSMENT', label: 'Ragging or harassment' },
  { value: 'INFRASTRUCTURE_DEFICIT', label: 'Infrastructure deficit' },
  { value: 'UNAPPROVED_COURSES', label: 'Unapproved courses' },
  { value: 'EXAM_MALPRACTICE', label: 'Examination malpractice' },
  { value: 'FALSE_ACCREDITATION', label: 'False accreditation' },
];

const COMPLAINANT_TYPES: { value: ComplainantType; label: string }[] = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'FACULTY', label: 'Faculty member' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'WHISTLEBLOWER', label: 'Whistleblower' },
  { value: 'ANONYMOUS', label: 'Anonymous' },
];

const SEVERITIES: { value: CaseSeverity; label: string }[] = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'ELEVATED', label: 'Elevated' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const INTAKE_SOURCES: { value: NewCasePayload['intakeSource']; label: string }[] = [
  { value: 'EXISTING_PORTAL', label: 'Existing complaint portal' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'LETTER', label: 'Letter' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'OTHER', label: 'Other channel' },
];

function localDate(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

const fieldClass = 'mt-1.5 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm text-ink outline-none transition focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20';
const labelClass = 'block text-xs font-semibold text-ink-soft';

export function CaseRegistrationForm() {
  const [bureauCodes, setBureauCodes] = useState<BureauCode[]>([]);
  const [bureauId, setBureauId] = useState<BureauCode | ''>('');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [loadedBureauId, setLoadedBureauId] = useState<BureauCode | ''>('');
  const isLoadingInstitutions = Boolean(bureauId) && loadedBureauId !== bureauId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdCase, setCreatedCase] = useState<CaseComplaint | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('CAPITATION_FEE');
  const [severity, setSeverity] = useState<CaseSeverity>('ELEVATED');
  const [complainantType, setComplainantType] = useState<ComplainantType>('STUDENT');
  const [filingDate, setFilingDate] = useState('');
  const [slaDueDate, setSlaDueDate] = useState('');
  const [intakeSource, setIntakeSource] = useState<NewCasePayload['intakeSource']>('EXISTING_PORTAL');
  const [sourceReference, setSourceReference] = useState('');

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFilingDate(localDate());
      setSlaDueDate(localDate(30));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    void apiClient.getCaseRegistrationOptions()
      .then((options) => {
        if (!active) return;
        setBureauCodes(options.bureauCodes);
        setBureauId(options.bureauCodes[0] ?? '');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setErrorMessage(error instanceof ApiClientError ? error.userFriendlyMessage : 'Unable to load registration permissions.');
      })
      .finally(() => { if (active) setIsLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!bureauId) return;
    let active = true;
    void apiClient.getInstitutions({ page: 1, pageSize: 100, bureau: bureauId })
      .then((result) => {
        if (!active) return;
        setInstitutions(result.data);
        setInstitutionId(result.data[0]?.id ?? '');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setInstitutions([]);
        setInstitutionId('');
        setErrorMessage(error instanceof ApiClientError ? error.userFriendlyMessage : 'Unable to load institutions for this bureau.');
      })
      .finally(() => { if (active) setLoadedBureauId(bureauId); });
    return () => { active = false; };
  }, [bureauId]);

  const canSubmit = useMemo(() => Boolean(
    bureauId && institutionId && title.trim() && description.trim() && filingDate && slaDueDate && !isSubmitting
  ), [bureauId, institutionId, title, description, filingDate, slaDueDate, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bureauId || !institutionId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setCreatedCase(null);
    try {
      const created = await apiClient.registerCase({
        institutionId,
        bureauId,
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        complainantType,
        filingDate,
        slaDueDate,
        intakeSource,
        ...(sourceReference.trim() ? { sourceReference: sourceReference.trim() } : {}),
      });
      setCreatedCase(created);
    } catch (error) {
      setErrorMessage(error instanceof ApiClientError ? error.userFriendlyMessage : 'The case could not be registered. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdCase) {
    return (
      <section className="rounded-2xl border border-success/30 bg-card p-6 shadow-xs sm:p-8" aria-live="polite">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-6 w-6" aria-hidden="true" /></span>
          <h2 className="mt-4 font-display text-2xl font-semibold text-ink">Case registered</h2>
          <p className="mt-2 text-sm text-ink-muted">The complaint record is now in the authorized case register. Its status starts at New.</p>
          <p className="mt-4 rounded-lg bg-background px-4 py-3 font-mono text-sm font-semibold text-ink">{createdCase.id}</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href={`/cases/${encodeURIComponent(createdCase.id)}`} className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">Open case record</Link>
            <Link href="/cases" className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:bg-raised">Return to case register</Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Register a complaint received elsewhere</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">Use this form to bring an existing complaint into CASEPULSE for tracking. It does not submit a complaint on behalf of a student or replace the original intake channel.</p>
        </div>
        <Link href="/cases" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-raised hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to register</Link>
      </div>

      {errorMessage && <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger-ink"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>{errorMessage} {errorMessage.includes('Authentication required') && <Link className="font-semibold underline" href="/login">Sign in</Link>}</p></div>}

      {!isLoadingOptions && bureauCodes.length === 0 && !errorMessage && (
        <div role="status" className="rounded-xl border border-line bg-card p-4 text-sm text-ink-muted">Your account has no assigned bureau for case registration. Ask an administrator to provision your officer access.</div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-card p-4 shadow-xs sm:p-6">
        <fieldset disabled={isLoadingOptions || bureauCodes.length === 0 || isSubmitting} className="space-y-6 disabled:opacity-70">
          <legend className="sr-only">New case details</legend>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Receiving bureau
              <select required value={bureauId} onChange={(event) => setBureauId(event.target.value as BureauCode)} className={fieldClass}>
                {bureauCodes.map((code) => <option key={code} value={code}>{BUREAU_LABELS[code]}</option>)}
              </select>
            </label>
            <label className={labelClass}>Institution
              <select required value={institutionId} onChange={(event) => setInstitutionId(event.target.value)} className={fieldClass} disabled={isLoadingInstitutions || institutions.length === 0}>
                <option value="">{isLoadingInstitutions ? 'Loading institutions…' : institutions.length ? 'Choose an institution' : 'No institutions available for this bureau'}</option>
                {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}{institution.aisheCode ? ` · ${institution.aisheCode}` : ''}</option>)}
              </select>
            </label>
            <label className={`${labelClass} md:col-span-2`}>Case title
              <input required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short description of the issue" className={fieldClass} />
            </label>
            <label className={`${labelClass} md:col-span-2`}>Case summary
              <textarea required maxLength={4000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Record the issue needed for case tracking. Avoid entering complainant contact details here." className={fieldClass} />
            </label>
            <label className={labelClass}>Complaint category
              <select value={category} onChange={(event) => setCategory(event.target.value as ComplaintCategory)} className={fieldClass}>{CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </label>
            <label className={labelClass}>Severity
              <select value={severity} onChange={(event) => setSeverity(event.target.value as CaseSeverity)} className={fieldClass}>{SEVERITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </label>
            <label className={labelClass}>Complainant type
              <select value={complainantType} onChange={(event) => setComplainantType(event.target.value as ComplainantType)} className={fieldClass}>{COMPLAINANT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </label>
            <label className={labelClass}>Original intake channel
              <select value={intakeSource} onChange={(event) => setIntakeSource(event.target.value as NewCasePayload['intakeSource'])} className={fieldClass}>{INTAKE_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </label>
            <label className={labelClass}>Date received
              <input required type="date" value={filingDate} onChange={(event) => setFilingDate(event.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>Expected disposal date
              <input required type="date" min={filingDate} value={slaDueDate} onChange={(event) => setSlaDueDate(event.target.value)} className={fieldClass} />
            </label>
            <label className={`${labelClass} md:col-span-2`}>Original reference number <span className="font-normal text-ink-muted">(optional)</span>
              <input maxLength={100} value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="Reference from the existing complaint channel" className={fieldClass} />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-ink-muted">CASEPULSE assigns the case ID and records the signed-in officer in the audit history. The case is created with status New.</p>
            <button type="submit" disabled={!canSubmit || isLoadingOptions || isLoadingInstitutions} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {isSubmitting ? 'Registering…' : 'Register case'}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
