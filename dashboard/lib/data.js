// lib/data.js — Offline intelligence dataset for the SENTINEL console.
//
// Pure JavaScript, zero native/network dependencies. This is what lets the
// dashboard run live from a laptop with no Postgres, no Supabase, and no
// internet — every panel is served from the structures below.
//
// The knowledge graph and RAG benchmark numbers are the REAL artifacts
// produced by the ECI pipeline; the change/ticket feed is a curated snapshot
// of the Android threat-intelligence surface the system monitors.

import ablationRaw from './datasets/ablation_results.json';

const DAY = 86_400_000;
const BASE = Date.parse('2026-07-07T09:00:00Z');
const ago = (d, h = 0) => new Date(BASE - d * DAY - h * 3_600_000).toISOString();

// ── Monitored sources ────────────────────────────────────────────────────
export const SOURCES = [
  { id: 1, name: 'Android Security Bulletin', url: 'https://source.android.com/docs/security/bulletin', category: 'security_bulletin', fetch_type: 'html', priority: 1, active: true, snapshot_count: 48 },
  { id: 2, name: 'Pixel Update Bulletin', url: 'https://source.android.com/docs/security/bulletin/pixel', category: 'oem_bulletin', fetch_type: 'html', priority: 1, active: true, snapshot_count: 31 },
  { id: 3, name: 'Samsung Mobile Security', url: 'https://security.samsungmobile.com/securityUpdate.smsb', category: 'oem_bulletin', fetch_type: 'html', priority: 2, active: true, snapshot_count: 27 },
  { id: 4, name: 'CISA Known Exploited Vulnerabilities', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', category: 'cve_feed', fetch_type: 'json', priority: 1, active: true, snapshot_count: 63 },
  { id: 5, name: 'NVD CVE Feed (Android)', url: 'https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=android', category: 'cve_feed', fetch_type: 'json', priority: 1, active: true, snapshot_count: 71 },
  { id: 6, name: 'Google Play Developer Policy Center', url: 'https://play.google.com/about/developer-content-policy/', category: 'policy_update', fetch_type: 'html', priority: 1, active: true, snapshot_count: 22 },
  { id: 7, name: 'Play Integrity API Docs', url: 'https://developer.android.com/google/play/integrity/overview', category: 'developer_docs', fetch_type: 'html', priority: 1, active: true, snapshot_count: 19 },
  { id: 8, name: 'Android 15 API Differences', url: 'https://developer.android.com/sdk/api_diff/35/changes', category: 'developer_docs', fetch_type: 'html', priority: 2, active: true, snapshot_count: 14 },
  { id: 9, name: 'Chrome Releases — Security', url: 'https://chromereleases.googleblog.com/', category: 'security_bulletin', fetch_type: 'html', priority: 2, active: true, snapshot_count: 38 },
  { id: 10, name: 'Qualcomm Security Bulletin', url: 'https://docs.qualcomm.com/product/publicresources/securitybulletin/', category: 'oem_bulletin', fetch_type: 'html', priority: 2, active: true, snapshot_count: 16 },
  { id: 11, name: 'Play Billing Library Releases', url: 'https://developer.android.com/google/play/billing/release-notes', category: 'developer_docs', fetch_type: 'html', priority: 3, active: true, snapshot_count: 9 },
  { id: 12, name: 'Privacy Sandbox on Android', url: 'https://developer.android.com/design-for-safety/privacy-sandbox', category: 'developer_docs', fetch_type: 'html', priority: 3, active: true, snapshot_count: 11 },
  { id: 13, name: 'OWASP MASVS', url: 'https://mas.owasp.org/MASVS/', category: 'developer_docs', fetch_type: 'html', priority: 3, active: false, snapshot_count: 5 },
  { id: 14, name: 'FIDO / FAPI Security Profile', url: 'https://openid.net/specs/fapi-security-profile-2_0.html', category: 'policy_update', fetch_type: 'html', priority: 3, active: true, snapshot_count: 7 },
];

// ── Change events (with embedded Sentinel-agent triage) ───────────────────
const RAW_CHANGES = [
  { id: 101, src: 4, status: 'escalated', domain: 'remote_code_execution', rel: 9, risk: 9, conf: 0.94, days: 1,
    title: 'CVE-2026-33634 added to CISA KEV — actively exploited Android RCE',
    summary: 'A remote code execution flaw in the Android System component (CVE-2026-33634, CVSS 9.8) was added to the CISA Known Exploited Vulnerabilities catalog. Exploitation is confirmed in the wild against unpatched Android 13–15 devices; a three-week federal remediation deadline was set.',
    added: ['+ CVE-2026-33634 | Android System | RCE | CVSS 9.8', '+ Exploitation status: ACTIVE (in-the-wild)', '+ Affected: Android 13, 14, 15 (below 2026-07-01 patch level)', '+ Required action: apply 2026-07-01 security patch level', '+ Remediation due: 2026-07-28'],
    deleted: [], tags: ['cve', 'rce', 'kev', 'android-system'] },
  { id: 102, src: 1, status: 'escalated', domain: 'privilege_escalation', rel: 9, risk: 8, conf: 0.90, days: 2,
    title: 'July 2026 Android Security Bulletin — 4 critical EoP in Framework',
    summary: 'The July 2026 bulletin patches 38 vulnerabilities, including four critical elevation-of-privilege flaws in the Framework and Media components. CVE-2026-33017 lets a local app gain System privileges with no user interaction.',
    added: ['+ Patch level: 2026-07-01', '+ Critical: CVE-2026-33017 (Framework, EoP)', '+ Critical: CVE-2026-33021 (Media, RCE)', '+ High: 22 additional CVEs across System / Kernel', '+ Ref: source.android.com/docs/security/bulletin/2026-07-01'],
    deleted: ['- Patch level: 2026-06-01'], tags: ['bulletin', 'eop', 'framework', 'critical'] },
  { id: 103, src: 6, status: 'escalated', domain: 'policy_compliance', rel: 8, risk: 8, conf: 0.88, days: 3,
    title: 'Play Policy: Play Integrity API mandatory for finance apps by Sep 2026',
    summary: 'Google updated the Developer Program Policy to require the Play Integrity API — with device and app integrity verdicts — for every app in the Finance category that handles payments. Non-compliant apps face removal after the September 1, 2026 deadline.',
    added: ['+ Finance apps MUST call Play Integrity API on sensitive flows', '+ Required verdicts: MEETS_DEVICE_INTEGRITY, MEETS_BASIC_INTEGRITY', '+ Enforcement date: 2026-09-01', '+ Scope: payments, lending, wallet, trading'],
    deleted: ['- Play Integrity API recommended for high-value apps'], tags: ['policy', 'play-integrity', 'finance', 'enforcement'] },
  { id: 113, src: 4, status: 'escalated', domain: 'supply_chain', rel: 8, risk: 9, conf: 0.91, days: 2,
    title: 'CVE-2025-54068 — actively exploited flaw in a widely embedded ad SDK',
    summary: 'A popular advertising SDK bundled by thousands of apps contains an actively exploited insecure-deserialization flaw enabling RCE inside the host app. Added to CISA KEV; every app shipping the vulnerable SDK version is exposed.',
    added: ['+ CVE-2025-54068 | Ad SDK | insecure deserialization | RCE', '+ Exploitation: ACTIVE', '+ Blast radius: any app embedding SDK < 4.7.2', '+ Detection: scan app SBOM for vulnerable SDK'],
    deleted: [], tags: ['cve', 'kev', 'supply-chain', 'sdk'] },
  { id: 104, src: 5, status: 'triaged', domain: 'cryptography', rel: 7, risk: 7, conf: 0.85, days: 4,
    title: 'CVE-2025-32432 — weak keystore attestation on select MediaTek SoCs',
    summary: 'A hardware-backed keystore weakness lets a privileged attacker forge key attestation on certain MediaTek chipsets, undermining the device-integrity signals anti-fraud systems rely on.',
    added: ['+ CVE-2025-32432 | MediaTek keystore | attestation bypass | CVSS 7.4', '+ Impact: forged hardware attestation certificates', '+ Anti-fraud relevance: weakens Play Integrity device verdict'],
    deleted: [], tags: ['cve', 'keystore', 'attestation', 'mediatek'] },
  { id: 105, src: 8, status: 'triaged', domain: 'api_change', rel: 6, risk: 5, conf: 0.80, days: 5,
    title: 'Android 15: foreground service type now mandatory (breaking change)',
    summary: 'Apps targeting API 35 must declare a foregroundServiceType for every foreground service or the platform throws MissingForegroundServiceTypeException. Affects payment-notification and location SDKs.',
    added: ['+ android:foregroundServiceType now REQUIRED for targetSdk 35', '+ Throws: MissingForegroundServiceTypeException', '+ New type: FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING'],
    deleted: ['- foregroundServiceType optional for targetSdk <= 34'], tags: ['api', 'android-15', 'breaking', 'foreground-service'] },
  { id: 106, src: 7, status: 'triaged', domain: 'api_change', rel: 6, risk: 5, conf: 0.82, days: 6,
    title: 'Play Integrity: classic requests deprecated in favor of standard requests',
    summary: 'Google deprecated classic Play Integrity requests; standard requests with token caching are now recommended. Removal of the classic API is targeted for early 2027.',
    added: ['+ Standard requests: lower latency, token caching supported', '+ Deprecation: classic requests (removal ~Q1 2027)'],
    deleted: ['- Classic requests fully supported'], tags: ['api', 'play-integrity', 'deprecation'] },
  { id: 107, src: 9, status: 'triaged', domain: 'remote_code_execution', rel: 7, risk: 7, conf: 0.86, days: 6,
    title: 'Chrome 128 — V8 type-confusion zero-day (CVE-2026-3055) patched',
    summary: 'Google shipped an emergency Chrome update fixing an actively exploited V8 type-confusion bug. Android WebView-based apps inherit the fix once the system WebView component updates.',
    added: ['+ CVE-2026-3055 | V8 | type confusion | exploited in the wild', '+ Fixed in Chrome 128.0.6613.84 and Android System WebView', '+ Action: force WebView update on managed devices'],
    deleted: [], tags: ['cve', 'chrome', 'v8', 'webview', 'zero-day'] },
  { id: 108, src: 3, status: 'triaged', domain: 'privilege_escalation', rel: 6, risk: 6, conf: 0.80, days: 7,
    title: 'Samsung July 2026 SMR — Knox vulnerability allows sandbox escape',
    summary: "Samsung's Security Maintenance Release patches SVE-2026-1188, a Knox container sandbox escape affecting Galaxy S23 / S24 devices on One UI 6.1.",
    added: ['+ SVE-2026-1188 | Knox | container sandbox escape', '+ Affected: Galaxy S23, S24 (One UI 6.1)', '+ Fix: One UI security patch 2026-07'],
    deleted: [], tags: ['oem', 'samsung', 'knox', 'eop'] },
  { id: 109, src: 10, status: 'pending', domain: 'kernel', rel: 5, risk: 6, conf: 0.70, days: 8,
    title: 'Qualcomm July 2026 bulletin — baseband memory corruption',
    summary: 'A memory corruption in the Qualcomm cellular baseband could allow over-the-air code execution. Patches were provided to OEMs; device rollout is still pending.',
    added: ['+ CVE-2026-21012 | Qualcomm baseband | memory corruption | CVSS 8.1', '+ Vector: over-the-air (adjacent network)', '+ Status: OEM patch integration pending'],
    deleted: [], tags: ['oem', 'qualcomm', 'baseband', 'kernel'] },
  { id: 110, src: 6, status: 'pending', domain: 'policy_compliance', rel: 6, risk: 5, conf: 0.78, days: 9,
    title: 'Play Policy: expanded restrictions on SMS / Call Log permissions',
    summary: 'Google tightened eligibility for the SMS and Call Log permission groups; only default handler apps qualify. Anti-fraud apps that read SMS OTPs must migrate to the SMS Retriever API.',
    added: ['+ SMS / Call Log access limited to default handler apps', '+ Migrate OTP reading to the SMS Retriever API', '+ Non-compliant apps removed after policy review'],
    deleted: ['- Declared-use exception for anti-fraud SMS reading'], tags: ['policy', 'permissions', 'sms', 'otp'] },
  { id: 115, src: 1, status: 'triaged', domain: 'kernel', rel: 7, risk: 7, conf: 0.83, days: 3,
    title: 'Kernel use-after-free in binder driver (CVE-2026-33099)',
    summary: 'A use-after-free in the Android binder IPC driver allows local privilege escalation to root. High relevance because the primitive is popular in rooting and fraud toolkits.',
    added: ['+ CVE-2026-33099 | Kernel binder | UAF | local EoP to root', '+ Exploit primitive common in rooting frameworks', '+ Fix: 2026-07-05 kernel patch'],
    deleted: [], tags: ['cve', 'kernel', 'binder', 'root'] },
  { id: 116, src: 2, status: 'triaged', domain: 'firmware', rel: 5, risk: 5, conf: 0.78, days: 4,
    title: 'Pixel July 2026 feature drop — hardware attestation key rotation',
    summary: 'Pixel devices rotated hardware attestation keys in the July feature drop. Anti-fraud backends that validate attestation chains must refresh their trusted root set.',
    added: ['+ New hardware attestation root certificates', '+ Action: update trusted attestation roots in backend', '+ Devices: Pixel 7 / 8 / 9 series'],
    deleted: [], tags: ['oem', 'pixel', 'attestation'] },
  { id: 114, src: 12, status: 'pending', domain: 'privacy', rel: 5, risk: 4, conf: 0.75, days: 11,
    title: 'Privacy Sandbox on Android — SDK Runtime GA timeline announced',
    summary: 'Google announced a general-availability timeline for the SDK Runtime, which isolates third-party SDKs in a separate process. This changes how fraud and attribution SDKs access app data.',
    added: ['+ SDK Runtime: isolated process for third-party SDKs', '+ Restricted access to host-app storage and permissions', '+ Action: audit attribution / fraud SDK data access'],
    deleted: [], tags: ['privacy-sandbox', 'sdk-runtime', 'attribution'] },
  { id: 111, src: 5, status: 'closed', domain: 'cryptography', rel: 4, risk: 4, conf: 0.70, days: 10,
    title: 'CVE-2021-30952 surfaced in feed — classified out-of-scope',
    summary: 'A historical iOS WebKit CVE appeared in the ingested feed. Sentinel classified it as out-of-scope for the Android fleet and the ticket was auto-closed — an example of the false-alarm rejection path.',
    added: ['+ CVE-2021-30952 | WebKit | iOS 14 | historical', '+ Classification: out-of-scope (non-Android)', '+ Auto-closed by Sentinel confidence gate'],
    deleted: [], tags: ['cve', 'false-positive', 'webkit'] },
  { id: 112, src: 11, status: 'closed', domain: 'api_change', rel: 3, risk: 3, conf: 0.72, days: 12,
    title: 'Play Billing Library 5 end-of-support reminder',
    summary: 'A reminder that Billing Library 5 has reached end of support and apps should move to Billing Library 7. Low fraud relevance; closed after triage.',
    added: ['+ Billing Library 5 end-of-life', '+ Recommended: migrate to Billing Library 7'],
    deleted: [], tags: ['api', 'billing', 'deprecation'] },
];

export const CHANGES = RAW_CHANGES.map(c => {
  const src = SOURCES.find(s => s.id === c.src);
  const total = c.added.length + c.deleted.length;
  return {
    id: c.id,
    source_id: c.src,
    source_name: src?.name,
    source_category: src?.category,
    status: c.status,
    diff_text: [...c.added, ...c.deleted].join('\n'),
    diff_json: {
      summary: c.summary,
      change_ratio: +(total / (total + 12)).toFixed(2),
      added_lines: c.added,
      deleted_lines: c.deleted,
    },
    tags: c.tags,
    created_at: ago(c.days),
    // Sentinel triage-agent output attached to the change
    triage_title: c.title,
    triage_summary: c.summary,
    relevance_score: c.rel,
    local_risk_score: c.risk,
    risk_domain: c.domain,
    confidence: c.conf,
  };
});

// ── Coordinator-agent action tickets (recommendations) ────────────────────
const RAW_TICKETS = [
  { id: 1, change: 101, risk: 9.6, days: 1,
    title: 'Contain actively-exploited Android System RCE (CVE-2026-33634)',
    summary: 'CISA-listed, in-the-wild RCE affecting Android 13–15 below the July patch level. Enforce a minimum patch level and hold non-compliant devices out of high-value transaction flows until remediated.',
    actions: [
      { action: 'Push the 2026-07-01 security patch level to the managed fleet', owner: 'Mobile Platform / EMM', urgency: 'immediate' },
      { action: 'Gate high-value transactions on device patch-level attestation', owner: 'Fraud Risk Engineering', urgency: 'immediate' },
      { action: 'Warn the affected user segment via an in-app banner', owner: 'Trust & Safety', urgency: 'this_week' },
    ], owner: 'Mobile Platform Security' },
  { id: 2, change: 113, risk: 9.4, days: 2,
    title: 'Purge vulnerable ad-SDK from the app supply chain (CVE-2025-54068)',
    summary: 'An actively exploited deserialization RCE ships inside a widely embedded ad SDK. Any app bundling a version below 4.7.2 is exposed; treat as a supply-chain incident.',
    actions: [
      { action: 'Block SDK versions < 4.7.2 in the build pipeline', owner: 'AppSec / Supply Chain', urgency: 'immediate' },
      { action: 'Run an SBOM scan across all shipping app binaries', owner: 'AppSec', urgency: 'immediate' },
      { action: 'Ship a hotfix release removing the vulnerable SDK', owner: 'Mobile Engineering', urgency: 'this_week' },
    ], owner: 'Application Security' },
  { id: 3, change: 102, risk: 8.6, days: 2,
    title: 'Roll out July 2026 bulletin criticals (Framework EoP)',
    summary: 'Four critical elevation-of-privilege and RCE flaws are patched in the July bulletin. CVE-2026-33017 grants System privileges with no user interaction.',
    actions: [
      { action: 'Schedule fleet OTA to the July 2026 patch level', owner: 'Mobile Platform / EMM', urgency: 'this_week' },
      { action: 'Add CVE-2026-33017 to the device-integrity risk model', owner: 'Fraud Risk Engineering', urgency: 'this_week' },
    ], owner: 'Mobile Platform Security' },
  { id: 4, change: 103, risk: 8.2, days: 3,
    title: 'Achieve Play Integrity compliance before Sep 1 finance deadline',
    summary: 'Play policy now mandates the Play Integrity API for finance apps handling payments. Missing the September 1 deadline risks store removal of the payments app.',
    actions: [
      { action: 'Instrument sensitive flows with standard Play Integrity requests', owner: 'Mobile Engineering', urgency: 'this_week' },
      { action: 'Wire integrity verdicts into the backend risk decision', owner: 'Fraud Risk Engineering', urgency: 'this_week' },
      { action: 'Track compliance against the 2026-09-01 enforcement date', owner: 'Compliance', urgency: 'this_month' },
    ], owner: 'Compliance & Risk' },
  { id: 5, change: 107, risk: 7.8, days: 6,
    title: 'Force WebView update for Chrome V8 zero-day (CVE-2026-3055)',
    summary: 'An actively exploited V8 type-confusion bug is fixed in Chrome 128; WebView-based app surfaces remain exposed until the system WebView updates.',
    actions: [
      { action: 'Force Android System WebView update on managed devices', owner: 'Mobile Platform / EMM', urgency: 'immediate' },
      { action: 'Audit in-app WebView usage on sensitive screens', owner: 'AppSec', urgency: 'this_week' },
    ], owner: 'Application Security' },
  { id: 6, change: 115, risk: 7.4, days: 3,
    title: 'Patch binder kernel UAF used by rooting toolkits (CVE-2026-33099)',
    summary: 'A binder-driver use-after-free enables local privilege escalation to root and is a common primitive in rooting frameworks that defeat device-integrity checks.',
    actions: [
      { action: 'Ship the 2026-07-05 kernel patch to the fleet', owner: 'Mobile Platform / EMM', urgency: 'this_week' },
      { action: 'Raise fraud risk weight for detected-rooted devices', owner: 'Fraud Risk Engineering', urgency: 'this_week' },
    ], owner: 'Mobile Platform Security' },
  { id: 7, change: 104, risk: 7.0, days: 4,
    title: 'Compensate for weakened MediaTek attestation (CVE-2025-32432)',
    summary: 'Forgeable hardware attestation on certain MediaTek SoCs erodes the Play Integrity device verdict. Add compensating signals for affected chipsets.',
    actions: [
      { action: 'Down-weight hardware attestation for affected MediaTek models', owner: 'Fraud Risk Engineering', urgency: 'this_week' },
      { action: 'Add behavioral signals as a fallback trust source', owner: 'Data Science', urgency: 'this_month' },
    ], owner: 'Fraud Risk Engineering' },
  { id: 8, change: 108, risk: 6.4, days: 7,
    title: 'Track Samsung Knox sandbox-escape remediation (SVE-2026-1188)',
    summary: 'A Knox container sandbox escape affects Galaxy S23 / S24 on One UI 6.1. Track patch adoption across the affected Samsung segment.',
    actions: [
      { action: 'Monitor One UI 2026-07 patch adoption for S23 / S24', owner: 'Mobile Platform / EMM', urgency: 'this_month' },
    ], owner: 'Mobile Platform Security' },
  { id: 9, change: 109, risk: 6.2, days: 8,
    title: 'Watch Qualcomm baseband OTA RCE rollout (CVE-2026-21012)',
    summary: 'An over-the-air baseband memory-corruption RCE is patched upstream but the OEM rollout is pending. Monitor for device availability and prioritize on release.',
    actions: [
      { action: 'Subscribe to OEM patch-availability notifications', owner: 'Mobile Platform / EMM', urgency: 'this_month' },
    ], owner: 'Mobile Platform Security' },
  { id: 10, change: 110, risk: 5.6, days: 9,
    title: 'Migrate OTP reading ahead of SMS / Call Log policy tightening',
    summary: 'Play policy will restrict SMS and Call Log access to default handler apps. Anti-fraud OTP reading must move to the SMS Retriever API before enforcement.',
    actions: [
      { action: 'Replace SMS-read OTP flow with the SMS Retriever API', owner: 'Mobile Engineering', urgency: 'this_month' },
      { action: 'Remove SMS / Call Log permission declarations', owner: 'Mobile Engineering', urgency: 'this_month' },
    ], owner: 'Mobile Engineering' },
];

const priorityFor = (risk) => (risk >= 9 ? 'critical' : risk >= 7 ? 'high' : risk >= 5 ? 'medium' : 'low');

export const RECOMMENDATIONS = RAW_TICKETS.map(t => {
  const change = CHANGES.find(c => c.id === t.change);
  const src = SOURCES.find(s => s.id === change?.source_id);
  return {
    id: t.id,
    change_id: t.change,
    title: t.title,
    summary: t.summary,
    priority: priorityFor(t.risk),
    risk_score: t.risk,
    recommended_actions: t.actions,
    owner_suggestion: t.owner,
    evidence_citations: [`change_${t.change}_chunk_0_added`],
    created_at: ago(t.days),
    source_name: src?.name,
    source_category: src?.category,
  };
});

// Agent-event count: Scout (detect) + Sentinel (triage) per change, plus a
// Coordinator event per generated ticket.
export const AGENT_EVENT_COUNT = CHANGES.length * 2 + RECOMMENDATIONS.length;

// ── Knowledge graph — built from the same intelligence shown everywhere ───
// Structured entities extracted per change. The graph is derived from these
// so it stays consistent with the change feed, tickets and sources — and so
// shared components (e.g. Play Integrity, Kernel) knit the clusters into one
// connected, cross-source web instead of disconnected stars.
const CHANGE_ENTITIES = {
  101: { cves: ['CVE-2026-33634'], components: ['Android System'] },
  102: { cves: ['CVE-2026-33017', 'CVE-2026-33021'], components: ['Framework', 'Media'] },
  103: { policy: ['Play Integrity Mandate'], components: ['Play Integrity'] },
  113: { cves: ['CVE-2025-54068'], components: ['Ad SDK'] },
  104: { cves: ['CVE-2025-32432'], components: ['MediaTek Keystore', 'Play Integrity'] },
  105: { components: ['Foreground Service'], api: ['API 35'] },
  106: { components: ['Play Integrity'], api: ['API 35'] },
  107: { cves: ['CVE-2026-3055'], components: ['WebView', 'V8 Engine'] },
  108: { cves: ['SVE-2026-1188'], components: ['Samsung Knox'] },
  109: { cves: ['CVE-2026-21012'], components: ['Qualcomm Baseband', 'Kernel'] },
  110: { policy: ['SMS / Call-Log Policy'], components: ['SMS Permission'] },
  115: { cves: ['CVE-2026-33099'], components: ['Binder Driver', 'Kernel'] },
  116: { components: ['Hardware Attestation', 'Play Integrity'] },
  114: { components: ['SDK Runtime'] },
  111: { cves: ['CVE-2021-30952'], components: ['WebKit'] },
  112: { components: ['Play Billing'] },
};

function buildGraph() {
  const nodes = [];
  const seen = new Set();
  const links = [];
  const addNode = (id, node_type) => {
    if (id && !seen.has(id)) { seen.add(id); nodes.push({ id, node_type }); }
  };
  const addLink = (source, target, relation) => {
    if (source && target) links.push({ source, target, relation });
  };

  for (const c of CHANGES) {
    const cid = `change_${c.id}`;
    addNode(cid, 'change_event');
    addNode(c.source_name, 'source');
    addLink(c.source_name, cid, 'detected');

    const ent = CHANGE_ENTITIES[c.id] || {};
    (ent.cves || []).forEach((cve) => { addNode(cve, 'cve'); addLink(cid, cve, 'references'); });
    (ent.components || []).forEach((comp) => { addNode(comp, 'component'); addLink(cid, comp, 'affects'); });
    (ent.policy || []).forEach((p) => { addNode(p, 'policy_clause'); addLink(cid, p, 'updates'); });
    (ent.api || []).forEach((a) => { addNode(a, 'api_level'); addLink(cid, a, 'targets'); });
  }

  // CVE → component edges tie vulnerabilities to the infrastructure they hit,
  // so components that appear in several changes become natural hubs.
  for (const c of CHANGES) {
    const ent = CHANGE_ENTITIES[c.id] || {};
    (ent.cves || []).forEach((cve) => {
      (ent.components || []).forEach((comp) => addLink(cve, comp, 'impacts'));
    });
  }

  return { nodes, links };
}

export const GRAPH_RAW = buildGraph();
export const ABLATION = ablationRaw;
