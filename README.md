<div align="center">

# 🌐 GeoLens — Conversational Earth Intelligence & EO Analytics

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-green.svg)](https://flask.palletsprojects.org/)
[![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-GEE-4285F4.svg)](https://earthengine.google.com/)
[![Groq AI](https://img.shields.io/badge/Groq-Llama3_70B-orange.svg)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

</div>

**GeoLens (SolveNest)** is an end-to-end Earth Observation (EO) and Machine Learning intelligence platform for automated land-cover monitoring, multi-spectral change detection (Sentinel-2 & Sentinel-1 SAR), and conversational AI spatial reasoning across 12 Indian urban & rural regions.

---

## ⚡ Quick Start

### Prerequisites
- **Python 3.10+** (Python 3.14 recommended)
- **Node.js 18+** & **npm**

### 1. Start Backend API (Flask)
```bash
# 1. Install dependencies
py -m pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env

# 3. Train model bundle & launch server
py scripts/train_final_model.py
py backend/app.py
```
*Backend API service runs on `http://localhost:5000`.*

### 2. Start Frontend Web Dashboard (Next.js)
```bash
cd frontend
npm install
npm run dev
```
*Frontend UI dashboard runs on `http://localhost:3000`.*

---

## 📚 Documentation Library

For complete specifications, setup guides, and architectural details, refer to the **[`docs/`](docs/)** directory:

| Document | Description |
| :--- | :--- |
| 🚀 **[`docs/SETUP.md`](docs/SETUP.md)** | Step-by-step local installation, prerequisites, and `.env` configuration. |
| 🏗️ **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** | High-level system architecture, Next.js frontend, Flask gateway, ML & GPT-OSS layers. |
| 📡 **[`docs/API_DOCS.md`](docs/API_DOCS.md)** | Complete REST API specification table for all 27 backend endpoints. |
| 🔄 **[`docs/WORKFLOW.md`](docs/WORKFLOW.md)** | Multi-spectral feature extraction, 24 derived indices, and shapefile analysis workflow. |
| 🔬 **[`docs/IMPLEMENTATION_REPORT.md`](docs/IMPLEMENTATION_REPORT.md)** | Scientific report, Leave-One-Region-Out (LORO) spatial validation & model metrics. |
| 🧪 **[`tests/fixtures/README.md`](tests/fixtures/README.md)** | Guide to testing Shapefile (`wards_mumbai.shp.zip`) & GeoTIFF band sample assets. |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
