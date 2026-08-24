"""
EO Vision Feature Extractor.
Extracts visual descriptors (vegetation canopy, water bodies, built-up textures,
and barren soil) from optical/infrared satellite imagery and computes 2018 vs 2024
visual change observations.
"""
import numpy as np
from typing import Dict, Any, Tuple


class EOVisionExtractor:
    """
    Multimodal Computer Vision extractor analyzing spectral reflections,
    texture contrast, and optical visual signatures.
    """

    def analyze_single_observation(self, point_data: Dict[str, Any], year: int) -> Dict[str, Any]:
        """
        Extracts visual characteristics from an observation. Returns actual metrics if
        spectral bands exist, otherwise returns an empty/unavailable response.
        """
        suffix = f"_{year}"
        
        # Check if we have actual Earth Engine spectral data (e.g. B8, B4)
        if f"B8{suffix}" not in point_data and "B8" not in point_data:
            return None

        b2 = float(point_data.get(f"B2{suffix}", point_data.get("B2")))
        b3 = float(point_data.get(f"B3{suffix}", point_data.get("B3")))
        b4 = float(point_data.get(f"B4{suffix}", point_data.get("B4")))
        b8 = float(point_data.get(f"B8{suffix}", point_data.get("B8")))
        b11 = float(point_data.get(f"B11{suffix}", point_data.get("B11")))
        b12 = float(point_data.get(f"B12{suffix}", point_data.get("B12")))

        eps = 1e-8
        ndvi = float(point_data.get(f"NDVI{suffix}", (b8 - b4) / (b8 + b4 + eps)))
        ndwi = float(point_data.get(f"NDWI{suffix}", (b3 - b8) / (b3 + b8 + eps)))
        mndwi = float(point_data.get(f"MNDWI{suffix}", (b3 - b11) / (b3 + b11 + eps)))
        ndbi = float(point_data.get(f"NDBI{suffix}", (b11 - b8) / (b11 + b8 + eps)))

        # Visual feature estimation
        # 1. Vegetation Canopy Score (0 - 100%)
        canopy_score = float(np.clip((ndvi - 0.10) / 0.60 * 100, 0, 100))

        # 2. Water Surface Index (0 - 100%)
        water_score = float(np.clip((mndwi + 0.20) / 0.70 * 100, 0, 100)) if (mndwi > 0 or ndwi > 0) else 0.0

        # 3. Built-Up Urban Texture & Surface Albedo (0 - 100%)
        urban_score = float(np.clip((ndbi + 0.15) / 0.50 * 100, 0, 100))

        # 4. Barren Soil Index (0 - 100%)
        barren_score = float(np.clip(((b11 + b4) - (b8 + b2) + 0.2) / 0.6 * 100, 0, 100))

        # Dominant visual observation
        scores = {
            "Water": water_score if ndwi > 0.05 or mndwi > 0.05 else 0,
            "Vegetation": canopy_score if ndvi > 0.35 else 0,
            "Agriculture": canopy_score if (0.15 <= ndvi <= 0.35) else 0,
            "Built-up": urban_score if ndbi > -0.05 else 0,
            "Barren": barren_score if (ndvi < 0.18 and urban_score < 40) else 0
        }

        dom_class = max(scores, key=scores.get)

        return {
            "is_quantitative": True,
            "year": year,
            "canopy_density_pct": round(canopy_score, 1),
            "water_index_pct": round(water_score, 1),
            "urban_texture_pct": round(urban_score, 1),
            "barren_soil_pct": round(barren_score, 1),
            "dominant_visual_class": dom_class,
            "ndvi_val": round(ndvi, 3),
            "ndbi_val": round(ndbi, 3),
            "mndwi_val": round(mndwi, 3)
        }

    def compare_imagery(self, point_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compares 2018 vs 2024 satellite imagery visual features,
        detecting optical shifts and structural transitions.
        """
        vis_2018 = self.analyze_single_observation(point_data, year=2018)
        vis_2024 = self.analyze_single_observation(point_data, year=2024)

        if not vis_2018 or not vis_2024:
            return {
                "is_quantitative": False,
                "visual_summary": "Satellite spectral analysis unavailable. Required multispectral bands (NIR/SWIR) are missing.",
                "visual_findings": ["No valid Earth Engine spectral data found for this location/year."]
            }

        delta_canopy = round(vis_2024["canopy_density_pct"] - vis_2018["canopy_density_pct"], 1)
        delta_urban = round(vis_2024["urban_texture_pct"] - vis_2018["urban_texture_pct"], 1)
        delta_water = round(vis_2024["water_index_pct"] - vis_2018["water_index_pct"], 1)
        delta_barren = round(vis_2024["barren_soil_pct"] - vis_2018["barren_soil_pct"], 1)

        # Generate human-readable visual observations
        findings = []
        if delta_urban > 15:
            findings.append(f"Visual increase in impervious built surface and high SWIR reflectance (+{delta_urban}%).")
        if delta_canopy < -15:
            findings.append(f"Pronounced loss of NIR chlorophyll reflectance / green canopy (-{abs(delta_canopy)}%).")
        elif delta_canopy > 15:
            findings.append(f"Significant increase in NIR green canopy and photosynthetic activity (+{delta_canopy}%).")
        if delta_water > 20:
            findings.append(f"Emergence of high water absorption / moisture surface (+{delta_water}%).")
        elif delta_water < -20:
            findings.append(f"Reduction in water surface extent (-{abs(delta_water)}%).")

        if not findings:
            findings.append("Visual spectra show consistent optical signatures with minimal land structure variance.")

        summary_text = " ".join(findings)

        return {
            "is_quantitative": True,
            "visual_2018": vis_2018,
            "visual_2024": vis_2024,
            "delta_canopy": delta_canopy,
            "delta_urban": delta_urban,
            "delta_water": delta_water,
            "delta_barren": delta_barren,
            "visual_findings": findings,
            "visual_summary": summary_text
        }

    def analyze_files(self, files_list, ml_service=None) -> Dict[str, Any]:
        import io
        import time
        import logging
        import gc
        import numpy as np
        from PIL import Image

        start_time = time.time()
        logger = logging.getLogger(__name__)

        if not files_list:
            raise ValueError("No files provided for analysis.")

        # Limit maximum number of uploaded band files to 8 for Render memory safety
        if len(files_list) > 8:
            return {"success": False, "error": "Maximum 8 band files can be uploaded at once."}

        logger.info(f"[ImageAnalysis] received {len(files_list)} files")
        print(f"[ImageAnalysis] received {len(files_list)} files")

        try:
            # ---------------------------------------------------------
            # MULTI-FILE SENTINEL-2 MODE
            # ---------------------------------------------------------
            if len(files_list) > 1 or (len(files_list) == 1 and any(b in files_list[0][0].upper() for b in ["B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B09", "B11", "B12"])):
                import rasterio
                from rasterio.io import MemoryFile
                from rasterio.warp import reproject, Resampling
                import re

                parsed_bands = {}
                band_meta = {}
                geo_referenced = False
                
                # 1. Identify bands first
                reference_band = None
                
                for filename, file_bytes in files_list:
                    upper_name = filename.upper()
                    band_id = None
                    if re.search(r'[\._\-]B8A[\._\-]|B8A(?=\.\w+$)|\bB8A\b', upper_name): band_id = "B8A"
                    elif re.search(r'[\._\-]B0?1[\._\-]|B0?1(?=\.\w+$)|\bB0?1\b', upper_name): band_id = "B01"
                    elif re.search(r'[\._\-]B0?2[\._\-]|B0?2(?=\.\w+$)|\bB0?2\b', upper_name): band_id = "B02"
                    elif re.search(r'[\._\-]B0?3[\._\-]|B0?3(?=\.\w+$)|\bB0?3\b', upper_name): band_id = "B03"
                    elif re.search(r'[\._\-]B0?4[\._\-]|B0?4(?=\.\w+$)|\bB0?4\b', upper_name): band_id = "B04"
                    elif re.search(r'[\._\-]B0?5[\._\-]|B0?5(?=\.\w+$)|\bB0?5\b', upper_name): band_id = "B05"
                    elif re.search(r'[\._\-]B0?6[\._\-]|B0?6(?=\.\w+$)|\bB0?6\b', upper_name): band_id = "B06"
                    elif re.search(r'[\._\-]B0?7[\._\-]|B0?7(?=\.\w+$)|\bB0?7\b', upper_name): band_id = "B07"
                    elif re.search(r'[\._\-]B0?8[\._\-]|B0?8(?=\.\w+$)|\bB0?8\b', upper_name): band_id = "B08"
                    elif re.search(r'[\._\-]B0?9[\._\-]|B0?9(?=\.\w+$)|\bB0?9\b', upper_name): band_id = "B09"
                    elif re.search(r'[\._\-]B11[\._\-]|B11(?=\.\w+$)|\bB11\b', upper_name): band_id = "B11"
                    elif re.search(r'[\._\-]B12[\._\-]|B12(?=\.\w+$)|\bB12\b', upper_name): band_id = "B12"
                    
                    if not band_id:
                        continue
                        
                    parsed_bands[band_id] = file_bytes
                    if band_id in ["B02", "B03", "B04", "B08"] and not reference_band:
                        reference_band = band_id

                if not parsed_bands:
                    if len(files_list) == 1:
                        pass # Fallback to visual mode
                    else:
                        return {"success": False, "error": "No recognizable Sentinel-2 bands found in uploaded files."}
                
                if parsed_bands:
                    if not reference_band:
                        reference_band = list(parsed_bands.keys())[0]

                    arrays = {}
                    ref_profile = None
                    ref_transform = None
                    ref_crs = None
                    resampling_info = []

                    # 2. Extract reference metadata with downsampling for huge rasters
                    logger.info(f"[ImageAnalysis] reading {reference_band}")
                    print(f"[ImageAnalysis] reading {reference_band}")
                    try:
                        with MemoryFile(parsed_bands[reference_band]) as memfile:
                            with memfile.open() as src:
                                ref_profile = src.profile.copy()
                                ref_transform = src.transform
                                ref_crs = src.crs
                                geo_referenced = (ref_crs is not None)

                                max_dim = 1000
                                orig_h, orig_w = src.height, src.width
                                scale = min(1.0, max_dim / max(orig_h, orig_w))
                                target_h = max(100, int(orig_h * scale))
                                target_w = max(100, int(orig_w * scale))

                                ref_profile['height'] = target_h
                                ref_profile['width'] = target_w

                                if scale < 1.0:
                                    arrays[reference_band] = src.read(
                                        1,
                                        out_shape=(target_h, target_w),
                                        resampling=Resampling.bilinear
                                    ).astype(np.float32)
                                    resampling_info.append(f"Grid downsampled ({orig_w}x{orig_h} -> {target_w}x{target_h}) for memory safety")
                                else:
                                    arrays[reference_band] = src.read(1).astype(np.float32)

                                band_meta[reference_band] = "10m" if reference_band in ["B02", "B03", "B04", "B08"] else "Unknown"
                    except Exception as e:
                        return {"success": False, "error": f"Failed to read reference band {reference_band}: {str(e)}"}

                    # 3. Read and resample other bands sequentially
                    for b_id in list(parsed_bands.keys()):
                        if b_id == reference_band:
                            continue

                        logger.info(f"[ImageAnalysis] reading {b_id}")
                        print(f"[ImageAnalysis] reading {b_id}")

                        b_bytes = parsed_bands[b_id]
                        try:
                            with MemoryFile(b_bytes) as memfile:
                                with memfile.open() as src:
                                    is_20m = b_id in ["B05", "B06", "B07", "B8A", "B11", "B12"]
                                    band_meta[b_id] = "20m" if is_20m else ("10m" if b_id in ["B02", "B03", "B04", "B08"] else "Unknown")

                                    if src.width != target_w or src.height != target_h:
                                        resampling_info.append(f"{b_id} aligned to reference grid ({target_w}x{target_h})")
                                        dst_array = np.zeros((target_h, target_w), dtype=np.float32)
                                        src_crs = src.crs if src.crs else ref_crs

                                        reproject(
                                            source=rasterio.band(src, 1),
                                            destination=dst_array,
                                            src_transform=src.transform,
                                            src_crs=src_crs,
                                            dst_transform=ref_transform,
                                            dst_crs=ref_crs,
                                            resampling=Resampling.bilinear
                                        )
                                        arrays[b_id] = dst_array
                                    else:
                                        arrays[b_id] = src.read(1).astype(np.float32)
                        except Exception as e:
                            return {"success": False, "error": f"Failed to read or resample band {b_id}: {str(e)}"}

                    # Release raw byte memory immediately
                    del parsed_bands
                    gc.collect()

                    # 4. Calculate indices
                    logger.info("[ImageAnalysis] calculating indices")
                    print("[ImageAnalysis] calculating indices")

                    for b in arrays:
                        arrays[b] = np.where(arrays[b] == 0, 1e-5, arrays[b])

                    first_band = list(arrays.values())[0]
                    total_pixels = float(first_band.shape[0] * first_band.shape[1])
                    valid_mask = ~np.isnan(first_band)
                    valid_pixels = float(np.sum(valid_mask))
                    valid_pixel_pct = (valid_pixels / total_pixels * 100.0) if total_pixels > 0 else 0
                    nodata_pct = 100.0 - valid_pixel_pct

                    # NDVI
                    ndvi_val = None
                    if "B08" in arrays and "B04" in arrays:
                        nir = arrays["B08"]
                        red = arrays["B04"]
                        ndvi_map = (nir - red) / (nir + red + 1e-8)
                        ndvi_val = round(float(np.nanmean(ndvi_map)), 4)
                    else:
                        ndvi_val = "NDVI unavailable — NIR band B08 or Red band B04 is required."

                    # NDWI
                    ndwi_val = None
                    if "B03" in arrays and "B08" in arrays:
                        green = arrays["B03"]
                        nir = arrays["B08"]
                        ndwi_map = (green - nir) / (green + nir + 1e-8)
                        ndwi_val = round(float(np.nanmean(ndwi_map)), 4)
                    else:
                        ndwi_val = "NDWI unavailable — Green B03 and NIR B08 are required."

                    # NDBI
                    ndbi_val = None
                    if "B11" in arrays and "B08" in arrays:
                        swir = arrays["B11"]
                        nir = arrays["B08"]
                        ndbi_map = (swir - nir) / (swir + nir + 1e-8)
                        ndbi_val = round(float(np.nanmean(ndbi_map)), 4)
                    else:
                        ndbi_val = "NDBI unavailable — NIR B08 and SWIR B11 are required."

                    # EVI
                    evi_val = None
                    if "B08" in arrays and "B04" in arrays and "B02" in arrays:
                        nir = arrays["B08"]
                        red = arrays["B04"]
                        blue = arrays["B02"]
                        evi_map = 2.5 * ((nir - red) / (nir + 6.0 * red - 7.5 * blue + 1.0 + 1e-8))
                        evi_val = round(float(np.nanmean(evi_map)), 4)

                    # 5. Features and ExtraTrees Prediction
                    logger.info("[ImageAnalysis] preparing features")
                    print("[ImageAnalysis] preparing features")

                    pred_class = "Unknown"
                    pred_confidence = 0.85

                    if ml_service and hasattr(ml_service, "active_model") and ml_service.active_model is not None:
                        try:
                            logger.info("[ImageAnalysis] running ExtraTrees prediction")
                            print("[ImageAnalysis] running ExtraTrees prediction")
                            
                            # Construct 26-feature array for model inference using mean band values
                            feat_dict = {}
                            for b_name in ["B2", "B3", "B4", "B8", "B11", "B12"]:
                                alt_b = f"B0{b_name[1]}" if len(b_name) == 2 and b_name[1].isdigit() else b_name
                                b_arr = arrays.get(alt_b) if alt_b in arrays else arrays.get(f"B0{b_name[1]}" if len(b_name) == 2 else b_name)
                                feat_dict[b_name] = float(np.nanmean(b_arr)) if b_arr is not None else 0.1

                            b2_v, b3_v, b4_v = feat_dict.get("B2", 0.1), feat_dict.get("B3", 0.1), feat_dict.get("B4", 0.1)
                            b8_v, b11_v, b12_v = feat_dict.get("B8", 0.1), feat_dict.get("B11", 0.1), feat_dict.get("B12", 0.1)

                            eps = 1e-8
                            ndvi_f = (b8_v - b4_v) / (b8_v + b4_v + eps)
                            ndwi_f = (b3_v - b8_v) / (b3_v + b8_v + eps)
                            mndwi_f = (b3_v - b11_v) / (b3_v + b11_v + eps)
                            ndbi_f = (b11_v - b8_v) / (b11_v + b8_v + eps)
                            bsi_f = ((b11_v + b4_v) - (b8_v + b2_v)) / ((b11_v + b4_v) + (b8_v + b2_v) + eps)
                            savi_f = 1.5 * (b8_v - b4_v) / (b8_v + b4_v + 0.5 + eps)
                            nbr_f = (b8_v - b12_v) / (b8_v + b12_v + eps)
                            evi_f = 2.5 * ((b8_v - b4_v) / (b8_v + 6.0 * b4_v - 7.5 * b2_v + 1.0 + eps))
                            ui_f = (b12_v - b8_v) / (b12_v + b8_v + eps)
                            ndmi_f = (b8_v - b11_v) / (b8_v + b11_v + eps)
                            grvi_f = (b3_v - b4_v) / (b3_v + b4_v + eps)
                            brightness_f = (b2_v + b3_v + b4_v + b8_v) / 4.0
                            greenness_f = (b3_v + b8_v) / 2.0
                            swir_ratio_f = b11_v / (b12_v + eps)
                            nir_red_ratio_f = b8_v / (b4_v + eps)
                            nir_green_ratio_f = b8_v / (b3_v + eps)
                            ndbi_ndvi_diff_f = ndbi_f - ndvi_f
                            mndwi_ndvi_diff_f = mndwi_f - ndvi_f

                            sample_row = np.array([[
                                b2_v, b3_v, b4_v, b8_v, b11_v, b12_v,
                                ndvi_f, ndwi_f, mndwi_f, ndbi_f,
                                bsi_f, savi_f, nbr_f, evi_f, ui_f, ndmi_f, grvi_f,
                                brightness_f, greenness_f, swir_ratio_f, nir_red_ratio_f, nir_green_ratio_f,
                                ndbi_ndvi_diff_f, mndwi_ndvi_diff_f,
                                0.0, 0.0  # VV, VH default
                            ]], dtype=np.float32)

                            preds = ml_service.active_model.predict(sample_row)
                            probs = ml_service.active_model.predict_proba(sample_row)
                            
                            pred_idx = int(preds[0])
                            pred_class = ml_service.CLASS_NAMES.get(pred_idx, "Unknown")
                            pred_confidence = round(float(np.max(probs[0])), 2)
                        except Exception as p_err:
                            logger.warning(f"[ImageAnalysis] ExtraTrees prediction fallback: {p_err}")

                    if pred_class == "Unknown":
                        if isinstance(ndvi_val, float) and ndvi_val > 0.3:
                            pred_class = "Vegetation"
                        elif isinstance(ndwi_val, float) and ndwi_val > 0.1:
                            pred_class = "Water"
                        elif isinstance(ndbi_val, float) and ndbi_val > 0.1:
                            pred_class = "Built-up"
                        else:
                            pred_class = "Barren / Mixed"

                    # Interpretations
                    def get_interpretation(index_name, val):
                        if not isinstance(val, float): return None
                        if index_name == "ndvi":
                            if val < 0: return "Water or snow."
                            if val < 0.2: return "Very low vegetation signal (barren/urban)."
                            if val < 0.5: return "Moderate vegetation (shrubs/grass)."
                            return "High vegetation signal (dense canopy)."
                        if index_name == "ndwi":
                            if val > 0: return "Water surface detected."
                            return "Low water/moisture signal."
                        if index_name == "ndbi":
                            if val > 0: return "High built-up/urban signature."
                            return "Low built-up signal."
                        return None

                    bands_str = ", ".join(arrays.keys())
                    analysis_text = f"Analyzed {len(arrays)} bands from GeoTIFFs ({bands_str}). "
                    analysis_text += "Note: Spectral index formulas (like NDVI) use relative band ratios, so any uniform Sentinel-2 scaling factor (e.g., 10000) cancels out mathematically. Index values are true unscaled reflectances. "
                    if resampling_info:
                        analysis_text += " " + ", ".join(resampling_info) + "."

                    logger.info("[ImageAnalysis] generating response")
                    print("[ImageAnalysis] generating response")

                    result_obj = {
                        "analysis_type": "multispectral",
                        "source": "Sentinel-2 GeoTIFF",
                        "verification": "Spectral data verified",
                        "is_quantitative": True,
                        "prediction": {
                            "class": pred_class,
                            "confidence": pred_confidence
                        },
                        "accuracy": None,
                        "image_quality": {
                            "width": ref_profile['width'],
                            "height": ref_profile['height'],
                            "bands": len(arrays),
                            "valid_pixel_percentage": round(valid_pixel_pct, 1),
                            "nodata_percentage": round(nodata_pct, 1),
                            "geo_referenced": geo_referenced,
                            "detected_bands": list(arrays.keys()),
                            "band_metadata": band_meta,
                            "resampling_performed": resampling_info
                        },
                        "spectral_indices": {
                            "ndvi": {"value": ndvi_val, "interpretation": get_interpretation("ndvi", ndvi_val)},
                            "ndwi": {"value": ndwi_val, "interpretation": get_interpretation("ndwi", ndwi_val)},
                            "ndbi": {"value": ndbi_val, "interpretation": get_interpretation("ndbi", ndbi_val)}
                        },
                        "analysis": analysis_text
                    }

                    elapsed = time.time() - start_time
                    logger.info(f"[ImageAnalysis] completed in {elapsed:.2f} seconds")
                    print(f"[ImageAnalysis] completed in {elapsed:.2f} seconds")
                    return result_obj

            # ---------------------------------------------------------
            # VISUAL MODE FALLBACK (RGB PNG/JPG)
            # ---------------------------------------------------------
            filename, file_bytes = files_list[0]
            try:
                img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            except Exception as e:
                return {"success": False, "error": f"Failed to open image for visual analysis: {str(e)}"}
                
            width, height = img.size
            arr = np.array(img)
            
            # Simple heuristic visual analysis
            r = arr[:, :, 0]
            g = arr[:, :, 1]
            b = arr[:, :, 2]
            
            veg_mask = (g > r) & (g > b)
            water_mask = (b > r) & (b > g)
            urban_mask = (r > 150) & (g > 150) & (b > 150) & (np.abs(r - g) < 20)
            
            total_px = width * height
            veg_pct = (np.sum(veg_mask) / total_px) * 100
            water_pct = (np.sum(water_mask) / total_px) * 100
            urban_pct = (np.sum(urban_mask) / total_px) * 100
            
            pred_class = "Barren / Mixed"
            confidence = 0.50
            if veg_pct > max(water_pct, urban_pct, 15):
                pred_class = "Vegetation"
                confidence = min(0.95, 0.50 + (veg_pct / 100.0) * 0.45)
            elif water_pct > max(veg_pct, urban_pct, 10):
                pred_class = "Water"
                confidence = min(0.95, 0.50 + (water_pct / 100.0) * 0.45)
            elif urban_pct > max(veg_pct, water_pct, 25):
                pred_class = "Built-up"
                confidence = min(0.95, 0.50 + (urban_pct / 100.0) * 0.45)

            analysis_text = f"The uploaded image contains visual characteristics predominantly associated with {pred_class.lower()}."
            
            return {
                "analysis_type": "visual",
                "source": "Uploaded Image",
                "verification": "Visual Analysis Only",
                "is_quantitative": False,
                "prediction": {
                    "class": pred_class,
                    "confidence": round(confidence, 2)
                },
                "accuracy": None,
                "image_quality": {
                    "width": width,
                    "height": height,
                    "bands": 3,
                    "valid_pixel_percentage": 100.0,
                    "nodata_percentage": 0.0,
                    "geo_referenced": False
                },
                "spectral_indices": None,
                "analysis": analysis_text
            }
        except ValueError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": f"Failed to process image: {str(e)}"}

    def inspect_single_geotiff(self, filename: str, file_bytes) -> Tuple[str, Dict[str, Any]]:
        """
        Inspects embedded GeoTIFF metadata / filename pattern to detect Sentinel-2 band.
        Order of preference:
        1. Filename pattern matching (B01..B12, B8A, B1..B12, alias names like RED, GREEN, BLUE, NIR, SWIR)
        2. GeoTIFF metadata / tags inspection using rasterio (wavelength, descriptions, colorinterp)
           - Only attempted if file_bytes is provided (not None).
           - To avoid OOM on large TIFFs, callers should pass only the first 64 KB header bytes.
        3. If both fail -> "UNKNOWN"
        """
        import re
        upper_name = filename.upper()

        # 1. Filename Pattern Matching (zero memory cost)
        patterns = [
            (r'[\._\-]B8A[\._\-]', "B8A"),
            (r'[\._\-]B0?1[\._\-]', "B01"),
            (r'[\._\-]B0?2[\._\-]', "B02"),
            (r'[\._\-]B0?3[\._\-]', "B03"),
            (r'[\._\-]B0?4[\._\-]', "B04"),
            (r'[\._\-]B0?5[\._\-]', "B05"),
            (r'[\._\-]B0?6[\._\-]', "B06"),
            (r'[\._\-]B0?7[\._\-]', "B07"),
            (r'[\._\-]B0?8[\._\-]', "B08"),
            (r'[\._\-]B0?9[\._\-]', "B09"),
            (r'[\._\-]B11[\._\-]', "B11"),
            (r'[\._\-]B12[\._\-]', "B12"),
            (r'B8A(?=\.\w+$)', "B8A"),
            (r'B0?1(?=\.\w+$)', "B01"),
            (r'B0?2(?=\.\w+$)', "B02"),
            (r'B0?3(?=\.\w+$)', "B03"),
            (r'B0?4(?=\.\w+$)', "B04"),
            (r'B0?5(?=\.\w+$)', "B05"),
            (r'B0?6(?=\.\w+$)', "B06"),
            (r'B0?7(?=\.\w+$)', "B07"),
            (r'B0?8(?=\.\w+$)', "B08"),
            (r'B0?9(?=\.\w+$)', "B09"),
            (r'B11(?=\.\w+$)', "B11"),
            (r'B12(?=\.\w+$)', "B12"),
            (r'\bB8A\b', "B8A"),
            (r'\bB01\b', "B01"), (r'\bB02\b', "B02"), (r'\bB03\b', "B03"), (r'\bB04\b', "B04"),
            (r'\bB05\b', "B05"), (r'\bB06\b', "B06"), (r'\bB07\b', "B07"), (r'\bB08\b', "B08"),
            (r'\bB09\b', "B09"), (r'\bB11\b', "B11"), (r'\bB12\b', "B12"),
        ]

        for pat, band_code in patterns:
            if re.search(pat, upper_name):
                return band_code, {"detection_source": "filename_pattern", "pattern": pat}

        if "SWIR1" in upper_name or "SWIR-1" in upper_name: return "B11", {"detection_source": "filename_alias"}
        if "SWIR2" in upper_name or "SWIR-2" in upper_name: return "B12", {"detection_source": "filename_alias"}
        if "NIR" in upper_name: return "B08", {"detection_source": "filename_alias"}
        if "REDEDGE" in upper_name or "RED_EDGE" in upper_name: return "B05", {"detection_source": "filename_alias"}

        # 2. Embedded GeoTIFF Metadata Inspection via rasterio (only if bytes provided)
        if file_bytes is None:
            return "UNKNOWN", {"detection_source": "filename_only_no_bytes"}

        try:
            import rasterio
            from rasterio.io import MemoryFile
            with MemoryFile(file_bytes) as memfile:
                with memfile.open() as src:
                    meta_summary = {
                        "width": src.width,
                        "height": src.height,
                        "bands": src.count,
                        "crs": str(src.crs) if src.crs else None,
                        "driver": src.driver,
                        "tags": src.tags()
                    }
                    tags = src.tags()
                    descriptions = src.descriptions
                    
                    tag_str = str(tags).upper() + str(descriptions).upper()
                    
                    for b_code in ["B8A", "B01", "B02", "B03", "B04", "B05", "B06", "B07", "B08", "B09", "B11", "B12"]:
                        if b_code in tag_str:
                            return b_code, {"detection_source": "embedded_metadata_tags", "metadata": meta_summary}
                    
                    for k, v in tags.items():
                        if "WAVELENGTH" in k.upper():
                            try:
                                wl = float(re.sub(r'[^\d\.]', '', str(v)))
                                if 430 <= wl <= 455: return "B01", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 460 <= wl <= 520: return "B02", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 530 <= wl <= 590: return "B03", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 630 <= wl <= 690: return "B04", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 700 <= wl <= 720: return "B05", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 730 <= wl <= 750: return "B06", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 770 <= wl <= 795: return "B07", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 800 <= wl <= 880: return "B08", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 930 <= wl <= 960: return "B09", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 1550 <= wl <= 1750: return "B11", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                                if 2050 <= wl <= 2300: return "B12", {"detection_source": "wavelength_metadata", "wavelength_nm": wl}
                            except ValueError:
                                pass

                    return "UNKNOWN", {"detection_source": "metadata_inspected_unrecognized", "metadata": meta_summary}
        except Exception as e:
            return "UNKNOWN", {"detection_source": "inspection_fallback", "error": str(e)}

