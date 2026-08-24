import os
import json
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class GEEError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(self.message)

GEE_AVAILABLE = False
GEE_AUTH_STATUS = "Not Initialized"
GEE_AUTH_MODE = "None"
GEE_ACTIVE_PROJECT = ""
GEE_SERVICE_ACCOUNT_EMAIL = ""

try:
    import ee
except ImportError:
    ee = None

def _mask_email(email: str) -> str:
    """Mask email address for secure logging (e.g. geo***@project.iam.gserviceaccount.com)."""
    if not email or "@" not in email:
        return "***"
    parts = email.split("@", 1)
    user, domain = parts[0], parts[1]
    if len(user) <= 3:
        masked_user = user[0] + "***"
    else:
        masked_user = user[:3] + "***"
    return f"{masked_user}@{domain}"

def _init_earth_engine():
    global GEE_AVAILABLE, GEE_AUTH_STATUS, GEE_AUTH_MODE, GEE_ACTIVE_PROJECT, GEE_SERVICE_ACCOUNT_EMAIL
    
    if ee is None:
        GEE_AUTH_STATUS = "earthengine-api missing"
        logger.warning("earthengine-api not installed. GEE unavailable.")
        return

    service_account_json = os.environ.get("GEE_SERVICE_ACCOUNT_JSON")
    project_id = os.environ.get("GEE_PROJECT_ID", "").strip()

    # 1. Production Mode: Service Account Authentication
    if service_account_json and service_account_json.strip():
        GEE_AUTH_MODE = "Service Account"
        
        # Check GEE_PROJECT_ID presence
        if not project_id:
            GEE_AUTH_STATUS = "GEE_PROJECT_ID environment variable is missing"
            logger.error("GEE AUTH ERROR: GEE_PROJECT_ID environment variable is missing.")
            return

        # Parse JSON
        try:
            key_dict = json.loads(service_account_json)
        except Exception as e:
            GEE_AUTH_STATUS = f"Invalid JSON in GEE_SERVICE_ACCOUNT_JSON: {e}"
            logger.error("GEE AUTH ERROR: Invalid JSON in GEE_SERVICE_ACCOUNT_JSON environment variable.")
            return

        client_email = key_dict.get("client_email")
        if not client_email:
            GEE_AUTH_STATUS = "Missing client_email in GEE_SERVICE_ACCOUNT_JSON"
            logger.error("GEE AUTH ERROR: Missing client_email in GEE_SERVICE_ACCOUNT_JSON key data.")
            return

        try:
            credentials = ee.ServiceAccountCredentials(
                client_email,
                key_data=service_account_json
            )
            ee.Initialize(credentials, project=project_id)
            GEE_AVAILABLE = True
            GEE_AUTH_STATUS = "Authenticated"
            GEE_ACTIVE_PROJECT = project_id
            masked = _mask_email(client_email)
            GEE_SERVICE_ACCOUNT_EMAIL = masked
            logger.info(f"GEE AUTH SUCCESS:\nservice account={masked}\nproject={project_id}")
        except Exception as e:
            err_str = str(e)
            if "not enabled" in err_str.lower():
                GEE_AUTH_STATUS = f"Earth Engine API not enabled for project {project_id}"
            elif "permission" in err_str.lower() or "denied" in err_str.lower():
                GEE_AUTH_STATUS = f"Insufficient IAM permissions for service account {client_email}"
            elif "not registered" in err_str.lower() or "not found" in err_str.lower():
                GEE_AUTH_STATUS = f"Project {project_id} is not registered for Earth Engine"
            else:
                GEE_AUTH_STATUS = f"Authentication failed: {err_str}"
            logger.error(f"GEE AUTH ERROR: {GEE_AUTH_STATUS}")
            return

    # 2. Local Development Fallback Mode (User Authentication / Local OAuth)
    else:
        GEE_AUTH_MODE = "Local User Auth"
        if not project_id:
            GEE_AUTH_STATUS = "GEE_PROJECT_ID is not set (and no GEE_SERVICE_ACCOUNT_JSON provided)"
            logger.warning("GEE Local Auth Warning: GEE_PROJECT_ID environment variable is missing.")
            return

        try:
            ee.Initialize(project=project_id, opt_url='https://earthengine-highvolume.googleapis.com')
            GEE_AVAILABLE = True
            GEE_AUTH_STATUS = "Authenticated"
            GEE_ACTIVE_PROJECT = project_id
            logger.info(f"Google Earth Engine initialized locally with project {project_id}.")
        except Exception as e:
            GEE_AUTH_STATUS = f"Local GEE init failed: {e}"
            logger.warning(f"GEE Local Initialization failed: {e}")

_init_earth_engine()


class GEESource:
    """
    Retrieves Google Earth Engine (GEE) Sentinel-2 data and generates
    the exact 24 features required by the existing ML model.
    """
    
    BASE_FEATURE_NAMES = [
        "B2", "B3", "B4", "B8", "B11", "B12",
        "NDVI", "NDWI", "MNDWI", "NDBI",
        "BSI", "SAVI", "NBR", "EVI", "UI", "NDMI", "GRVI",
        "Brightness", "Greenness", "SWIR_Ratio", "NIR_Red_Ratio", "NIR_Green_Ratio",
        "NDBI_NDVI_diff", "MNDWI_NDVI_diff",
        "VV", "VH"
    ]

    def __init__(self):
        pass

    def check_availability(self):
        """Raises an exception if GEE is not available."""
        if not GEE_AVAILABLE:
            raise GEEError("GEE_NOT_AUTHENTICATED", f"GEE unavailable: {GEE_AUTH_STATUS}")

    def get_features_for_location(self, lat: float, lon: float, year: int = None, start_date: str = None, end_date: str = None, cloud_threshold: int = 20) -> Dict[str, Any]:
        """
        Retrieves the 24 required features for a specific lat/lon coordinate for the given date range.
        Returns a dict with 'features' and 'metadata'.
        """
        self.check_availability()
        
        point = ee.Geometry.Point([lon, lat])
        
        if start_date is None or end_date is None:
            if year is None:
                year = 2024
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            
        # Limit to max 1 year if needed, but standard queries shouldn't need strict enforcement if user is controlled.
        # We'll just pass the dates directly.
        
        # Cloud masking function for Sentinel-2
        def maskS2clouds(image):
            qa = image.select('QA60')
            cloudBitMask = 1 << 10
            cirrusBitMask = 1 << 11
            mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(qa.bitwiseAnd(cirrusBitMask).eq(0))
            return image.updateMask(mask).divide(10000)
            
        s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                         .filterBounds(point)
                         .filterDate(start_date, end_date)
                         .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
                         .map(maskS2clouds))
                         
        median_image = s2_collection.median()
        
        # Sentinel-1 SAR Collection (No optical cloud filtering)
        s1_collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                         .filterBounds(point)
                         .filterDate(start_date, end_date)
                         .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                         .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                         .filter(ee.Filter.eq('instrumentMode', 'IW')))
        s1_median = s1_collection.select(['VV', 'VH']).median()
        
        # If no image found, raise error
        try:
            count = s2_collection.size().getInfo()
        except Exception as e:
            raise GEEError("GEE_COMPUTATION_TIMEOUT", f"GEE computation failed or timed out: {str(e)}")

        if count == 0:
            raise GEEError("GEE_DATA_UNAVAILABLE", f"No suitable Sentinel-2 imagery could be retrieved for this region between {start_date} and {end_date}.")
            
        # Calculate derived indices
        image = self._add_indices(median_image)
        
        # Add SAR bands
        image = image.addBands(s1_median)
        
        # Extract values at the point
        values = image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point,
            scale=10,
            maxPixels=1e9
        ).getInfo()
        
        # Format output exactly as BASE_FEATURE_NAMES
        features = {}
        for feature_name in self.BASE_FEATURE_NAMES:
            features[feature_name] = float(values.get(feature_name, 0.0)) if values.get(feature_name) is not None else None
            
        return {
            "features": features,
            "metadata": {
                "dataset": "Sentinel-2 Surface Reflectance (Harmonized) & Sentinel-1 GRD",
                "source_type": "GEE_MULTISPECTRAL",
                "date_range": {"start": start_date, "end": end_date},
                "cloud_threshold": cloud_threshold,
                "images_found": count,
                "scale": 10,
                "processing_method": "Cloud-masked multispectral median composite"
            }
        }

    def get_features_for_polygon(self, polygon_coords: List[List[float]], year: int = None, start_date: str = None, end_date: str = None, cloud_threshold: int = 20, max_samples: int = 500) -> Dict[str, Any]:
        """
        Retrieves feature samples for a polygon. 
        Limits requests to a reasonable sample count so GEE does not become slow or exceed limits.
        Returns a dict with 'samples' and 'metadata'.
        """
        self.check_availability()
        
        polygon = ee.Geometry.Polygon(polygon_coords)
        
        if start_date is None or end_date is None:
            if year is None:
                year = 2024
            start_date = f"{year}-01-01"
            end_date = f"{year}-12-31"
            
        def maskS2clouds(image):
            qa = image.select('QA60')
            cloudBitMask = 1 << 10
            cirrusBitMask = 1 << 11
            mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(qa.bitwiseAnd(cirrusBitMask).eq(0))
            return image.updateMask(mask).divide(10000)
            
        s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                         .filterBounds(polygon)
                         .filterDate(start_date, end_date)
                         .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
                         .map(maskS2clouds))
                         
        median_image = s2_collection.median().clip(polygon)
        
        # Sentinel-1 SAR Collection (No optical cloud filtering)
        s1_collection = (ee.ImageCollection('COPERNICUS/S1_GRD')
                         .filterBounds(polygon)
                         .filterDate(start_date, end_date)
                         .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                         .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                         .filter(ee.Filter.eq('instrumentMode', 'IW')))
        s1_median = s1_collection.select(['VV', 'VH']).median().clip(polygon)
        
        try:
            count = s2_collection.size().getInfo()
        except Exception as e:
            raise GEEError("GEE_COMPUTATION_TIMEOUT", f"GEE computation failed or timed out: {str(e)}")

        if count == 0:
            raise GEEError("GEE_DATA_UNAVAILABLE", f"No suitable Sentinel-2 imagery could be retrieved for this polygon between {start_date} and {end_date}.")
            
        image = self._add_indices(median_image)
        
        # Add SAR bands
        image = image.addBands(s1_median)
        
        # Sample points within the polygon
        try:
            samples = image.sample(
                region=polygon,
                scale=20, # Reduced scale slightly for polygons to improve speed and memory
                numPixels=max_samples,
                geometries=True,
                tileScale=4
            ).getInfo()
        except Exception as e:
            raise GEEError("GEE_COMPUTATION_TIMEOUT", f"Failed to extract features (region might be too large): {str(e)}")
        
        if 'features' not in samples or len(samples['features']) == 0:
            raise GEEError("GEE_FEATURE_EXTRACTION_ERROR", f"Could not extract feature samples for polygon between {start_date} and {end_date}.")
            
        result = []
        for feat in samples['features']:
            props = feat.get('properties', {})
            geom = feat.get('geometry', {})
            coords = geom.get('coordinates', [0, 0])
            
            # Format exactly matching BASE_FEATURE_NAMES
            pt_features = {}
            for name in self.BASE_FEATURE_NAMES:
                pt_features[name] = float(props.get(name, 0.0)) if props.get(name) is not None else None
                
            result.append({
                "features": pt_features,
                "coordinates": coords
            })
            
        return {
            "samples": result,
            "metadata": {
                "dataset": "Sentinel-2 Surface Reflectance (Harmonized) & Sentinel-1 GRD",
                "source_type": "GEE_MULTISPECTRAL",
                "date_range": {"start": start_date, "end": end_date},
                "cloud_threshold": cloud_threshold,
                "images_found": count,
                "scale": 20,
                "processing_method": "Cloud-masked multispectral median composite"
            }
        }

    def _add_indices(self, image):
        """Adds all the required 24 spectral and derived indices to the GEE image."""
        
        # B2: Blue, B3: Green, B4: Red, B8: NIR, B11: SWIR1, B12: SWIR2
        # NDVI = (NIR - Red) / (NIR + Red)
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # NDWI = (Green - NIR) / (Green + NIR)
        ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI')
        
        # MNDWI = (Green - SWIR1) / (Green + SWIR1)
        mndwi = image.normalizedDifference(['B3', 'B11']).rename('MNDWI')
        
        # NDBI = (SWIR1 - NIR) / (SWIR1 + NIR)
        ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI')
        
        # BSI = ((SWIR1 + Red) - (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))
        bsi = image.expression(
            '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))', {
                'SWIR1': image.select('B11'),
                'RED': image.select('B4'),
                'NIR': image.select('B8'),
                'BLUE': image.select('B2')
            }).rename('BSI')
            
        # SAVI = ((NIR - Red) / (NIR + Red + 0.5)) * (1.5)
        savi = image.expression(
            '((NIR - RED) / (NIR + RED + 0.5)) * 1.5', {
                'NIR': image.select('B8'),
                'RED': image.select('B4')
            }).rename('SAVI')
            
        # NBR = (NIR - SWIR2) / (NIR + SWIR2)
        nbr = image.normalizedDifference(['B8', 'B12']).rename('NBR')
        
        # EVI = 2.5 * ((NIR - Red) / (NIR + 6 * Red - 7.5 * Blue + 1))
        evi = image.expression(
            '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                'NIR': image.select('B8'),
                'RED': image.select('B4'),
                'BLUE': image.select('B2')
            }).rename('EVI')
            
        # UI = (SWIR2 - NIR) / (SWIR2 + NIR)
        ui = image.normalizedDifference(['B12', 'B8']).rename('UI')
        
        # NDMI = (NIR - SWIR1) / (NIR + SWIR1)
        ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI')
        
        # GRVI = (Green - Red) / (Green + Red)
        grvi = image.normalizedDifference(['B3', 'B4']).rename('GRVI')
        
        # Brightness = sqrt(B2^2 + B3^2 + B4^2 + B8^2 + B11^2 + B12^2)
        brightness = image.expression(
            'sqrt(b("B2")**2 + b("B3")**2 + b("B4")**2 + b("B8")**2 + b("B11")**2 + b("B12")**2)'
        ).rename('Brightness')
        
        # Greenness = (Green / (Red + Green + Blue))  *approx
        greenness = image.expression(
            'b("B3") / (b("B4") + b("B3") + b("B2") + 0.0001)'
        ).rename('Greenness')
        
        # SWIR_Ratio = SWIR1 / SWIR2
        swir_ratio = image.expression('b("B11") / (b("B12") + 0.0001)').rename('SWIR_Ratio')
        
        # NIR_Red_Ratio = NIR / Red
        nir_red_ratio = image.expression('b("B8") / (b("B4") + 0.0001)').rename('NIR_Red_Ratio')
        
        # NIR_Green_Ratio = NIR / Green
        nir_green_ratio = image.expression('b("B8") / (b("B3") + 0.0001)').rename('NIR_Green_Ratio')
        
        # NDBI_NDVI_diff = NDBI - NDVI
        ndbi_ndvi_diff = ndbi.subtract(ndvi).rename('NDBI_NDVI_diff')
        
        # MNDWI_NDVI_diff = MNDWI - NDVI
        mndwi_ndvi_diff = mndwi.subtract(ndvi).rename('MNDWI_NDVI_diff')
        
        return image.addBands([
            ndvi, ndwi, mndwi, ndbi, bsi, savi, nbr, evi, ui, ndmi, grvi,
            brightness, greenness, swir_ratio, nir_red_ratio, nir_green_ratio,
            ndbi_ndvi_diff, mndwi_ndvi_diff
        ])
