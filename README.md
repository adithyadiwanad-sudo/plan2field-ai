
<div align="center">

# 🏗️ Plan2Field AI
### Intelligent Data Capture & Schedule-Linking Layer for Real-Time Infrastructure Progress Tracking

[![PS ID SIH26122](https://img.shields.io/badge/PS_ID-SIH26122-blue?style=for-the-badge)](https://plan2field-ai.vercel.app)

[![Nodal Org Oil India](https://img.shields.io/badge/Nodal_Org-Oil_India_Limited-008080?style=for-the-badge)](https://plan2field-ai.vercel.app)
[![Live Demo](https://img.shields.io/badge/Live_Demo-plan2field--ai.vercel.app-success?style=for-the-badge&logo=vercel)](https://plan2field-ai.vercel.app)

<p align="center">
  <b>Bridging the gap between site execution and Primavera P6 enterprise schedules using voice AI, pgvector semantic search, and human-in-the-loop verification.</b>
</p>

[🌐 Live Prototype](https://plan2field-ai.vercel.app) • [📄 GitHub Repository](https://github.com/adithyadiwanad-sudo/plan2field-ai) • [⚡ Team Avyakthra](#-team--institution)

</div>

---

## 📌 Executive Summary & Problem Context

Infrastructure megaprojects lose millions due to **delayed progress tracking** and **schedule inflation**. Field engineers record daily activities using informal language, voice notes, or physical site logs, while planners manage rigid Work Breakdown Structure (WBS) baselines in **Oracle Primavera P6** or **Microsoft Project**. Manual reconciliation takes days, causing schedule drift and uncoordinated field execution.

**Plan2Field AI** serves as an intelligent data capture and schedule-linking layer that ingests unstructured site updates (voice, text, photo notes), normalizes site jargon into formal WBS activity codes via 1536-dimensional semantic vector matching (`pgvector`), and stages validated updates into Primavera P6 without baseline corruption.


```

```
   [ Unstructured Site Log ] 
(Voice / Text / Jargon / GPS)
             │
             ▼
 [ OpenAI Whisper STT Engine ]
             │
             ▼

```

[ 1536-dim pgvector Cosine Search ]
(Maps site jargon ➔ WBS Codes)
│
▼
[ 2-Tier Verification Gate ]
├── ≥ 80% Conf ──► Staged for P6 Sync
└── < 80% Conf ──► Planner Review Queue
│
▼
[ Oracle Primavera P6 (.CSV/.XER) ]

```

---

## 🚀 Key Technical Innovations

* **🛡️ Zero Baseline Corruption**: Read-only baseline protection ensures no AI update directly overwrites master project schedules. All updates pass through a staged `.CSV` / `.XER` delta pipeline.
* **⚡ 2-Tier Human-in-the-Loop Gate**:
  * **Auto-Staged Queue ($\ge 80\%$ Confidence)**: Fast-tracks high-confidence matches into the Primavera P6 outbox.
  * **Planner Review Queue ($< 80\%$ Confidence)**: Routes low-confidence or ambiguous updates for one-click manual validation.
* **🔄 Micro-to-Macro Granularity Aggregation**: Maps individual micro-level field events (e.g., single spool erections or cable laying) to macro-level schedule tasks using pre-approved weighting metrics.
* **⚠️ Unplanned Activity Detection**: Captures emergency or non-standard tasks on site, logging them into an "Unplanned Queue" rather than dropping site data.
* **📚 Academic Grounding**: Architectural design grounded in 2026 neuro-symbolic AI research from **IIT Bombay** (*Nanduri & Delhi, 2026*) for schedule enrichment.

---

## 📊 Feature Comparison Matrix

| Capability / Feature | Manual Site Reporting | Legacy ERP Systems | Plan2Field AI |
| :--- | :---: | :---: | :---: |
| **Site Data Ingestion** | Paper / WhatsApp | Manual Form Entry | Voice (Whisper) & Text AI |
| **Jargon-to-WBS Mapping** | Manual Search (Slow) | Exact Key-Match Only | 1536-dim `pgvector` Cosine Search |
| **Reconciliation Speed** | 3 - 7 Days | 1 - 2 Days | **Real-Time (< 10 seconds)** |
| **Baseline Safety** | High Error Risk | Manual Overwrites | **100% Protected (Read-Only Gate)** |
| **Unplanned Task Capture** | Lost in Notes | Rejected | **Logged to Unplanned Queue** |
| **Schedule Memory** | None | Static Historical | **LLaMA RAG Assistant Engine** |

---

## 🛠️ Tech Stack & Architecture

```text
├── Frontend              : Single-Page React (Vite, Tailwind CSS v4, Lucide Icons)
├── Backend Services     : Express.js (Node.js / TypeScript) & Python Engine
├── Vector Engine        : Neon Cloud PostgreSQL + pgvector (1536-dimensional embeddings)
├── Speech Processing     : OpenAI Whisper Speech-to-Text (STT) for noisy audio
├── RAG Memory Engine     : LLaMA RAG querying Primavera baselines & inspection logs
└── Enterprise Target    : Oracle Primavera P6 (.CSV / .XER) & Microsoft Project

```

---

## ⚡ Quickstart & Local Setup

### Prerequisites

* Node.js v18+
* Python 3.10+
* Neon PostgreSQL database with `pgvector` extension enabled

### 1. Clone Repository & Install Frontend

```bash
git clone [https://github.com/adithyadiwanad-sudo/plan2field-ai.git](https://github.com/adithyadiwanad-sudo/plan2field-ai.git)
cd plan2field-ai
npm install

```

### 2. Configure Environment Variables (`.env`)

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:5000
DATABASE_URL=postgresql://user:password@neon-db-host/plan2field?sslmode=require
OPENAI_API_KEY=your_openai_whisper_key

```

### 3. Run Development Server

```bash
npm run dev

```

Open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

---

## 🧪 Verification & Judge Testing Scenarios

| Scenario | Input Site Log | Matched WBS Code | Confidence | System Action |
| --- | --- | --- | --- | --- |
| **1. Standard Match** | *"Completed welding for 50m pipeline segment at Sector 4"* | `WBS-PIP-WELD-04` | **94%** | Staged in Primavera Delta Queue |
| **2. Ambiguous Input** | *"Shifted some pipes near site office"* | `WBS-MAT-HAND-01` | **68%** | Routed to Planner Review Queue |
| **3. Emergency Task** | *"Repaired unmapped water leak on main access road"* | `UNPLANNED-EMG` | **N/A** | Captured in Unplanned Activity Queue |

---

## 👥 Team & Institution

* **Team Name**: Avyakthra (Team ID: 171927)
* **Hackathon**: Smart India Hackathon (SIH) 2026 
* **Problem Statement ID**: SIH26122 (Oil India Limited)

---

**Developed by Team Avyakthra for Smart India Hackathon 2026**

[🌐 Live Demo](https://plan2field-ai.vercel.app) • [🐙 GitHub Repository](https://github.com/adithyadiwanad-sudo/plan2field-ai)

