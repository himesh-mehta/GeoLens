# 🏗️ System Architecture — GeoLens / SolveNest

This document outlines the high-level architecture, module breakdown, and data interaction flow for the **GeoLens (SolveNest)** Earth Intelligence platform.

---

## 📐 Platform Architecture Overview

```
+-----------------------------------------------------------------------+
|                         React / Next.js 14 UI                         |
|   (App Router, Tailwind CSS, Leaflet/Recharts, Multi-lingual i18n)    |
+-----------------------------------------------------------------------+
                                   |
                         HTTP / REST API Requests
                                   v
+-----------------------------------------------------------------------+
|                    Flask Python Service Gateway                       |
|                          (backend/app.py)                             |
+-----------------------------------------------------------------------+
       |                           |                           |
       v                           v                           v
+------------------+    +--------------------+    +---------------------+
|    ML Layer      |    |   GPT-OSS Layer    |    |   EO Vision Layer   |
| (model_service)  |    | (reasoning_engine) |    |  (visual_extractor) |
+------------------+    +--------------------+    +---------------------+
       |                           |                           |
       v                           v                           v
+------------------+    +--------------------+    +---------------------+
|   Data Layer     |    |   Groq LLM API     |    |  Rasterio / GDAL    |
| (data/results)   |    |  (Llama-3 70B)     |    |  Metadata Engine    |
+------------------+    +--------------------+    +---------------------+
       |
       v
+-----------------------------------------------------------------------+
|                Google Earth Engine Live Integration                   |
|          (COPERNICUS/S2_SR_HARMONIZED & COPERNICUS/S1_GRD)            |
+-----------------------------------------------------------------------+
```

---

## 🧩 Module Responsibilities

### 1. Frontend Web Dashboard (`/frontend`)
- **Framework:** Next.js 14 (App Router) with TypeScript & Tailwind CSS.
- **Components:** Interactive Leaflet maps (`DynamicMap`), Recharts land-cover distribution charts, shapefile dropzone, GeoTIFF inspector, and AI chat modal.
- **Client API:** `lib/api-client.ts` proxies requests to `http://localhost:5000`.

### 2. Backend Gateway (`/backend/app.py`)
- **Framework:** Flask API service running on port `5000`.
- **CORS Handling:** Enabled for cross-origin access from Next.js (`localhost:3000`).
- **Service Hub:** Initializes `ModelService`, `ShapefileService`, `EOVisionExtractor`, `EOVisionEvaluator`, and `GPTOssReasoningEngine`.

### 3. Machine Learning Intelligence Layer (`/backend/ml_layer`)
- **`model_service.py`:** Loads the ExtraTrees Multi-Source model bundle (`data/results/SIH_LandCover_ExtraTrees_MultiSource.pkl`), computes live per-region statistics from ground-truth predictions (`data/results/predictions_2018_2024.csv`), generates 5x5 transition matrices, and formats GeoJSON outputs.
- **`shapefile_service.py`:** Extracts zipped ESRI Shapefile boundaries (`.shp`, `.shx`, `.dbf`, `.prj`), validates EPSG coordinates, and runs GEE zonal composites.

### 4. GPT-OSS AI Reasoning Engine (`/backend/gpt_oss_layer`)
- **`ai_service.py`:** Interacts with Groq LLM API (`llama3-70b-8192`) using `.env` credentials.
- **`reasoning_engine.py`:** Epistemic reasoning engine that synthesizes ML predictions, regional stats, and satellite evidence without hallucination.

### 5. Vision & Band Inspector (`/backend/vision_layer`)
- **`visual_extractor.py`:** Reads GeoTIFF files using `rasterio`, inspects embedded spatial metadata, and identifies spectral bands (B02, B03, B04, B08, B11).
- **`image_generator.py`:** Renders multi-spectral patch thumbnails (RGB, FCC, NDVI) from point reflectances.

### 6. Data Sources Layer (`/backend/data_sources`)
- **`gee_source.py`:** Connects directly to Google Earth Engine Python API (`ee.Initialize()`) to pull live Sentinel-2 optical and Sentinel-1 SAR radar imagery.
- **`sentinel_source.py`:** Dataset reader for ground-truth sample points.
