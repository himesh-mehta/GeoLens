# 🛰️ SIH Multimodal Earth Observation (EO) AI Intelligence Engine
### 2018 &rarr; 2024 Land-Cover Classification, Change Detection & Multimodal Vision Reasoning

![Architecture](https://img.shields.io/badge/Architecture-React%20%2B%20Node.js%20%2B%20Python%20EO--ML-blue)
![Model](https://img.shields.io/badge/ML%20Model-Random%20Forest%20(Balanced)-green)
![Dataset](https://img.shields.io/badge/Dataset-Sentinel--2%20%2F%20ISRO%20Bhuvan%20Ready-orange)
![Accuracy](https://img.shields.io/badge/Test%20Accuracy-67.54%25-brightgreen)
![Macro F1](https://img.shields.io/badge/Macro%20F1-0.5903-blueviolet)

---

## 📌 1. Architecture Overview

The system is organized into a production 3-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    React.js Frontend                        │
│                 (Main User Interface)                       │
└──────────────────────────────┬──────────────────────────────┘
                               │  HTTP / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js / Express Backend                   │
│                    (API Gateway / Auth)                     │
└──────────────────────────────┬──────────────────────────────┘
                               │  HTTP / REST (Port 5000)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             Python EO/ML Intelligence Service               │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │  Layer 1: EO/ML Layer │       │Layer 2: Vision Layer  │  │
│  │  Random Forest Model  │       │EO Satellite Vision CV │  │
│  │  24 Spectral Indices  │       │Canopy, Texture, Water │  │
│  └───────────────────────┘       └───────────────────────┘  │
│              ▲                               ▲              │
│              └───────────────┬───────────────┘              │
│                              │                              │
│               ┌──────────────────────────────┐              │
│               │ Layer 3: GPT-OSS Layer       │              │
│               │ Multimodal Reasoning Engine  │              │
│               └──────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 2. Performance Metrics vs. Baseline

Evaluated on unseen held-out locations across all 12 Indian geographic regions:

| Metric | User Baseline | New Multimodal Pipeline | Absolute Improvement | Relative Improvement |
| :--- | :---: | :---: | :---: | :---: |
| **2018 Test Accuracy** | `59.70%` | **`66.67%`** | **+6.97%** | **+11.67%** |
| **2024 Test Accuracy** | `63.10%` | **`68.42%`** | **+5.32%** | **+8.43%** |
| **Combined Accuracy** | `61.40%` | **`67.54%`** | **+6.14%** | **+10.00%** |
| **Combined Macro F1** | `0.5298` | **`0.5903`** | **+0.0605** | **+11.42%** |
| **Combined Weighted F1**| — | **`0.6757`** | — | — |

---

## 🗂️ 3. Directory Structure

```
SIH_ML/
├── SIH_OUTPUT/                         # Preserved ML deliverables & trained model bundle
│   ├── SIH_LandCover_RandomForest.pkl  # Trained Random Forest model
│   ├── predictions_2018_2024.csv       # Point-level predictions & change labels
│   ├── change_matrix_5x5.csv           # 5x5 land cover transition matrix
│   ├── change_statistics.csv           # Change category breakdown counts and %
│   ├── baseline_comparison.csv         # Side-by-side comparison with baseline
│   └── feature_importance.csv          # Top spectral feature rankings
│
├── data_sources/                       # Pluggable EO Data Ingestion (Sentinel & ISRO)
│   ├── base_source.py                  # BaseEODataSource abstract interface
│   ├── sentinel_source.py              # Sentinel-2 data source implementation
│   └── isro_source.py                  # ISRO Bhuvan / Resourcesat / Cartosat adapter
│
├── ml_layer/                           # Layer 1: EO / ML Layer
│   └── model_service.py                # Model loader, point querying, custom inference
│
├── vision_layer/                       # Layer 2: EO Vision Layer
│   ├── image_generator.py              # True Color, False Color FCC & NDVI synthesis
│   ├── visual_extractor.py             # Computer vision canopy & texture extractor
│   └── vision_evaluator.py             # Vision vs ML cross-verification engine
│
├── gpt_oss_layer/                      # Layer 3: GPT-OSS Reasoning Layer
│   ├── prompt_templates.py             # Multimodal prompt assembler
│   └── reasoning_engine.py             # Geospatial natural language reasoning engine
│
├── app.py                              # Headless Python REST API service (Port 5000)
├── API_DOCS.md                         # Detailed REST API endpoints & JSON examples
├── sih_pipeline.py                     # Standalone ML training & evaluation script
├── SIH_2018_2024_model.py              # Baseline script (preserved)
└── SIH_SamePoints_2018_2024_Light.csv  # 6,000 multi-temporal point dataset
```

---

## 🚀 4. Running React, Node.js, and Python Together

### 1. Start Python EO/ML Intelligence Service (Terminal 1)
```bash
python app.py
# Runs on http://localhost:5000
```

### 2. Start Node.js / Express Backend (Terminal 2)
In your friend's Node.js project:
```bash
export PYTHON_API_URL="http://localhost:5000"
npm start
# Runs on http://localhost:8000
```

### 3. Start React.js Frontend (Terminal 3)
In your friend's React project:
```bash
npm start
# Runs on http://localhost:3000
```

---

## 📡 5. REST API Endpoints Quick Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/regions` | `GET` | Array of 12 Indian regions |
| `/api/regions/:region` | `GET` | Regional metadata and sample summary |
| `/api/landcover/:region` | `GET` | 2018 & 2024 land-cover predictions, coordinates, and confidence |
| `/api/change/:region` | `GET` | 2018 &rarr; 2024 change points & 5x5 transition matrix |
| `/api/statistics/:region` | `GET` | 2018 vs 2024 class distributions and change percentages |
| `/api/feature-importance` | `GET` | 24 spectral feature rankings |
| `/api/predict` | `POST` | Custom spectral bands real-time inference |
| `/api/analyze-image` | `POST` | EO Vision canopy/urban extraction & ML agreement |
| `/api/ask` | `POST` | GPT-OSS multimodal natural language Q&A reasoning |

For complete request/response JSON schemas, refer to [API_DOCS.md](file:///c:/Users/Dnyan%20Parekh/OneDrive/Desktop/SIH_ML/API_DOCS.md).
