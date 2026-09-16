export const LINKEDIN_AD_ACCOUNT_ID = '539500171';
export const LINKEDIN_SOURCE_TAG = 'linkedin';

export type NormalizedLead = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  funding_amount: string | null;
  job_title: string | null;
  message: string | null;
  external_id: string | null;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function firstString(record: JsonRecord, keys: string[]): string | null {
  const wanted = new Set(keys.map(compactKey));
  for (const [key, value] of Object.entries(record)) {
    if (!wanted.has(compactKey(key))) continue;
    const str = asString(value);
    if (str) return str;
  }
  return null;
}

function flattenColumnData(body: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...body };
  const columns = body.user_column_data;
  if (!Array.isArray(columns)) return out;
  for (const col of columns) {
    const row = asRecord(col);
    if (!row) continue;
    const name = asString(row.column_name) ?? asString(row.columnName);
    const value = row.string_value ?? row.stringValue ?? row.value;
    if (name && value != null) out[name] = value;
  }
  return out;
}

function joinName(first: string | null, last: string | null, full: string | null): string | null {
  if (full) return full;
  const parts = [first, last].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

function buildMessage(parts: Array<string | null>): string | null {
  const lines = parts.filter((p): p is string => Boolean(p));
  return lines.length ? lines.join('\n') : null;
}

export function extractUrnId(urn: unknown): string | null {
  const value = asString(urn);
  if (!value) return null;
  const match = value.match(/:([^:()]+)$/);
  return match?.[1] ?? value;
}

export function extractSponsoredAccountId(owner: unknown): string | null {
  const rec = asRecord(owner);
  if (!rec) return extractUrnId(owner);
  return extractUrnId(rec.sponsoredAccount) ?? extractUrnId(rec.organization);
}

export function extractLeadFormId(versionedFormUrn: unknown): string | null {
  const value = asString(versionedFormUrn);
  if (!value) return null;
  const match = value.match(/leadGenForm:(\d+)/);
  return match?.[1] ?? null;
}

export function isLeadActionNotification(body: unknown): body is JsonRecord {
  const rec = asRecord(body);
  return Boolean(rec && rec.type === 'LEAD_ACTION');
}

export function mapDirectPayload(body: unknown): NormalizedLead {
  const rec = flattenColumnData(asRecord(body) ?? {});
  const first = firstString(rec, ['first_name', 'firstName', 'FIRST_NAME']);
  const last = firstString(rec, ['last_name', 'lastName', 'LAST_NAME']);
  const full = firstString(rec, ['name', 'full_name', 'fullName', 'Full Name']);
  const company = firstString(rec, [
    'company',
    'company_name',
    'companyName',
    'COMPANY_NAME',
    'firm',
    'firm_name',
    'organization',
    'Work Email Domain',
  ]);
  const email = firstString(rec, ['email', 'email_address', 'emailAddress', 'EMAIL', 'work_email']);
  const phone = firstString(rec, [
    'phone',
    'phone_number',
    'phoneNumber',
    'PHONE_NUMBER',
    'mobile',
    'mobile_phone',
  ]);
  const city = firstString(rec, ['city', 'CITY']);
  const state = firstString(rec, ['state', 'STATE', 'province', 'region']);
  const funding = firstString(rec, [
    'funding_amount',
    'fundingAmount',
    'requested',
    'amount',
    'amount_requested',
  ]);
  const jobTitle = firstString(rec, ['job_title', 'jobTitle', 'JOB_TITLE', 'title']);
  const practice = firstString(rec, ['practice', 'practice_area', 'practiceArea']);
  const externalId =
    firstString(rec, ['lead_id', 'leadId', 'id', 'external_id', 'externalId']) ?? null;

  return {
    name: joinName(first, last, full),
    company,
    email: email ? email.toLowerCase() : null,
    phone,
    city,
    state,
    funding_amount: funding,
    job_title: jobTitle,
    message: buildMessage([
      jobTitle ? `Job title: ${jobTitle}` : null,
      practice ? `Practice area: ${practice}` : null,
    ]),
    external_id: externalId,
  };
}

type LinkedInQuestion = {
  questionId?: unknown;
  predefinedField?: unknown;
  name?: unknown;
  question?: { localized?: Record<string, string> };
  questionDetails?: JsonRecord;
};

type LinkedInAnswer = {
  questionId?: unknown;
  answerDetails?: JsonRecord;
};

function localizedText(value: unknown): string | null {
  const rec = asRecord(value);
  const localized = rec ? asRecord(rec.localized) : null;
  if (localized) {
    return asString(localized.en_US) ?? asString(Object.values(localized)[0]);
  }
  return asString(value);
}

function answerText(answer: LinkedInAnswer, question?: LinkedInQuestion): string | null {
  const details = asRecord(answer.answerDetails);
  if (!details) return null;
  const text = asRecord(details.textQuestionAnswer);
  if (text) return asString(text.answer);

  const choice = asRecord(details.multipleChoiceAnswer);
  if (choice && Array.isArray(choice.options) && question) {
    const options = asRecord(question.questionDetails)?.multipleChoiceQuestionDetails;
    const optionList = asRecord(options)?.options;
    if (Array.isArray(optionList)) {
      const labels = (choice.options as unknown[])
        .map((idx) => {
          if (typeof idx !== 'number') return null;
          const opt = asRecord(optionList[idx]);
          return localizedText(opt?.text);
        })
        .filter((v): v is string => Boolean(v));
      return labels.length ? labels.join(', ') : null;
    }
    return (choice.options as unknown[]).map(String).join(', ');
  }
  return null;
}

export function mapLinkedInFormResponse(response: unknown, form: unknown): NormalizedLead {
  const res = asRecord(response) ?? {};
  const formRec = asRecord(form) ?? {};
  const questions: LinkedInQuestion[] =
    (asRecord(formRec.content)?.questions as LinkedInQuestion[] | undefined) ?? [];
  const questionById = new Map<string, LinkedInQuestion>();
  for (const q of questions) {
    if (q.questionId != null) questionById.set(String(q.questionId), q);
  }

  const answers: LinkedInAnswer[] =
    (asRecord(res.formResponse)?.answers as LinkedInAnswer[] | undefined) ?? [];

  const fields: JsonRecord = {};
  const extras: string[] = [];

  for (const answer of answers) {
    const question = questionById.get(String(answer.questionId ?? ''));
    const value = answerText(answer, question);
    if (!value) continue;
    const predefined = asString(question?.predefinedField);
    const name = asString(question?.name);
    const label = localizedText(question?.question);
    const key = predefined ?? name ?? label;
    if (key) fields[key] = value;
    if (!predefined && label) extras.push(`${label}: ${value}`);
  }

  const mapped = mapDirectPayload(fields);
  const campaignName =
    asString(
      asRecord(asRecord(asRecord(res.leadMetadataInfo)?.sponsoredLeadMetadataInfo)?.campaign)?.name,
    ) ?? null;

  return {
    ...mapped,
    external_id: asString(res.id) ?? mapped.external_id,
    message: buildMessage([
      mapped.message,
      campaignName ? `Campaign: ${campaignName}` : null,
      ...extras,
    ]),
  };
}

export function mergeLead(base: NormalizedLead, overlay: Partial<NormalizedLead>): NormalizedLead {
  return {
    name: overlay.name ?? base.name,
    company: overlay.company ?? base.company,
    email: overlay.email ?? base.email,
    phone: overlay.phone ?? base.phone,
    city: overlay.city ?? base.city,
    state: overlay.state ?? base.state,
    funding_amount: overlay.funding_amount ?? base.funding_amount,
    job_title: overlay.job_title ?? base.job_title,
    message: overlay.message ?? base.message,
    external_id: overlay.external_id ?? base.external_id,
  };
}

export function hasContact(lead: NormalizedLead): boolean {
  return Boolean(lead.email || lead.phone || lead.name);
}

export async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
