import os
import zipfile
import tempfile
import numpy as np
import rasterio
from rasterio.transform import from_origin
import geopandas as gpd
from shapely.geometry import Polygon

# Ensure sample_data directory exists
SAMPLE_DIR = "sample_data"
os.makedirs(SAMPLE_DIR, exist_ok=True)

print("1. Creating sample Shapefile ZIP: sample_data/wards_mumbai.shp.zip...")
# Create sample ward polygon around Mumbai (72.82E-72.90E, 18.95N-19.08N)
poly1 = Polygon([
    (72.825, 18.950),
    (72.875, 18.950),
    (72.875, 19.020),
    (72.825, 19.020),
    (72.825, 18.950)
])

poly2 = Polygon([
    (72.850, 19.000),
    (72.900, 19.000),
    (72.900, 19.080),
    (72.850, 19.080),
    (72.850, 19.000)
])

gdf = gpd.GeoDataFrame({
    "ward_id": [1, 2],
    "ward_name": ["Mumbai South Ward", "Mumbai Central Ward"],
    "geometry": [poly1, poly2]
}, crs="EPSG:4326")

with tempfile.TemporaryDirectory() as tmpdir:
    shp_base = os.path.join(tmpdir, "wards_mumbai")
    gdf.to_file(f"{shp_base}.shp")
    
    zip_path = os.path.join(SAMPLE_DIR, "wards_mumbai.shp.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for ext in ['.shp', '.shx', '.dbf', '.prj']:
            fn = f"wards_mumbai{ext}"
            fp = os.path.join(tmpdir, fn)
            if os.path.exists(fp):
                zipf.write(fp, arcname=fn)

print(f"Created shapefile zip: {zip_path}")


print("\n2. Creating sample Sentinel-2 GeoTIFF band files...")
# Generate 256x256 sample GeoTIFF raster bands for Sentinel-2
# Bands: B02 (Blue), B03 (Green), B04 (Red), B08 (NIR), B11 (SWIR1)
height, width = 256, 256
transform = from_origin(72.82, 19.08, 0.0001, 0.0001)  # ~10m pixel resolution

np.random.seed(42)

band_configs = {
    "sentinel2_B02_Blue.tif": {"base": 500, "noise": 100, "description": "B02 Blue (490nm)"},
    "sentinel2_B03_Green.tif": {"base": 800, "noise": 150, "description": "B03 Green (560nm)"},
    "sentinel2_B04_Red.tif": {"base": 700, "noise": 200, "description": "B04 Red (665nm)"},
    "sentinel2_B08_NIR.tif": {"base": 2500, "noise": 400, "description": "B08 NIR (842nm)"},
    "sentinel2_B11_SWIR1.tif": {"base": 1800, "noise": 300, "description": "B11 SWIR1 (1610nm)"}
}

for fname, cfg in band_configs.items():
    fpath = os.path.join(SAMPLE_DIR, fname)
    # Generate uint16 reflectance values scaled by 10000
    data = (cfg["base"] + np.random.randn(height, width) * cfg["noise"]).astype(np.uint16)
    data = np.clip(data, 0, 10000)
    
    with rasterio.open(
        fpath,
        'w',
        driver='GTiff',
        height=height,
        width=width,
        count=1,
        dtype=data.dtype,
        crs='EPSG:4326',
        transform=transform
    ) as dst:
        dst.write(data, 1)
        dst.set_band_description(1, cfg["description"])

print("Created 5 sample GeoTIFF bands in sample_data/")


print("\n3. Creating sample_data/README.md...")
readme_content = """# Sample Data Assets for GeoLens / SolveNest

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
"""

with open(os.path.join(SAMPLE_DIR, "README.md"), "w", encoding="utf-8") as f:
    f.write(readme_content)

print("sample_data/README.md created successfully!")
