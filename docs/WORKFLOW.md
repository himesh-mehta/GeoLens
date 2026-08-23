# 🔄 Data Flow & Pipeline Workflow — GeoLens / SolveNest

This document details the multi-spectral feature extraction pipeline, machine learning validation methodology, shapefile analysis workflow, and real-time query execution in **GeoLens (SolveNest)**.

---

## 📊 1. Multi-Spectral & SAR Feature Extraction Pipeline

Every spatial sample point processed by the platform extracts **24 spectral features**:

| Category | Feature Names | Description |
| :--- | :--- | :--- |
| **Optical Reflectance** | `B2`, `B3`, `B4`, `B8`, `B11`, `B12` | Sentinel-2 MSI Reflectances (Blue, Green, Red, NIR, SWIR1, SWIR2) |
| **Spectral Indices** | `NDVI`, `NDWI`, `MNDWI`, `NDBI`, `BSI`, `SAVI`, `NBR`, `EVI`, `UI`, `NDMI`, `GRVI` | Vegetation, Water, Built-up, Bare Soil & Moisture Indices |
| **Ratios & Composites** | `Brightness`, `Greenness`, `SWIR_Ratio`, `NIR_Red_Ratio`, `NIR_Green_Ratio` | Soil & Canopy structural ratios |
| **Differences** | `NDBI_NDVI_diff`, `MNDWI_NDVI_diff` | Built-up vs Vegetation & Water vs Vegetation contrast |
| **SAR Radar** | `VV`, `VH` | Copernicus Sentinel-1 Synthetic Aperture Radar backscatter |

---

## 🌲 2. Machine Learning Pipeline & Spatial LORO Validation

To prevent **spatial data leakage** across adjacent geographic coordinates, the model training pipeline (`scripts/train_final_model.py`) uses **Leave-One-Region-Out (LORO)** spatial cross-validation:

1. **Training Split:** 9 regions (`Pune`, `Mumbai`, `Jaipur`, `Hyderabad`, `Bengaluru`, `Kolkata`, `Chennai`, `Kochi`, `Guwahati`).
2. **Held-Out Test Split:** 3 unseen geographic regions (`Nashik`, `Nagpur`, `Ahmedabad`).
3. **Class Balancing:** `RandomOverSampler` balances training classes across the 5 land-cover targets:
   - `0`: Water
   - `1`: Vegetation
   - `2`: Agriculture
   - `3`: Built-up
   - `4`: Barren
4. **Model Export:** Trained model bundle is saved to `data/results/SIH_LandCover_ExtraTrees_MultiSource.pkl`.

---

## 🗺️ 3. Custom Shapefile Zonal Analysis Workflow

```
[User Uploads .shp.zip]
          │
          ▼
[1. Extract ZIP to Temp] ──> Check for .shp, .shx, .dbf, .prj
          │
          ▼
[2. GeoPandas CRS Check] ──> Validate Geometry & Transform to EPSG:4326
          │
          ▼
[3. GEE Polygon Query]   ──> Filter Sentinel-2 HARMONIZED & Sentinel-1 GRD
          │                  Apply Cloud Mask (QA60 < 20%)
          ▼
[4. Period Composites]   ──> Create Median Composite for Period 1 & Period 2
          │                  Add 24 Derived Features
          ▼
[5. ML Inference Engine] ──> Predict 5 Land Cover Classes per Pixel
          │
          ▼
[6. Transition Matrix]   ──> Generate 5x5 Zonal Matrix & % Area Changes
```

---

## 🛰️ 4. GeoTIFF Image Analysis Workflow

```
[User Uploads .tif Files]
          │
          ▼
[1. Rasterio MemoryFile] ──> Read Embedded Metadata & CRS
          │
          ▼
[2. Band Identification] ──> Match Wavelength & Description Tags:
                             • B02: Blue (490nm)
                             • B03: Green (560nm)
                             • B04: Red (665nm)
                             • B08: NIR (842nm)
                             • B11: SWIR1 (1610nm)
          │
          ▼
[3. Spectral Computing]  ──> Compute NDVI = (B08 - B04) / (B08 + B04)
                             Compute NDWI = (B03 - B08) / (B03 + B08)
          │
          ▼
[4. Render & Return]     ──> Output JSON payload with Band Tags & Metrics
```
