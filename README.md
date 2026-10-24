# CASEPULSE

**SIH 2026 Problem Statement 26264**

*Intelligent Institution Complaint Monitoring Platform with Explainable Cross-Bureau Case Correlation*

---

## 🏛️ Executive Objective

Higher educational institutions in India operate under overlapping administrative jurisdictions (AICTE, UGC, State DTEs, Anti-Ragging Cell, Consumer Disputes Redressal Commissions). In the status quo, predatory practices (such as capitation fee extortion, withholding degree certificates, ghost faculty, and unauthorized intake expansions) are filed across disparate bureaus in administrative silos.

**CASEPULSE** is a prototype regulatory intelligence platform that enables authorized officials to:
1. Identify correlated complaints across different administrative bureaus.
2. Understand explainable case relationships grounded in deterministic identifiers (AISHE code, AICTE Permanent ID, geographic proximity, and predatory pattern co-occurrence).
3. Coordinate joint hearings, unified show-cause notices, and administrative interventions.

---

## 📐 Architecture & Key Design Decisions

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS with a restrained dark-navy regulatory intelligence aesthetic
- **Data Layer**: PostgreSQL-backed Next.js Route Handlers with server-only repositories; API reads fail visibly when PostgreSQL is unavailable
- **Backend Setup**: See [`docs/BACKEND_SETUP.md`](docs/BACKEND_SETUP.md) for database configuration, migrations, synthetic seeding, and verification
- **Correlation Engine**: Explainable deterministic multi-attribute correlation engine (`src/lib/correlation-engine.ts`) with clear distinction between `CONFIRMED_ID` matches and potential entity/pattern matches

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (tested on v24.16.0)
- npm 10+ (tested on 12.0.2)

### Installation
```bash
npm install
```

### Running Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Verification
```bash
npm run lint    # Static analysis & ESLint rules
npm run build   # Production compile & static page generation (31 prerendered routes)
npm start       # Start production server on port 3000
```

---

## 🧭 Implemented Views

| Route | Purpose | Key Capabilities |
|---|---|---|
| `/` | **Overview Dashboard** | Real-time operational metrics, overdue investigation alerts, priority cross-bureau overlaps, quick jump to dockets. |
| `/overlaps` | **Cross-Bureau Overlap Review** | Dedicated workbench to triage flagged case pairs with confidence scores, multi-point evidence inspection, and triage actions (*Confirm Correlation*, *Initiate Joint Inquiry*, *Mark False Positive*). |
| `/cases` | **Complaint & Case Register** | Filterable case docket by Bureau, Status, Category, Overdue SLA toggle, and Cross-bureau overlap flag. |
| `/cases/[id]` | **Case Detail Docket** | Full allegation particulars, chronological action history timeline, assigned officer dossier, inter-bureau coordination links, and interactive action logging. |
| `/institutions` | **Institution Directory** | Directory of regulated entities with AISHE codes, active case count, risk ratings, and multi-bureau involvement tags. |
| `/institutions/[id]` | **Institution Detail** | Comprehensive institutional profile with all linked cases and active overlaps across bureaus. |
| `/analytics` | **Intelligence & Reports** | Inter-bureau correlation channels matrix, predatory category distribution, SLA compliance breakdown, and PostgreSQL DDL schema export. |

---

## 🔍 Correlation Engine Methodology

The deterministic detector flags cross-bureau case pairs using the initial policy in `src/lib/correlation-engine.ts`:
1. **Confirmed ID Match**:
   - Exact All-India Survey on Higher Education (AISHE) Code match across differing bureaus (+70 pts).
   - Exact AICTE Permanent Portal ID match (+65 pts).
2. **High-Probability Name & Location Match**:
   - Token Jaccard similarity >= 0.75 after normalization and stop-word removal (+40 pts; exact normalized names remain candidates).
   - Shared administrative District and State jurisdiction (+15 pts).
3. **Behavioral Pattern & Temporal Synergy**:
   - Known predatory co-occurrence (e.g., *Capitation Fee* + *Withholding Documents*) (+8-10 pts).
   - Filing dates no more than 60 elapsed days apart (+5 pts).
4. **Actionable Rationale**:
   - Every match surfaces an explicit reason list, side-by-side evidence comparison, and tailored administrative next step.

These are initial operational defaults, not empirically optimal thresholds; labeled evaluation data is needed to measure precision and recall. A name candidate uses the same inclusive 0.75 threshold in generation and evidence display. Temporal evidence and its score use the same inclusive 60-day elapsed-time window. A score of 75 or higher changes the suggested verification action only; it does not change relationship classification. Matching the same institution is an entity-level finding; it does not establish that complaints concern the same incident or are duplicates. Pattern similarity can indicate potentially related incidents. A potential duplicate complaint requires separate review and is never inferred solely from a shared institution identifier.

---

## ⚠️ Synthetic Benchmark Data Notice

All data displayed in this prototype is **clearly marked synthetic demonstration data** designed for SIH 2026 Problem Statement 26264 evaluation. No real personal privacy records or confidential regulatory filings are exposed. Real-time external AICTE/UGC API connections and black-box semantic models are deliberately omitted in this foundational phase to guarantee auditability and operational integrity.
