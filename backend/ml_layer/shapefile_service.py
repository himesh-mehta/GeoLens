import os
import zipfile
import tempfile
import uuid
import json
import logging
import threading
from typing import Dict, Any, List, Optional
import ee
try:
    import geopandas as gpd
except ImportError:
    gpd = None

logger = logging.getLogger(__name__)

class ShapefileService:
    def __init__(self, gee_source=None):
        self.gee_source = gee_source
        self.jobs: Dict[str, Dict[str, Any]] = {}
        
    def check_gee_availability(self):
        if self.gee_source:
            self.gee_source.check_availability()
            
    def _mask_s2_clouds(self, image):
        qa = image.select('QA60')
        cloudBitMask = 1 << 10
        cirrusBitMask = 1 << 11
        mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(qa.bitwiseAnd(cirrusBitMask).eq(0))
        return image.updateMask(mask).divide(10000)
        
    def _add_indices(self, image):
        # Add Sentinel-2 indices
        # NDVI = (B8 - B4) / (B8 + B4)
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # NDWI = (B3 - B8) / (B3 + B8)
        ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI')
        
        # MNDWI = (B3 - B11) / (B3 + B11)
        mndwi = image.normalizedDifference(['B3', 'B11']).rename('MNDWI')
        
        # NDBI = (B11 - B8) / (B11 + B8)
        ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI')
        
        # BSI = ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))
        bsi = image.expression(
            '((SWIR1 + Red) - (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))', {
                'SWIR1': image.select('B11'),
                'Red': image.select('B4'),
                'NIR': image.select('B8'),
                'Blue': image.select('B2')
        }).rename('BSI')
        
        # SAVI = ((B8 - B4) / (B8 + B4 + 0.5)) * (1.5)
        savi = image.expression(
            '((NIR - Red) / (NIR + Red + 0.5)) * 1.5', {
                'NIR': image.select('B8'),
                'Red': image.select('B4')
        }).rename('SAVI')
        
        return image.addBands([ndvi, ndwi, mndwi, ndbi, bsi, savi])
        
    def _get_period_composite(self, feature_collection, start_date, end_date, cloud_threshold):
        """Creates a median composite of Sentinel-2 for the given period and collection."""
        s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                         .filterBounds(feature_collection.geometry())
                         .filterDate(start_date, end_date)
                         .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
                         .map(self._mask_s2_clouds))
                         
        median_image = s2_collection.median()
        return self._add_indices(median_image)

    def _process_job(self, job_id: str, zip_path: str, period1_start: str, period1_end: str, period2_start: str, period2_end: str, cloud_threshold: int, tiff_path: str = None):
        try:
            self.jobs[job_id]["status"] = "Validating shapefile"
            
            with tempfile.TemporaryDirectory() as temp_dir:
                # 1. Extract ZIP
                try:
                    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                        zip_ref.extractall(temp_dir)
                except Exception as e:
                    raise Exception(f"Failed to extract ZIP: {str(e)}")
                    
                # 2. Validate components
                extracted_files = os.listdir(temp_dir)
                has_shp = any(f.endswith('.shp') for f in extracted_files)
                has_shx = any(f.endswith('.shx') for f in extracted_files)
                has_dbf = any(f.endswith('.dbf') for f in extracted_files)
                has_prj = any(f.endswith('.prj') for f in extracted_files)
                
                if not (has_shp and has_shx and has_dbf and has_prj):
                    raise Exception("Invalid shapefile package. Required files: .shp, .shx, .dbf and .prj.")
                    
                shp_file = next(f for f in extracted_files if f.endswith('.shp'))
                shp_path = os.path.join(temp_dir, shp_file)
                
                self.jobs[job_id]["status"] = "Validating shapefile geometry..."
                
                # 3. Read with GeoPandas
                try:
                    gdf = gpd.read_file(shp_path)
                except Exception as e:
                    raise Exception(f"Failed to parse shapefile with GeoPandas: {str(e)}")
                    
                if gdf.empty:
                    raise Exception("Shapefile is empty or contains no valid geometries.")
                
                original_count = len(gdf)
                source_crs = gdf.crs.to_string() if gdf.crs else "Missing"
                
                if not gdf.crs:
                    raise Exception("Shapefile is missing Coordinate Reference System (CRS) information.")
                
                # Reproject to EPSG:4326
                if gdf.crs.to_string() != "EPSG:4326":
                    gdf = gdf.to_crs("EPSG:4326")
                
                # Clean geometries
                from shapely.validation import make_valid
                
                repaired_count = 0
                removed_count = 0
                valid_count = 0
                geom_types = set()
                
                from shapely.geometry import Polygon, MultiPolygon
                from shapely import force_2d
                
                cleaned_geoms = []
                for idx, row in gdf.iterrows():
                    geom = row.geometry
                    if geom is None or geom.is_empty:
                        removed_count += 1
                        continue
                        
                    # Drop Z coordinates if present (3D -> 2D)
                    try:
                        geom = force_2d(geom)
                        # Simplify to reduce micro-artefacts and vertex limits
                        geom = geom.simplify(0.0001, preserve_topology=True)
                    except Exception:
                        pass
                        
                    if not geom.is_valid:
                        try:
                            geom = make_valid(geom)
                        except Exception:
                            geom = geom.buffer(0)
                        repaired_count += 1
                        
                    if geom is None or geom.is_empty or not geom.is_valid:
                        removed_count += 1
                        continue
                        
                    # Filter for Polygon / MultiPolygon
                    if geom.geom_type not in ['Polygon', 'MultiPolygon']:
                        # If a GeometryCollection was created by make_valid, extract polygons
                        if geom.geom_type == 'GeometryCollection':
                            polys = [g for g in geom.geoms if g.geom_type in ['Polygon', 'MultiPolygon']]
                            if not polys:
                                removed_count += 1
                                continue
                            if len(polys) == 1:
                                geom = polys[0]
                            else:
                                geom = MultiPolygon(polys)
                        else:
                            removed_count += 1
                            continue
                            
                    geom_types.add(geom.geom_type)
                    cleaned_geoms.append(geom)
                    valid_count += 1
                    gdf.at[idx, 'geometry'] = geom
                
                # Drop rows that were removed
                gdf = gdf[gdf.geometry.notnull() & ~gdf.geometry.is_empty & gdf.geometry.is_valid & gdf.geometry.geom_type.isin(['Polygon', 'MultiPolygon'])]
                
                if gdf.empty:
                    raise Exception("No valid polygon geometries remain after shapefile validation.")
                
                # Calculate approximate area in sq km if possible (roughly)
                gdf_proj = gdf.to_crs(epsg=3857) # Pseudo-Mercator for area calc
                total_area_sqm = gdf_proj.geometry.area.sum()
                total_area_sqkm = total_area_sqm / 1e6
                feature_count = len(gdf)
                
                bounds = gdf.total_bounds # [minx, miny, maxx, maxy]
                
                # Check for valid Longitude / Latitude ranges
                if bounds[0] < -180.5 or bounds[2] > 180.5 or bounds[1] < -90.5 or bounds[3] > 90.5:
                    raise Exception(
                        f"Geometries have coordinates outside valid Longitude/Latitude ranges after reprojection. "
                        f"Bounds: [minX: {bounds[0]:.2f}, minY: {bounds[1]:.2f}, maxX: {bounds[2]:.2f}, maxY: {bounds[3]:.2f}]. "
                        f"This usually means the original shapefile had an incorrect or missing CRS projection file (.prj)."
                    )
                
                bounding_box = [
                    [bounds[0], bounds[1]],
                    [bounds[2], bounds[1]],
                    [bounds[2], bounds[3]],
                    [bounds[0], bounds[3]],
                    [bounds[0], bounds[1]]
                ]
                
                # Convert to GeoJSON
                safe_geojson = json.loads(gdf.to_json())
                
                # Validate GeoJSON structure
                if safe_geojson.get("type") != "FeatureCollection":
                    raise Exception("GeoJSON conversion failed: output is not a FeatureCollection.")
                    
                geojson_features = safe_geojson.get("features", [])
                for f in geojson_features:
                    geom = f.get("geometry")
                    if not geom:
                        raise Exception("GeoJSON conversion failed: missing geometry in feature.")
                    if geom.get("type") not in ["Polygon", "MultiPolygon"]:
                        raise Exception(f"GeoJSON conversion failed: invalid geometry type {geom.get('type')}.")
                
                logger.info(f"Shapefile Validation [Job {job_id}]: "
                            f"CRS: {source_crs}, Original: {original_count}, "
                            f"Valid: {valid_count}, Repaired: {repaired_count}, "
                            f"Removed: {removed_count}, Types: {list(geom_types)}, "
                            f"GeoJSON Count: {len(geojson_features)}")
                
                # 4. Convert to ee.FeatureCollection safely
                ee_features = []
                rejected_count = 0
                first_error = None
                
                for idx, f in enumerate(geojson_features):
                    geom = f.get("geometry")
                    props = f.get("properties", {})
                    
                    try:
                        ee_geom = ee.Geometry(geom)
                        feat = ee.Feature(ee_geom, props)
                        
                        # Test if GEE accepts it (ee.Geometry(...) is sometimes lazy)
                        # We don't force full evaluation, but if it's completely invalid dict, it throws here
                        ee_features.append(feat)
                    except Exception as e:
                        if first_error is None:
                            first_error = str(e)
                        rejected_count += 1
                        logger.warning(
                            f"Skipping feature {idx} due to GEE geometry error.\n"
                            f"Original type: {geom.get('type')}\n"
                            f"Reason: {str(e)}"
                        )
                        
                if not ee_features:
                    diagnostic_msg = (
                        "All features were rejected by Google Earth Engine due to invalid geometries.\n"
                        f"Diagnostic Info:\n"
                        f"- Source CRS: {source_crs}\n"
                        f"- Feature Count: {len(geojson_features)}\n"
                        f"- Geometry Types: {list(geom_types)}\n"
                        f"- Bounds: {bounds}\n"
                        f"- First GEE Error: {first_error}\n"
                        f"- Valid: 0\n"
                        f"- Rejected: {rejected_count}"
                    )
                    raise Exception(diagnostic_msg)
                
                if rejected_count > 0:
                    self.jobs[job_id]["status"] = f"{len(ee_features)} of {len(geojson_features)} ward boundaries validated. {rejected_count} invalid geometries were skipped."
                else:
                    self.jobs[job_id]["status"] = f"{len(ee_features)} ward boundaries validated successfully."
                    
                fc = ee.FeatureCollection(ee_features)
                
                self.jobs[job_id]["status"] = "Processing Period 1"
                image_p1 = self._get_period_composite(fc, period1_start, period1_end, cloud_threshold)
                
                # Reduce over regions for P1
                stats_p1 = image_p1.select(['NDVI', 'NDWI', 'MNDWI', 'NDBI', 'BSI', 'SAVI']).reduceRegions(
                    collection=fc,
                    reducer=ee.Reducer.mean(),
                    scale=10,
                    tileScale=4
                ).getInfo()
                
                self.jobs[job_id]["status"] = "Processing Period 2"
                image_p2 = self._get_period_composite(fc, period2_start, period2_end, cloud_threshold)
                
                # Reduce over regions for P2
                stats_p2 = image_p2.select(['NDVI', 'NDWI', 'MNDWI', 'NDBI', 'BSI', 'SAVI']).reduceRegions(
                    collection=fc,
                    reducer=ee.Reducer.mean(),
                    scale=10,
                    tileScale=4
                ).getInfo()
                
                self.jobs[job_id]["status"] = "Calculating change"
                
                # 5. Process results
                features_data = []
                
                # Ensure we match features between P1 and P2
                # GEE usually returns them in the same order, but let's be safe and match by ID/index
                
                if 'features' not in stats_p1 or 'features' not in stats_p2:
                    raise Exception("Failed to extract statistics from GEE.")
                    
                p1_feat = stats_p1['features']
                p2_feat = stats_p2['features']
                
                # Perform GeoTIFF analysis if provided
                tiff_stats = [None] * len(p1_feat)
                if tiff_path and os.path.exists(tiff_path):
                    try:
                        self.jobs[job_id]["status"] = "Analyzing GeoTIFF"
                        from rasterstats import zonal_stats
                        # zonal_stats accepts GeoJSON feature collections natively
                        tiff_stats = zonal_stats(p1_feat, tiff_path, categorical=True)
                    except Exception as e:
                        logger.error(f"GeoTIFF analysis failed: {e}")
                
                for i in range(len(p1_feat)):
                    f1 = p1_feat[i]
                    f2 = p2_feat[i] if i < len(p2_feat) else None
                    t_stat = tiff_stats[i] if i < len(tiff_stats) else None
                    
                    if not f2:
                        continue
                        
                    props1 = f1.get('properties', {})
                    props2 = f2.get('properties', {})
                    
                    # Try to find a logical ID or Name field
                    feat_id = props1.get('id', str(i+1))
                    feat_name = props1.get('name', props1.get('NAME', f"Feature {i+1}"))
                    
                    def calc_change(val1, val2):
                        if val1 is None or val2 is None:
                            return None, "Not available"
                        diff = val2 - val1
                        if val1 == 0:
                            pct = "Not available"
                        else:
                            pct = (diff / abs(val1)) * 100
                        return round(diff, 4), round(pct, 2) if isinstance(pct, (int, float)) else pct
                        
                    n1 = props1.get('NDVI')
                    n2 = props2.get('NDVI')
                    n_diff, n_pct = calc_change(n1, n2)
                    
                    nw1 = props1.get('NDWI')
                    nw2 = props2.get('NDWI')
                    nw_diff, nw_pct = calc_change(nw1, nw2)
                    
                    mn1 = props1.get('MNDWI')
                    mn2 = props2.get('MNDWI')
                    mn_diff, mn_pct = calc_change(mn1, mn2)
                    
                    nb1 = props1.get('NDBI')
                    nb2 = props2.get('NDBI')
                    nb_diff, nb_pct = calc_change(nb1, nb2)
                    
                    bs1 = props1.get('BSI')
                    bs2 = props2.get('BSI')
                    bs_diff, bs_pct = calc_change(bs1, bs2)
                    
                    sv1 = props1.get('SAVI')
                    sv2 = props2.get('SAVI')
                    sv_diff, sv_pct = calc_change(sv1, sv2)
                    
                    features_data.append({
                        "feature_id": str(feat_id),
                        "feature_name": str(feat_name),
                        "ndvi_period1": round(n1, 4) if n1 is not None else None,
                        "ndvi_period2": round(n2, 4) if n2 is not None else None,
                        "ndvi_change": n_diff,
                        "ndvi_change_percent": n_pct,
                        "ndwi_period1": round(nw1, 4) if nw1 is not None else None,
                        "ndwi_period2": round(nw2, 4) if nw2 is not None else None,
                        "ndwi_change": nw_diff,
                        "ndwi_change_percent": nw_pct,
                        "mndwi_period1": round(mn1, 4) if mn1 is not None else None,
                        "mndwi_period2": round(mn2, 4) if mn2 is not None else None,
                        "mndwi_change": mn_diff,
                        "mndwi_change_percent": mn_pct,
                        "ndbi_period1": round(nb1, 4) if nb1 is not None else None,
                        "ndbi_period2": round(nb2, 4) if nb2 is not None else None,
                        "ndbi_change": nb_diff,
                        "ndbi_change_percent": nb_pct,
                        "bsi_period1": round(bs1, 4) if bs1 is not None else None,
                        "bsi_period2": round(bs2, 4) if bs2 is not None else None,
                        "bsi_change": bs_diff,
                        "bsi_change_percent": bs_pct,
                        "savi_period1": round(sv1, 4) if sv1 is not None else None,
                        "savi_period2": round(sv2, 4) if sv2 is not None else None,
                        "savi_change": sv_diff,
                        "savi_change_percent": sv_pct,
                        "geotiff_stats": t_stat
                    })
                    
                self.jobs[job_id]["status"] = "Preparing results"
                
                # Calculate overall summary
                def get_overall(key):
                    vals = [f[key] for f in features_data if f[key] is not None and isinstance(f[key], (int, float))]
                    return round(sum(vals) / len(vals), 4) if vals else None
                    
                summary = {
                    "feature_count": feature_count,
                    "total_area_sqkm": round(total_area_sqkm, 2),
                    "overall_ndvi_change": get_overall('ndvi_change'),
                    "overall_ndwi_change": get_overall('ndwi_change'),
                    "overall_mndwi_change": get_overall('mndwi_change'),
                    "overall_ndbi_change": get_overall('ndbi_change'),
                    "overall_bsi_change": get_overall('bsi_change'),
                    "overall_savi_change": get_overall('savi_change')
                }
                
                self.jobs[job_id]["results"] = {
                    "summary": summary,
                    "features": features_data,
                    "geojson": safe_geojson, # return boundary to show on map
                    "bounding_box": bounding_box,
                    "period1": f"{period1_start} - {period1_end}",
                    "period2": f"{period2_start} - {period2_end}",
                    "cloud_threshold": cloud_threshold
                }
                self.jobs[job_id]["status"] = "Complete"
                
        except Exception as e:
            logger.error(f"Shapefile Analysis Error: {str(e)}")
            self.jobs[job_id]["status"] = "Error"
            self.jobs[job_id]["error"] = str(e)
            
    def start_analysis(self, zip_path: str, p1_start: str, p1_end: str, p2_start: str, p2_end: str, cloud_threshold: int, tiff_path: str = None) -> str:
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "status": "Uploading shapefile",
            "results": None,
            "error": None
        }
        
        # Start async thread
        thread = threading.Thread(target=self._process_job, args=(job_id, zip_path, p1_start, p1_end, p2_start, p2_end, cloud_threshold, tiff_path))
        thread.daemon = True
        thread.start()
        
        return job_id
        
    def get_status(self, job_id: str) -> Dict[str, Any]:
        if job_id not in self.jobs:
            return {"status": "Not Found"}
        return {
            "status": self.jobs[job_id]["status"],
            "error": self.jobs[job_id].get("error")
        }
        
    def get_results(self, job_id: str) -> Dict[str, Any]:
        if job_id not in self.jobs:
            return {"status": "Not Found"}
        return self.jobs[job_id].get("results", {})
