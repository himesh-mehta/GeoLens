# Sample Data Assets for GeoLens / SolveNest

This directory contains sample GIS and Earth Observation datasets that visitors or reviewers can use to test all application features.

## Contents

### 1. Shapefile Analysis Sample
* **File:** `wards_mumbai.shp.zip`
* **Contains:** Valid ESRI Shapefile package (`.shp`, `.shx`, `.dbf`, `.prj`) for Mumbai ward boundaries in `EPSG:4326`.
* **Usage:** Upload this ZIP file on the **Shapefile Analysis** page (`/shapefile/analysis`) to run satellite-derived environmental change analysis.

### 2. Multi-Spectral Image Analysis Sample
* **Files:**
  * `sentinel2_B02_Blue.tif` (Band 2 - Blue)
  * `sentinel2_B03_Green.tif` (Band 3 - Green)
  * `sentinel2_B04_Red.tif` (Band 4 - Red)
  * `sentinel2_B08_NIR.tif` (Band 8 - Near Infrared)
  * `sentinel2_B11_SWIR1.tif` (Band 11 - Short-wave Infrared 1)
* **Format:** GeoTIFF single-band rasters with `EPSG:4326` spatial metadata.
* **Usage:** Upload one or more `.tif` files on the **Image Analysis** page (`/image-analysis`) to test automated band identification, spectral index calculation (NDVI, NDWI, MNDWI), and feature extraction.
