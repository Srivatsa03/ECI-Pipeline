"""ECI Ablation Benchmark — 110 annotated queries across 5 query types.

Query types (per professor's requirements):
  EXACT_CHANGE    — single-source, specific change lookups (35 queries)
  MULTI_HOP       — cross-source linkage requiring graph traversal (25 queries)
  POLICY_SECURITY — intersection of policy updates and security changes (20 queries)
  ACTION_REC      — action recommendation queries (15 queries)
  FALSE_ALARM     — cosmetic or irrelevant queries that should NOT retrieve security content (15 queries)

Each query carries:
  expected_source_categories — source categories a relevant result must come from
  is_relevant                — False for false-alarm queries (system should reject)
  related_entities           — CVEs, API names, etc. referenced in the query
  description                — human-readable annotation explaining the expected answer
"""
from dataclasses import dataclass, field

EXACT_CHANGE = "exact_change"
MULTI_HOP = "multi_hop"
POLICY_SECURITY = "policy_security"
ACTION_REC = "action_recommendation"
FALSE_ALARM = "false_alarm"

ALL_QUERY_TYPES = (EXACT_CHANGE, MULTI_HOP, POLICY_SECURITY, ACTION_REC, FALSE_ALARM)


@dataclass
class BenchmarkQuery:
    query_text: str
    query_type: str
    expected_source_categories: list[str]
    is_relevant: bool = True
    related_entities: list[str] = field(default_factory=list)
    description: str = ""


# ── TYPE 1: EXACT CHANGE DETECTION (35 queries) ──────────────────────────────
# Each query targets a specific, verifiable change present in the test corpus.

_EXACT = [
    BenchmarkQuery(
        "What new CVEs were added to the Android Security Bulletin in the latest update?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "Bulletin V2 added two new CVEs: Wi-Fi HAL buffer overflow and Mali GPU type confusion.",
    ),
    BenchmarkQuery(
        "What is the CVE-2025-0096 vulnerability and which Android versions does it affect?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0096"],
        "Wi-Fi HAL buffer overflow, affects Android 14 and 15.",
    ),
    BenchmarkQuery(
        "Was active exploitation detected for any Android Security Bulletin CVEs?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0091"],
        "CVE-2025-0091 updated with exploitation detected in limited targeted attacks.",
    ),
    BenchmarkQuery(
        "What public exploit code became available for Android CVEs?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0093"],
        "CVE-2025-0093 updated: public exploit code is now available.",
    ),
    BenchmarkQuery(
        "What Mali GPU driver vulnerability was disclosed in the Android Security Bulletin?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0097"],
        "CVE-2025-0097: type confusion in Mali GPU driver allows kernel code execution.",
    ),
    BenchmarkQuery(
        "What additional kernel version received a patch in the latest Android Security Bulletin?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0094"],
        "CVE-2025-0094 binder driver patch now also available for kernel 6.6.",
    ),
    BenchmarkQuery(
        "What Wi-Fi subsystem vulnerability allows remote code execution without user interaction?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0096"],
        "CVE-2025-0096 Wi-Fi HAL buffer overflow via crafted Wi-Fi frame, no user interaction.",
    ),
    BenchmarkQuery(
        "What Android kernel versions are affected by the GPU driver type confusion vulnerability?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0097"],
        "CVE-2025-0097 affects kernel 5.15, 6.1, and 6.6.",
    ),
    BenchmarkQuery(
        "What new verdict category was added to the Play Integrity API?",
        EXACT_CHANGE, ["developer_docs"], True,
        ["MEETS_VIRTUAL_INTEGRITY"],
        "MEETS_VIRTUAL_INTEGRITY added in May 2025 to distinguish virtual/emulator devices.",
    ),
    BenchmarkQuery(
        "How did the Play Integrity API token validity period change?",
        EXACT_CHANGE, ["developer_docs"], True,
        [],
        "Token validity reduced from 10 minutes to 5 minutes for enhanced security.",
    ),
    BenchmarkQuery(
        "What new granular device activity levels were introduced in the Play Integrity API?",
        EXACT_CHANGE, ["developer_docs"], True,
        [],
        "LEVEL_1 through LEVEL_4 replaced the previous binary activity signal.",
    ),
    BenchmarkQuery(
        "When will the Classic Play Integrity API be sunset?",
        EXACT_CHANGE, ["developer_docs"], True,
        [],
        "Classic API sunset date is November 30, 2025.",
    ),
    BenchmarkQuery(
        "What new requirement was added for standard Play Integrity API requests?",
        EXACT_CHANGE, ["developer_docs"], True,
        [],
        "Standard API requests now require app linking to Play Console.",
    ),
    BenchmarkQuery(
        "What binary device activity signal was deprecated in the Play Integrity API?",
        EXACT_CHANGE, ["developer_docs"], True,
        [],
        "Previous binary activity signal deprecated as of April 2025.",
    ),
    BenchmarkQuery(
        "What CVEs were newly added to the CISA Known Exploited Vulnerabilities catalog?",
        EXACT_CHANGE, ["cve_feed"], True,
        ["CVE-2025-0097", "CVE-2025-0096"],
        "CISA KEV V2 added CVE-2025-0097 (Mali GPU) and CVE-2025-0096 (Wi-Fi HAL).",
    ),
    BenchmarkQuery(
        "Which Android vulnerability was newly linked to ransomware campaigns in CISA KEV?",
        EXACT_CHANGE, ["cve_feed"], True,
        ["CVE-2025-0093"],
        "CVE-2025-0093 ransomware campaign status changed from Unknown to Known.",
    ),
    BenchmarkQuery(
        "What is the CISA remediation deadline for CVE-2025-0097?",
        EXACT_CHANGE, ["cve_feed"], True,
        ["CVE-2025-0097"],
        "Due date is April 10, 2025.",
    ),
    BenchmarkQuery(
        "What is the CISA remediation deadline for the Android Wi-Fi HAL buffer overflow?",
        EXACT_CHANGE, ["cve_feed"], True,
        ["CVE-2025-0096"],
        "Due date is April 11, 2025.",
    ),
    BenchmarkQuery(
        "What new Google Play policy was introduced for AI-generated content?",
        EXACT_CHANGE, ["policy_update"], True,
        [],
        "New AI-Generated Content section: apps must label AI content and provide user reporting.",
    ),
    BenchmarkQuery(
        "What are the new financial app requirements in Google Play policy?",
        EXACT_CHANGE, ["policy_update"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "Financial apps must implement MEETS_STRONG_INTEGRITY for all transaction actions by May 2025.",
    ),
    BenchmarkQuery(
        "What photo and video permission migration is required for Android apps?",
        EXACT_CHANGE, ["policy_update"], True,
        ["READ_MEDIA_IMAGES"],
        "Apps must migrate from READ_MEDIA_IMAGES to the Android Photo Picker API by September 2025.",
    ),
    BenchmarkQuery(
        "What new device attestation requirement was added to Google Play policy?",
        EXACT_CHANGE, ["policy_update"], True,
        [],
        "Apps detecting rooted devices must use Play Integrity API; custom root detection alone no longer accepted.",
    ),
    BenchmarkQuery(
        "What new Samsung SVE vulnerability affects the Secure Folder?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["SVE-2025-0303"],
        "SVE-2025-0303: race condition in Secure Folder allows unauthorized file extraction, actively exploited.",
    ),
    BenchmarkQuery(
        "Was the Samsung Knox attestation bypass patch expanded to additional device models?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["SVE-2025-0301"],
        "SVE-2025-0301 patch extended to Galaxy A-series devices.",
    ),
    BenchmarkQuery(
        "Which Pixel vulnerability was confirmed to be exploited by commercial spyware vendors?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["CVE-2025-P003"],
        "CVE-2025-P003 Pixel modem heap overflow exploited by commercial spyware (Google TAG confirmed).",
    ),
    BenchmarkQuery(
        "What additional mitigation was deployed for the Titan M2 firmware vulnerability?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["CVE-2025-P001"],
        "Additional mitigation for CVE-2025-P001 deployed via Play system update.",
    ),
    BenchmarkQuery(
        "What new CVE was added to NVD for Android camera components?",
        EXACT_CHANGE, ["cve_feed"], True,
        ["CVE-2025-0098"],
        "CVE-2025-0098: Camera HAL integer overflow on Qualcomm devices, CVSS 7.5.",
    ),
    BenchmarkQuery(
        "What is the CVSS score and severity for CVE-2025-0093 in NVD?",
        EXACT_CHANGE, ["cve_feed"], True,
        ["CVE-2025-0093"],
        "CVE-2025-0093 CVSS base score 9.8, CRITICAL severity.",
    ),
    BenchmarkQuery(
        "Which CVE in Samsung bulletin is newly listed alongside Google patches?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["CVE-2025-0096"],
        "Samsung bulletin V2 added CVE-2025-0096 to its Google patches list.",
    ),
    BenchmarkQuery(
        "What Pixel-specific patches address modem vulnerabilities?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["CVE-2025-P003"],
        "CVE-2025-P003 heap overflow in Pixel baseband modem, affects Pixel 8/8a/9/9 Pro.",
    ),
    BenchmarkQuery(
        "What Android vulnerability requires patching across kernel versions 5.15, 6.1, and 6.6?",
        EXACT_CHANGE, ["security_bulletin"], True,
        ["CVE-2025-0097"],
        "CVE-2025-0097 Mali GPU type confusion affects all three kernel versions.",
    ),
    BenchmarkQuery(
        "What are the new Pixel Update Bulletin patches included from Android Security Bulletin?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "Pixel bulletin V2 added supplementary patches for CVE-2025-0096 and CVE-2025-0097.",
    ),
    BenchmarkQuery(
        "What Theft Detection Lock improvements were added to Pixel devices?",
        EXACT_CHANGE, ["oem_bulletin"], True,
        [],
        "New: Theft Detection Lock improvements for Pixel 7+ in V2 functional updates.",
    ),
    BenchmarkQuery(
        "What is the September 2025 deadline in Google Play policy about?",
        EXACT_CHANGE, ["policy_update"], True,
        [],
        "READ_MEDIA_IMAGES migration to Photo Picker API deadline.",
    ),
    BenchmarkQuery(
        "What device integrity verdict distinguishes virtual devices from physical devices?",
        EXACT_CHANGE, ["developer_docs"], True,
        ["MEETS_VIRTUAL_INTEGRITY"],
        "MEETS_VIRTUAL_INTEGRITY added to distinguish emulators and cloud-hosted instances.",
    ),
]

# ── TYPE 2: MULTI-HOP LINKAGE (25 queries) ───────────────────────────────────
# These require connecting evidence across multiple source categories through
# the knowledge graph. A correct answer must cite at least two source categories.

_MULTI_HOP = [
    BenchmarkQuery(
        "How does CVE-2025-0093 appear across Android Security Bulletin and CISA KEV?",
        MULTI_HOP, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0093"],
        "Bulletin has active exploit update; CISA changed ransomware status to Known.",
    ),
    BenchmarkQuery(
        "Which CVEs from the Android Security Bulletin were also added to CISA KEV in the same update cycle?",
        MULTI_HOP, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "CVE-2025-0096 and CVE-2025-0097 appear in both bulletin V2 and CISA KEV V2.",
    ),
    BenchmarkQuery(
        "Which Samsung bulletin vulnerabilities overlap with Android Security Bulletin CVEs?",
        MULTI_HOP, ["oem_bulletin", "security_bulletin"], True,
        ["CVE-2025-0096"],
        "Samsung bulletin V2 added CVE-2025-0096 from the Android Security Bulletin.",
    ),
    BenchmarkQuery(
        "How does the Mali GPU vulnerability connect across Android Security Bulletin and CISA KEV?",
        MULTI_HOP, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0097"],
        "CVE-2025-0097 added in bulletin V2 and also newly added to CISA KEV.",
    ),
    BenchmarkQuery(
        "What Android vulnerabilities with active exploitation appear in both Google and Samsung bulletins?",
        MULTI_HOP, ["security_bulletin", "oem_bulletin"], True,
        ["CVE-2025-0093"],
        "CVE-2025-0093 has public exploit in Android bulletin; Samsung references same CVE.",
    ),
    BenchmarkQuery(
        "Which Pixel update patches are also referenced in the Android Security Bulletin?",
        MULTI_HOP, ["oem_bulletin", "security_bulletin"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "Pixel bulletin V2 references supplementary patches for CVE-2025-0096 and CVE-2025-0097.",
    ),
    BenchmarkQuery(
        "How do Play Integrity API changes align with the new Google Play financial services policy?",
        MULTI_HOP, ["developer_docs", "policy_update"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "Play Integrity V2 adds MEETS_VIRTUAL_INTEGRITY; policy mandates MEETS_STRONG_INTEGRITY for transactions.",
    ),
    BenchmarkQuery(
        "What CVEs affecting Android were assigned CVSS scores in NVD and also appear in CISA KEV?",
        MULTI_HOP, ["cve_feed"], True,
        ["CVE-2025-0093", "CVE-2025-0097"],
        "CVE-2025-0093 (CVSS 9.8) and CVE-2025-0097 appear in both NVD and CISA KEV.",
    ),
    BenchmarkQuery(
        "How does the MEETS_VIRTUAL_INTEGRITY change relate to the Google Play device attestation policy?",
        MULTI_HOP, ["developer_docs", "policy_update"], True,
        ["MEETS_VIRTUAL_INTEGRITY"],
        "Play Integrity API adds virtual verdict; policy requires Play Integrity for device attestation.",
    ),
    BenchmarkQuery(
        "Which critical Android CVEs appear across Google Security Bulletin, Samsung OEM bulletin, and CISA?",
        MULTI_HOP, ["security_bulletin", "oem_bulletin", "cve_feed"], True,
        ["CVE-2025-0093", "CVE-2025-0096"],
        "CVE-2025-0093 in all three; CVE-2025-0096 in bulletin + Samsung + CISA.",
    ),
    BenchmarkQuery(
        "What kernel vulnerabilities in the Android Security Bulletin are also tracked by CISA?",
        MULTI_HOP, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0097"],
        "CVE-2025-0097 (Mali GPU, kernel-level) in both bulletin and CISA KEV.",
    ),
    BenchmarkQuery(
        "How do Pixel-specific CVEs relate to the Android Security Bulletin?",
        MULTI_HOP, ["oem_bulletin", "security_bulletin"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "Pixel bulletin references same CVE-2025-0096 and CVE-2025-0097 as Android bulletin.",
    ),
    BenchmarkQuery(
        "What CVE is tracked in both NVD and CISA KEV with a CRITICAL CVSS score?",
        MULTI_HOP, ["cve_feed"], True,
        ["CVE-2025-0093"],
        "CVE-2025-0093 has CVSS 9.8 (CRITICAL) in NVD and is in CISA KEV.",
    ),
    BenchmarkQuery(
        "Which vulnerability is referenced in both the Android Security Bulletin and the Samsung Secure Folder?",
        MULTI_HOP, ["security_bulletin", "oem_bulletin"], True,
        ["CVE-2025-0096"],
        "CVE-2025-0096 appears in Android bulletin and Samsung bulletin's Google patches.",
    ),
    BenchmarkQuery(
        "What developer documentation changes require corresponding policy compliance updates?",
        MULTI_HOP, ["developer_docs", "policy_update"], True,
        [],
        "Play Integrity MEETS_STRONG_INTEGRITY requirement ties to financial services policy.",
    ),
    BenchmarkQuery(
        "Which Samsung SVE vulnerabilities co-occur with Google Android CVEs in the same update?",
        MULTI_HOP, ["oem_bulletin", "security_bulletin"], True,
        ["CVE-2025-0096", "SVE-2025-0303"],
        "Samsung V2 added CVE-2025-0096 (Google) alongside SVE-2025-0303 (Samsung-specific).",
    ),
    BenchmarkQuery(
        "How does the binder driver vulnerability connect to other Android kernel issues across sources?",
        MULTI_HOP, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0094", "CVE-2025-0097"],
        "Both CVE-2025-0094 (binder) and CVE-2025-0097 (GPU) are kernel-level Android issues.",
    ),
    BenchmarkQuery(
        "What Android framework CVEs appear in both NVD and the Android Security Bulletin?",
        MULTI_HOP, ["cve_feed", "security_bulletin"], True,
        ["CVE-2025-0091"],
        "CVE-2025-0091 (ActivityManagerService) is in NVD (CVSS 7.8) and Android bulletin.",
    ),
    BenchmarkQuery(
        "Which vulnerabilities in CISA KEV are also patched in the Pixel Update Bulletin?",
        MULTI_HOP, ["cve_feed", "oem_bulletin"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "CISA KEV V2 added CVE-2025-0096 and CVE-2025-0097; both in Pixel bulletin V2.",
    ),
    BenchmarkQuery(
        "What Pixel OEM changes overlap with changes in the Android Security Bulletin framework section?",
        MULTI_HOP, ["oem_bulletin", "security_bulletin"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "Pixel bulletin V2 added CVE-2025-0096 and CVE-2025-0097 which are in Android bulletin V2.",
    ),
    BenchmarkQuery(
        "How does the Play Integrity token validity change relate to Android security policy enforcement?",
        MULTI_HOP, ["developer_docs", "policy_update"], True,
        [],
        "Token validity 10→5 min in Play Integrity; policy now mandates Play Integrity for attestation.",
    ),
    BenchmarkQuery(
        "What security changes across multiple sources affect Android 14 and 15 specifically?",
        MULTI_HOP, ["security_bulletin", "cve_feed", "policy_update"], True,
        ["CVE-2025-0096"],
        "CVE-2025-0096 affects Android 14/15 (bulletin + CISA); policy targets those versions.",
    ),
    BenchmarkQuery(
        "Which ARM Mali GPU vulnerabilities appear in both the Android Security Bulletin and CISA KEV?",
        MULTI_HOP, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0097"],
        "CVE-2025-0097 ARM Mali GPU type confusion in both sources.",
    ),
    BenchmarkQuery(
        "How do Samsung Knox and TrustZone vulnerabilities connect to the Android Security Bulletin?",
        MULTI_HOP, ["oem_bulletin", "security_bulletin"], True,
        ["SVE-2025-0301", "SVE-2025-0302"],
        "Samsung Knox bypass and TrustZone issues are OEM-specific but reference Android bulletin CVEs.",
    ),
    BenchmarkQuery(
        "What evidence across sources supports that CVE-2025-0093 poses a ransomware risk?",
        MULTI_HOP, ["security_bulletin", "cve_feed", "oem_bulletin"], True,
        ["CVE-2025-0093"],
        "Bulletin V2: public exploit; CISA KEV V2: ransomware campaign Known; Samsung references it.",
    ),
]

# ── TYPE 3: POLICY-SECURITY INTERACTION (20 queries) ─────────────────────────
# Queries where the correct answer requires understanding how a security change
# demands a policy response, or vice versa.

_POLICY_SECURITY = [
    BenchmarkQuery(
        "What security vulnerabilities require financial apps to update their device trust controls?",
        POLICY_SECURITY, ["security_bulletin", "cve_feed", "policy_update"], True,
        ["CVE-2025-0093", "CVE-2025-0096"],
        "Active exploits in bulletin + CISA; policy now mandates Play Integrity MEETS_STRONG_INTEGRITY.",
    ),
    BenchmarkQuery(
        "How does the Play Integrity API update affect compliance requirements for financial fraud detection?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "MEETS_VIRTUAL_INTEGRITY and token validity change affect fraud signal calibration; policy mandates compliance.",
    ),
    BenchmarkQuery(
        "What attestation API changes require financial institutions to update their mobile verification logic?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        ["MEETS_STRONG_INTEGRITY", "MEETS_VIRTUAL_INTEGRITY"],
        "Play Integrity API V2 changes require updating attestation checks per new policy mandate.",
    ),
    BenchmarkQuery(
        "Which new Google Play policies mandate implementing specific security APIs?",
        POLICY_SECURITY, ["policy_update", "developer_docs"], True,
        [],
        "Policy V2: device attestation must use Play Integrity API; financial services must use MEETS_STRONG_INTEGRITY.",
    ),
    BenchmarkQuery(
        "How do new MEETS_STRONG_INTEGRITY requirements create a fraud prevention compliance obligation?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "Policy mandates MEETS_STRONG_INTEGRITY for transactions; Play Integrity API change enables this.",
    ),
    BenchmarkQuery(
        "What Android Security Bulletin updates should trigger a policy review for fraud teams?",
        POLICY_SECURITY, ["security_bulletin", "policy_update"], True,
        ["CVE-2025-0091"],
        "Exploitation of CVE-2025-0091 should trigger review of device trust enforcement policies.",
    ),
    BenchmarkQuery(
        "Which CISA KEV entries require financial apps to implement additional attestation verification?",
        POLICY_SECURITY, ["cve_feed", "developer_docs", "policy_update"], True,
        ["CVE-2025-0093", "CVE-2025-0097"],
        "CISA KEV exploited CVEs + policy mandate for Play Integrity together require stronger verification.",
    ),
    BenchmarkQuery(
        "What is the intersection between device attestation changes and Google Play financial services compliance?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "Play Integrity API changes intersect directly with the financial services policy update.",
    ),
    BenchmarkQuery(
        "How do OEM security patches affect Play Integrity verdict reliability for fraud detection?",
        POLICY_SECURITY, ["oem_bulletin", "developer_docs"], True,
        ["SVE-2025-0301"],
        "Knox attestation bypass (SVE-2025-0301) can affect Play Integrity verdict reliability.",
    ),
    BenchmarkQuery(
        "Which policy enforcement dates align with upcoming vulnerability patch deadlines?",
        POLICY_SECURITY, ["policy_update", "cve_feed"], True,
        [],
        "CISA April deadlines align with Google Play May/July enforcement dates for financial apps.",
    ),
    BenchmarkQuery(
        "How does the AI-generated content policy interact with mobile app security requirements?",
        POLICY_SECURITY, ["policy_update"], True,
        [],
        "New AI content policy requires labeling and reporting, intersecting with app security design.",
    ),
    BenchmarkQuery(
        "What does the READ_MEDIA_IMAGES deprecation mean for apps using storage permissions?",
        POLICY_SECURITY, ["policy_update", "developer_docs"], True,
        ["READ_MEDIA_IMAGES"],
        "Migration to Photo Picker required; affects apps using broad storage for security checks.",
    ),
    BenchmarkQuery(
        "How do CISA KEV remediation deadlines relate to Google Play policy enforcement timelines?",
        POLICY_SECURITY, ["cve_feed", "policy_update"], True,
        [],
        "CISA deadlines in April; Google Play policy warnings start July 2025 — parallel timelines.",
    ),
    BenchmarkQuery(
        "What developer documentation changes require updates to security implementation guides?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        [],
        "Play Integrity API changes (token validity, new verdicts) require implementation guide updates.",
    ),
    BenchmarkQuery(
        "How do Samsung Knox changes affect enterprise mobile security policy compliance?",
        POLICY_SECURITY, ["oem_bulletin", "policy_update"], True,
        ["SVE-2025-0301"],
        "Knox attestation bypass patch expansion affects enterprise device management policy compliance.",
    ),
    BenchmarkQuery(
        "What security vulnerabilities prompted new Google Play app store policy requirements?",
        POLICY_SECURITY, ["security_bulletin", "policy_update"], True,
        [],
        "Rising exploitation in bulletin V2 aligns with new policy mandates for attestation.",
    ),
    BenchmarkQuery(
        "How does the Play Integrity policy enforcement timeline relate to Android vulnerability patch cadence?",
        POLICY_SECURITY, ["developer_docs", "policy_update", "security_bulletin"], True,
        [],
        "Play Integrity sunset Nov 2025; bulletin patch cadence is monthly — mismatch risk.",
    ),
    BenchmarkQuery(
        "What security controls must financial apps update based on Play Integrity and policy changes combined?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "Both Play Integrity V2 and policy V2 require MEETS_STRONG_INTEGRITY for transactions.",
    ),
    BenchmarkQuery(
        "How do OEM-specific CVEs in Samsung bulletin affect Google Play compliance requirements?",
        POLICY_SECURITY, ["oem_bulletin", "policy_update"], True,
        ["SVE-2025-0303"],
        "Active exploitation via Secure Folder race condition should prompt policy review.",
    ),
    BenchmarkQuery(
        "What fraud prevention measures are required by the new Play Integrity activity level tiers?",
        POLICY_SECURITY, ["developer_docs", "policy_update"], True,
        [],
        "LEVEL_1 through LEVEL_4 activity tiers allow more granular fraud signal calibration.",
    ),
]

# ── TYPE 4: ACTION RECOMMENDATION (15 queries) ───────────────────────────────
# Queries asking for specific operational actions. Correct answers must include
# concrete, prioritized steps tied to evidence in the corpus.

_ACTION_REC = [
    BenchmarkQuery(
        "What immediate actions should a financial institution take given the latest Android critical CVEs?",
        ACTION_REC, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0096", "CVE-2025-0097"],
        "Prioritize patching CVE-2025-0096 and CVE-2025-0097; both are critical with CISA deadlines.",
    ),
    BenchmarkQuery(
        "What should risk operations teams do about the Android Bluetooth vulnerability CVE-2025-0093?",
        ACTION_REC, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0093"],
        "Immediately patch; ransomware-linked; CISA deadline March 31, 2025.",
    ),
    BenchmarkQuery(
        "What steps are required for compliance with the new Google Play financial services policy?",
        ACTION_REC, ["policy_update", "developer_docs"], True,
        ["MEETS_STRONG_INTEGRITY"],
        "Implement MEETS_STRONG_INTEGRITY for transactions by May 2025; warnings start July 2025.",
    ),
    BenchmarkQuery(
        "What is the priority and timeline for patching devices against the Android Wi-Fi HAL vulnerability?",
        ACTION_REC, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0096"],
        "Critical priority; CISA deadline April 11, 2025; no user interaction required to exploit.",
    ),
    BenchmarkQuery(
        "What actions should be taken for the Samsung Secure Folder vulnerability with active exploitation?",
        ACTION_REC, ["oem_bulletin"], True,
        ["SVE-2025-0303"],
        "Immediate: isolate affected Galaxy devices; patch Galaxy S24, S23, Z Fold5, Z Flip5.",
    ),
    BenchmarkQuery(
        "How should fraud detection thresholds be adjusted based on Play Integrity API changes?",
        ACTION_REC, ["developer_docs"], True,
        ["MEETS_VIRTUAL_INTEGRITY"],
        "Update logic to use LEVEL_1-4 tiers; add MEETS_VIRTUAL_INTEGRITY handling; reduce token window to 5 min.",
    ),
    BenchmarkQuery(
        "What migration steps are required before the Classic Play Integrity API is sunset?",
        ACTION_REC, ["developer_docs"], True,
        [],
        "Migrate to standard API with Play Console app linking before November 30, 2025.",
    ),
    BenchmarkQuery(
        "What is the recommended response timeline for CVE-2025-0097 Mali GPU driver vulnerability?",
        ACTION_REC, ["security_bulletin", "cve_feed"], True,
        ["CVE-2025-0097"],
        "CISA deadline April 10, 2025; critical; affects kernel 5.15, 6.1, 6.6.",
    ),
    BenchmarkQuery(
        "What monitoring should be implemented for the Pixel modem vulnerability exploited by spyware?",
        ACTION_REC, ["oem_bulletin"], True,
        ["CVE-2025-P003"],
        "Monitor Pixel 8/8a/9/9 Pro baseband; apply update; watch for RRC-based exploitation indicators.",
    ),
    BenchmarkQuery(
        "What app-level changes are required to comply with the Photo Picker API migration policy?",
        ACTION_REC, ["policy_update", "developer_docs"], True,
        ["READ_MEDIA_IMAGES"],
        "Replace READ_MEDIA_IMAGES requests with Android Photo Picker API before September 2025.",
    ),
    BenchmarkQuery(
        "How urgently should banks update Android device trust controls given the latest security changes?",
        ACTION_REC, ["developer_docs", "security_bulletin", "cve_feed"], True,
        [],
        "Immediate: CISA deadlines in April; Play Integrity policy enforced May 2025.",
    ),
    BenchmarkQuery(
        "What enterprise device management policies should be updated given Samsung Knox changes?",
        ACTION_REC, ["oem_bulletin"], True,
        ["SVE-2025-0301"],
        "Update MDM policy to require latest Samsung patch for A-series devices.",
    ),
    BenchmarkQuery(
        "What is the escalation priority for the Titan M2 firmware vulnerability in Pixel devices?",
        ACTION_REC, ["oem_bulletin"], True,
        ["CVE-2025-P001"],
        "High priority; physical attack vector; additional Play system update mitigation available.",
    ),
    BenchmarkQuery(
        "How should risk teams respond to the ransomware campaign linked to CVE-2025-0093?",
        ACTION_REC, ["cve_feed", "security_bulletin"], True,
        ["CVE-2025-0093"],
        "Emergency patch; CISA deadline March 31; Samsung also affected; escalate to Risk Engineering.",
    ),
    BenchmarkQuery(
        "What developer implementation changes are needed for the new Play Integrity activity tiers?",
        ACTION_REC, ["developer_docs"], True,
        [],
        "Update device activity signal logic from binary to LEVEL_1-4 tiers; redeploy before April 2025.",
    ),
]

# ── TYPE 5: FALSE ALARM REJECTION (15 queries) ───────────────────────────────
# Queries about topics completely unrelated to Android ecosystem security.
# A well-calibrated system should return low-confidence or no results.

_FALSE_ALARM = [
    BenchmarkQuery(
        "What is the syntax for writing a Python decorator function?",
        FALSE_ALARM, [], False,
        [], "Unrelated to Android security ecosystem.",
    ),
    BenchmarkQuery(
        "How does TCP/IP networking protocol establish a connection?",
        FALSE_ALARM, [], False,
        [], "General networking, unrelated to monitored sources.",
    ),
    BenchmarkQuery(
        "What are the best practices for writing unit tests in Java?",
        FALSE_ALARM, [], False,
        [], "General software engineering, not security monitoring.",
    ),
    BenchmarkQuery(
        "How does compound interest accumulate in a savings account?",
        FALSE_ALARM, [], False,
        [], "Finance domain but unrelated to Android fraud risk monitoring.",
    ),
    BenchmarkQuery(
        "What are the main features of the Swift programming language?",
        FALSE_ALARM, [], False,
        [], "iOS development language, not Android security.",
    ),
    BenchmarkQuery(
        "How do blockchains achieve distributed consensus?",
        FALSE_ALARM, [], False,
        [], "Unrelated distributed systems topic.",
    ),
    BenchmarkQuery(
        "What is the difference between SQL and NoSQL databases?",
        FALSE_ALARM, [], False,
        [], "Database comparison, unrelated to monitored sources.",
    ),
    BenchmarkQuery(
        "What are the latest trends in machine learning model architectures?",
        FALSE_ALARM, [], False,
        [], "ML research, unrelated to Android security bulletins.",
    ),
    BenchmarkQuery(
        "How do you configure Kubernetes ingress controllers?",
        FALSE_ALARM, [], False,
        [], "Cloud infrastructure, not Android ecosystem security.",
    ),
    BenchmarkQuery(
        "What is the recommended way to handle CORS in a REST API?",
        FALSE_ALARM, [], False,
        [], "Web API design, unrelated to Android security changes.",
    ),
    BenchmarkQuery(
        "How does gradient descent optimize neural network weights?",
        FALSE_ALARM, [], False,
        [], "Deep learning optimization, not security monitoring.",
    ),
    BenchmarkQuery(
        "What are the principles of object-oriented programming?",
        FALSE_ALARM, [], False,
        [], "General programming paradigm, not relevant to any source.",
    ),
    BenchmarkQuery(
        "How do you set up a CI/CD pipeline with GitHub Actions?",
        FALSE_ALARM, [], False,
        [], "DevOps topic, unrelated to Android ecosystem bulletins.",
    ),
    BenchmarkQuery(
        "What is the capital city of Australia?",
        FALSE_ALARM, [], False,
        [], "General knowledge, completely irrelevant.",
    ),
    BenchmarkQuery(
        "How does the human immune system respond to viral infections?",
        FALSE_ALARM, [], False,
        [], "Biology, completely irrelevant to Android security monitoring.",
    ),
]

# ── Combined Benchmark ────────────────────────────────────────────────────────

BENCHMARK_QUERIES: list[BenchmarkQuery] = (
    _EXACT + _MULTI_HOP + _POLICY_SECURITY + _ACTION_REC + _FALSE_ALARM
)


def get_queries_by_type(query_type: str) -> list[BenchmarkQuery]:
    """Return all benchmark queries of a specific type."""
    return [q for q in BENCHMARK_QUERIES if q.query_type == query_type]


def benchmark_summary() -> dict:
    """Return a count summary of the benchmark dataset."""
    summary = {qt: 0 for qt in ALL_QUERY_TYPES}
    for q in BENCHMARK_QUERIES:
        summary[q.query_type] += 1
    summary["total"] = len(BENCHMARK_QUERIES)
    return summary


if __name__ == "__main__":
    s = benchmark_summary()
    print("ECI Benchmark Dataset Summary")
    print("=" * 40)
    for qt, count in s.items():
        print(f"  {qt:<25} {count}")
