# 🛰️ SIH Python EO/ML Intelligence Service — REST API Documentation (v2.1)

### Architecture
```
React.js Frontend  ──(HTTP / JSON)──►  Node.js / Express Gateway  ──(HTTP / REST)──►  Python EO/ML Service (Port 5000)
```

---

## ⚙️ Environment Variables

| Variable | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | integer | `5000` | Port where the Python API service listens |
| `FLASK_ENV` | string | `production` | `development` or `production` |
| `CORS_ORIGIN` | string | `*` | Allowed CORS origins for Express/React |

---

## 📡 Complete REST API Endpoints

### 1. Model Comparison & Benchmarks
- **`GET /api/models/comparison`**
  - **Description:** Returns side-by-side performance benchmarks for **Baseline Random Forest**, **Improved Random Forest (Tuned)**, **ExtraTrees Classifier (Best Macro F1)**, and **Gradient Boosting (HistGB)**.
  - **Response Example:**
```json
{
  "status": "success",
  "comparison": {
    "baseline_model": "Baseline Random Forest",
    "best_model": "ExtraTrees Classifier (Best Macro F1)",
    "benchmark_table": [
      {
        "Model": "ExtraTrees Classifier (Best Macro F1)",
        "Accuracy": 0.6733,
        "Macro_F1": 0.6209,
        "Weighted_F1": 0.6774,
        "Water_F1": 0.9349,
        "Vegetation_F1": 0.6406,
        "Agriculture_F1": 0.5390,
        "BuiltUp_F1": 0.7199,
        "Barren_F1": 0.2703
      },
      {
        "Model": "Baseline Random Forest",
        "Accuracy": 0.6792,
        "Macro_F1": 0.5929,
        "Weighted_F1": 0.6794,
        "Water_F1": 0.9333,
        "Vegetation_F1": 0.6489,
        "Agriculture_F1": 0.5294,
        "BuiltUp_F1": 0.7318,
        "Barren_F1": 0.1212
      }
    ]
  }
}
```

---

### 2. Region Discovery & Metadata
- **`GET /api/regions`**
  - **Description:** Returns list of all 12 supported Indian cities (`Ahmedabad`, `Bengaluru`, `Chennai`, `Guwahati`, `Hyderabad`, `Jaipur`, `Kochi`, `Kolkata`, `Mumbai`, `Nagpur`, `Nashik`, `Pune`).

- **`GET /api/regions/:region`**
  - **Description:** Returns sample count, estimated area ($km^2$), and overview metrics for the specified region.

---

### 3. Land-Cover Data (Strict Attribute Separation)
- **`GET /api/landcover/:region`**
  - **Description:** Returns 2018 & 2024 point predictions with explicit distinction between **predicted class**, **model confidence score (0.0 to 1.0)**, and **uncertainty flag**.
  - **Response Example:**
```json
{
  "status": "success",
  "region": "Jaipur",
  "total_points": 500,
  "landcover": [
    {
      "point_id": 2500,
      "region": "Jaipur",
      "latitude": 27.009421,
      "longitude": 75.902746,
      "predicted_class_2018": {
        "class_id": 2,
        "class_name": "Agriculture",
        "model_confidence": 0.5528,
        "color": "#8bc34a"
      },
      "predicted_class_2024": {
        "class_id": 2,
        "class_name": "Agriculture",
        "model_confidence": 0.4976,
        "color": "#8bc34a"
      },
      "change_type": "No Change",
      "is_uncertain": true
    }
  ]
}
```

---

### 4. Change Detection & $5 \times 5$ Transition Matrix
- **`GET /api/change/:region`**
  - **Description:** Returns $5 \times 5$ land-cover transition matrix, sample counts, change percentages, and estimated area ($km^2$) for:
    - `No Change`
    - `Urban Expansion`
    - `Vegetation Loss` / `Vegetation Gain`
    - `Agriculture Loss` / `Agriculture Gain`
    - `Water Loss` / `Water Gain`
  - **Response Example:**
```json
{
  "status": "success",
  "region": "Jaipur",
  "change_statistics": {
    "No Change": { "sample_count": 385, "change_percentage": 77.0, "estimated_area_km2": 3.85 },
    "Urban Expansion": { "sample_count": 41, "change_percentage": 8.2, "estimated_area_km2": 0.41 },
    "Vegetation Gain": { "sample_count": 30, "change_percentage": 6.0, "estimated_area_km2": 0.30 },
    "Vegetation Loss": { "sample_count": 29, "change_percentage": 5.8, "estimated_area_km2": 0.29 }
  },
  "transition_matrix_5x5": {
    "classes": ["Water", "Vegetation", "Agriculture", "Built-up", "Barren"],
    "matrix": [
      [2, 0, 0, 0, 0],
      [0, 102, 12, 19, 1],
      [0, 21, 161, 21, 0],
      [2, 1, 7, 149, 1],
      [0, 0, 0, 1, 0]
    ]
  }
}
```

---

### 5. Statistics & Confidence Summaries
- **`GET /api/statistics/:region`**
  - **Description:** Returns class breakdown (counts, percentages, area in $km^2$) for both 2018 and 2024 along with model confidence averages and count of uncertain predictions ($< 0.55$).

---

### 6. Explainability & Domain Confusion Diagnostics
- **`GET /api/explainability/:region`**
  - **Description:** Returns ranked feature importances, low-confidence points, and domain diagnostics for:
    - **Barren vs. Built-up** (SWIR/NDBI overlap vs. Bare Soil Index)
    - **Agriculture vs. Vegetation** (Seasonal harvesting cycles vs. SAVI/delta features).

- **`GET /api/feature-importance`**
  - **Description:** Returns all 24 multi-spectral features sorted by importance score.

---

### 7. Natural Language Geospatial Query Engine
- **`POST /api/query-nl`**
  - **Description:** Parses natural language filtering and comparison queries.
  - **Request Body:**
```json
{
  "query": "Compare Mumbai and Pune"
}
```
  - **Response Example:**
```json
{
  "status": "success",
  "result": {
    "query_type": "comparison",
    "regions_compared": ["Mumbai", "Pune"],
    "summary": "Comparison between Mumbai and Pune: Mumbai experienced 4.2% urban expansion and 4.8% vegetation loss, while Pune experienced 7.8% urban expansion and 6.4% vegetation loss."
  }
}
```

---

### 8. EO Vision Feature Extraction & ML Verification
- **`POST /api/analyze-image`**
  - **Request Body:** `{"point_id": 2500}`
  - **Response:** Returns canopy density %, urban texture %, water index %, barren soil %, ML vs Vision agreement score (0-100%), and synthetic True Color, False Color (FCC), and NDVI image patches.

---

### 9. GPT-OSS Multimodal Reasoning Agent
- **`POST /api/ask`**
  - **Request Body:**
```json
{
  "question": "What changed in Pune from 2018 to 2024?",
  "region": "Pune"
}
```
  - **Response Example:** Explicitly tagged sections:
    - `[ML Results]`
    - `[EO Vision]`
    - `[GPT-OSS Reasoning]`

---

### 10. Human Review / Active Learning Feedback
- **`POST /api/feedback`**
  - **Request Body:**
```json
{
  "point_id": 2500,
  "verdict": "Correct",
  "notes": "Verified against Sentinel-2 FCC overlay"
}
```
  - **Response:** Logs entry to `SIH_OUTPUT/human_review_log.json`.

---

### 11. GeoJSON & Data Export Endpoints
- **`GET /api/geojson/:region`** &rarr; Standard GeoJSON FeatureCollection
- **`GET /api/export/:region/csv`** &rarr; CSV file download
- **`GET /api/export/:region/json`** &rarr; JSON export
- **`GET /api/export/:region/geojson`** &rarr; GeoJSON export
- **`GET /api/report/:region?format=html`** &rarr; Executive HTML report

---

## 📌 Implementation Status Breakdown

| Feature | Status | Details |
| :--- | :---: | :--- |
| **Random Forest Baseline** | **Implemented** | Accuracy: 67.92%, Macro F1: 0.5929 |
| **ExtraTrees Improved Model** | **Implemented** | Accuracy: 67.33%, Macro F1: 0.6209 (Barren F1: 0.2703) |
| **24 Spectral Features & Deltas** | **Implemented** | NDVI, NDWI, MNDWI, NDBI, BSI, SAVI, NBR, EVI, UI, NDMI, GRVI, Brightness, Greenness, SWIR ratios |
| **12 Indian Cities Analytics** | **Implemented** | 6,000 points across 12 cities |
| **5x5 Transition Matrices** | **Implemented** | Full transition breakdown with estimated $km^2$ |
| **Strict Attribute Distinction** | **Implemented** | Separate `predicted_class`, `model_confidence`, `regional_landcover_percentage` |
| **EO Vision Component** | **Implemented** | Algorithmic spectral-texture computer vision with RGB, FCC, NDVI synthesis |
| **Deep Vision Model Hook** | *Integration-Ready* | Flagged `is_deep_vision_model_connected: False` |
| **GPT-OSS Reasoning Layer** | **Implemented** | Offline semantic reasoning with explicit source tagging (`[ML Results]`, `[EO Vision]`, `[GPT-OSS Reasoning]`) |
| **Ollama / OSS LLM API Hook** | *Integration-Ready* | Structure in `gpt_oss_layer/` ready to plug into local Ollama port `11434` |
| **Explainability & Confusion** | **Implemented** | Barren vs Built-up & Agri vs Veg diagnostics + feature rankings |
| **Human Review Feedback** | **Implemented** | Persists feedback to `SIH_OUTPUT/human_review_log.json` |
| **Natural Language Search** | **Implemented** | Handles regional filters, comparisons, and rankings |
| **Executive Reports & Exports** | **Implemented** | HTML, CSV, JSON, GeoJSON endpoints |
