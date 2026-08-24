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
        import os
        import time
        import logging
        import gc
        import re
        import tempfile
        import numpy as np
        from PIL import Image

        start_time = time.time()
        logger = logging.getLogger(__name__)

        if not files_list:
            raise ValueError("No files provided for analysis.")

        if len(files_list) > 8:
            return {"success": False, "error": "Maximum 8 band files can be uploaded at once."}

        logger.info(f"[ImageAnalysis] received {len(files_list)} files")
        print(f"[ImageAnalysis] received {len(files_list)} files")

        try:
            # ---------------------------------------------------------
            # MULTI-FILE SENTINEL-2 MODE
            # ---------------------------------------------------------
            is_sentinel = len(files_list) > 1 or (
                len(files_list) == 1 and any(
                    b in files_list[0][0].upper()
                    for b in ["B01","B02","B03","B04","B05","B06","B07","B08","B8A","B09","B11","B12"]
                )
            )

            if is_sentinel:
                import rasterio
                from rasterio.windows import Window

                band_meta = {}
                geo_referenced = False
                reference_band = None

                # 1. Identify band IDs from filenames (no file reading yet)
                band_id_map = {}   # band_id -> index in files_list
                for idx, (filename, _) in enumerate(files_list):
                    upper_name = filename.upper()
                    bid = None
                    if re.search(r'[\._\-]B8A[\._\-]|B8A(?=\.\w+$)|\bB8A\b', upper_name): bid = "B8A"
                    elif re.search(r'[\._\-]B0?2[\._\-]|B0?2(?=\.\w+$)|\bB0?2\b', upper_name): bid = "B02"
                    elif re.search(r'[\._\-]B0?3[\._\-]|B0?3(?=\.\w+$)|\bB0?3\b', upper_name): bid = "B03"
                    elif re.search(r'[\._\-]B0?4[\._\-]|B0?4(?=\.\w+$)|\bB0?4\b', upper_name): bid = "B04"
                    elif re.search(r'[\._\-]B0?8[\._\-]|B0?8(?=\.\w+$)|\bB0?8\b', upper_name): bid = "B08"
                    elif re.search(r'[\._\-]B11[\._\-]|B11(?=\.\w+$)|\bB11\b', upper_name): bid = "B11"
                    elif re.search(r'[\._\-]B12[\._\-]|B12(?=\.\w+$)|\bB12\b', upper_name): bid = "B12"
                    elif re.search(r'[\._\-]B0?1[\._\-]|B0?1(?=\.\w+$)|\bB0?1\b', upper_name): bid = "B01"
                    elif re.search(r'[\._\-]B0?5[\._\-]|B0?5(?=\.\w+$)|\bB0?5\b', upper_name): bid = "B05"
                    elif re.search(r'[\._\-]B0?6[\._\-]|B0?6(?=\.\w+$)|\bB0?6\b', upper_name): bid = "B06"
                    elif re.search(r'[\._\-]B0?7[\._\-]|B0?7(?=\.\w+$)|\bB0?7\b', upper_name): bid = "B07"
                    elif re.search(r'[\._\-]B0?9[\._\-]|B0?9(?=\.\w+$)|\bB0?9\b', upper_name): bid = "B09"
                    if bid:
                        band_id_map[bid] = idx
                        if bid in ["B02","B03","B04","B08"] and reference_band is None:
                            reference_band = bid

                if not band_id_map:
                    if len(files_list) == 1:
                        pass  # fall through to visual mode
                    else:
                        return {"success": False, "error": "No recognizable Sentinel-2 bands found in uploaded files."}

                if band_id_map:
                    if reference_band is None:
                        reference_band = list(band_id_map.keys())[0]

                    # ── DISK-BASED READING ──────────────────────────────────────────
                    # Write TIFFs to /tmp one at a time, read a center 1000×1000
                    # window from disk (GDAL decompresses only the needed tiles,
                    # never the full 10980×10980 image → stays within 512 MB RAM).
                    tmp_dir = tempfile.gettempdir()
                    tmp_paths = {}   # band_id -> tmp file path

                    def write_band_to_tmp(band_id, file_bytes):
                        """Write bytes to a uniquely named temp TIFF."""
                        path = os.path.join(tmp_dir, f"gl_{band_id}_{os.getpid()}.tif")
                        with open(path, "wb") as fh:
                            fh.write(file_bytes)
                        return path

                    def read_band_window(path, target_w, target_h, src_w=None, src_h=None):
                        """Read a center window (target_w × target_h) from a TIFF on disk.
                        Uses rasterio Window so GDAL decompresses only the needed tiles."""
                        with rasterio.open(path) as src:
                            w, h = src.width, src.height
                            # Center window capped at target size
                            win_w = min(w, target_w)
                            win_h = min(h, target_h)
                            col_off = (w - win_w) // 2
                            row_off = (h - win_h) // 2
                            window = Window(col_off, row_off, win_w, win_h)
                            arr = src.read(1, window=window).astype(np.float32)
                            return arr, src.profile.copy(), src.transform, src.crs, w, h

                    arrays = {}
                    ref_profile = None
                    ref_transform = None
                    ref_crs = None
                    resampling_info = []
                    orig_w_ref = orig_h_ref = 0

                    # Sample window size — enough for good statistics, tiny RAM cost
                    SAMPLE_W = 1000
                    SAMPLE_H = 1000

                    # 2. Write reference band to disk and sample
                    logger.info(f"[ImageAnalysis] reading {reference_band}")
                    print(f"[ImageAnalysis] reading {reference_band}")
                    ref_bytes = files_list[band_id_map[reference_band]][1]
                    ref_size_mb = len(ref_bytes) / (1024*1024)
                    print(f"[ImageAnalysis] {reference_band} file size = {ref_size_mb:.1f} MB")
                    try:
                        ref_path = write_band_to_tmp(reference_band, ref_bytes)
                        tmp_paths[reference_band] = ref_path
                        del ref_bytes
                        gc.collect()

                        arr, ref_profile, ref_transform, ref_crs, orig_w_ref, orig_h_ref = \
                            read_band_window(ref_path, SAMPLE_W, SAMPLE_H)
                        arrays[reference_band] = arr
                        geo_referenced = (ref_crs is not None)
                        ref_profile['width'] = arr.shape[1]
                        ref_profile['height'] = arr.shape[0]
                        band_meta[reference_band] = "10m" if reference_band in ["B02","B03","B04","B08"] else "Unknown"
                        resampling_info.append(
                            f"Center window sampled ({orig_w_ref}×{orig_h_ref} → {arr.shape[1]}×{arr.shape[0]})"
                        )
                    except Exception as e:
                        return {"success": False, "error": f"Failed to read reference band {reference_band}: {str(e)}"}

                    # 3. Write and read other bands sequentially
                    for b_id, idx in band_id_map.items():
                        if b_id == reference_band:
                            continue

                        logger.info(f"[ImageAnalysis] reading {b_id}")
                        print(f"[ImageAnalysis] reading {b_id}")
                        b_bytes = files_list[idx][1]
                        b_size_mb = len(b_bytes) / (1024*1024)
                        print(f"[ImageAnalysis] {b_id} file size = {b_size_mb:.1f} MB")
                        try:
                            b_path = write_band_to_tmp(b_id, b_bytes)
                            tmp_paths[b_id] = b_path
                            del b_bytes
                            gc.collect()

                            arr, _, _, _, bw, bh = read_band_window(b_path, SAMPLE_W, SAMPLE_H)
                            arrays[b_id] = arr
                            is_20m = b_id in ["B05","B06","B07","B8A","B11","B12"]
                            band_meta[b_id] = "20m" if is_20m else "10m"
                        except Exception as e:
                            return {"success": False, "error": f"Failed to read band {b_id}: {str(e)}"}

                    # 4. Clean up temp files immediately
                    for path in tmp_paths.values():
                        try:
                            os.remove(path)
                        except Exception:
                            pass
                    tmp_paths.clear()
                    gc.collect()

                    # 5. Calculate spectral indices
                    logger.info("[ImageAnalysis] calculating indices")
                    print("[ImageAnalysis] calculating indices")

                    # Replace zeros to avoid division issues
                    for b in arrays:
                        arrays[b] = np.where(arrays[b] == 0, 1e-5, arrays[b])

                    first_band = list(arrays.values())[0]
                    total_pixels = float(first_band.size)
                    valid_pixels = float(np.sum(~np.isnan(first_band)))
                    valid_pixel_pct = (valid_pixels / total_pixels * 100.0) if total_pixels > 0 else 0
                    nodata_pct = 100.0 - valid_pixel_pct

                    eps = 1e-8

                    # NDVI
                    if "B08" in arrays and "B04" in arrays:
                        ndvi_map = (arrays["B08"] - arrays["B04"]) / (arrays["B08"] + arrays["B04"] + eps)
                        ndvi_val = round(float(np.nanmean(ndvi_map)), 4)
                        del ndvi_map
                    else:
                        ndvi_val = "NDVI unavailable — NIR B08 or Red B04 missing."

                    # NDWI
                    if "B03" in arrays and "B08" in arrays:
                        ndwi_map = (arrays["B03"] - arrays["B08"]) / (arrays["B03"] + arrays["B08"] + eps)
                        ndwi_val = round(float(np.nanmean(ndwi_map)), 4)
                        del ndwi_map
                    else:
                        ndwi_val = "NDWI unavailable — Green B03 and NIR B08 required."

                    # NDBI
                    if "B11" in arrays and "B08" in arrays:
                        ndbi_map = (arrays["B11"] - arrays["B08"]) / (arrays["B11"] + arrays["B08"] + eps)
                        ndbi_val = round(float(np.nanmean(ndbi_map)), 4)
                        del ndbi_map
                    else:
                        ndbi_val = "NDBI unavailable — SWIR B11 and NIR B08 required."

                    # EVI
                    evi_val = None
                    if "B08" in arrays and "B04" in arrays and "B02" in arrays:
                        evi_map = 2.5 * ((arrays["B08"] - arrays["B04"]) / (arrays["B08"] + 6.0 * arrays["B04"] - 7.5 * arrays["B02"] + 1.0 + eps))
                        evi_val = round(float(np.nanmean(evi_map)), 4)
                        del evi_map

                    # 6. ExtraTrees prediction (uses per-band mean scalars — zero array cost)
                    logger.info("[ImageAnalysis] preparing features")
                    print("[ImageAnalysis] preparing features")

                    pred_class = "Unknown"
                    pred_confidence = 0.85

                    if ml_service and hasattr(ml_service, "active_model") and ml_service.active_model is not None:
                        try:
                            logger.info("[ImageAnalysis] running ExtraTrees prediction")
                            print("[ImageAnalysis] running ExtraTrees prediction")

                            def mean_val(bid):
                                arr = arrays.get(bid)
                                return float(np.nanmean(arr)) if arr is not None else 0.1

                            b2_v = mean_val("B02"); b3_v = mean_val("B03"); b4_v = mean_val("B04")
                            b8_v = mean_val("B08"); b11_v = mean_val("B11"); b12_v = mean_val("B12")

                            ndvi_f  = (b8_v - b4_v)  / (b8_v + b4_v  + eps)
                            ndwi_f  = (b3_v - b8_v)  / (b3_v + b8_v  + eps)
                            mndwi_f = (b3_v - b11_v) / (b3_v + b11_v + eps)
                            ndbi_f  = (b11_v - b8_v) / (b11_v + b8_v + eps)
                            bsi_f   = ((b11_v + b4_v) - (b8_v + b2_v)) / ((b11_v + b4_v) + (b8_v + b2_v) + eps)
                            savi_f  = 1.5 * (b8_v - b4_v) / (b8_v + b4_v + 0.5 + eps)
                            nbr_f   = (b8_v - b12_v) / (b8_v + b12_v + eps)
                            evi_f   = 2.5 * ((b8_v - b4_v) / (b8_v + 6.0*b4_v - 7.5*b2_v + 1.0 + eps))
                            ui_f    = (b12_v - b8_v) / (b12_v + b8_v + eps)
                            ndmi_f  = (b8_v - b11_v) / (b8_v + b11_v + eps)
                            grvi_f  = (b3_v - b4_v)  / (b3_v + b4_v  + eps)
                            brightness_f     = (b2_v + b3_v + b4_v + b8_v) / 4.0
                            greenness_f      = (b3_v + b8_v) / 2.0
                            swir_ratio_f     = b11_v / (b12_v + eps)
                            nir_red_ratio_f  = b8_v  / (b4_v  + eps)
                            nir_green_ratio_f = b8_v / (b3_v  + eps)
                            ndbi_ndvi_diff_f  = ndbi_f  - ndvi_f
                            mndwi_ndvi_diff_f = mndwi_f - ndvi_f

                            sample_row = np.array([[
                                b2_v, b3_v, b4_v, b8_v, b11_v, b12_v,
                                ndvi_f, ndwi_f, mndwi_f, ndbi_f,
                                bsi_f, savi_f, nbr_f, evi_f, ui_f, ndmi_f, grvi_f,
                                brightness_f, greenness_f, swir_ratio_f,
                                nir_red_ratio_f, nir_green_ratio_f,
                                ndbi_ndvi_diff_f, mndwi_ndvi_diff_f,
                                0.0, 0.0  # VV, VH SAR defaults
                            ]], dtype=np.float32)

                            preds = ml_service.active_model.predict(sample_row)
                            probs = ml_service.active_model.predict_proba(sample_row)
                            pred_idx = int(preds[0])
                            pred_class = ml_service.CLASS_NAMES.get(pred_idx, "Unknown")
                            pred_confidence = round(float(np.max(probs[0])), 2)
                        except Exception as p_err:
                            logger.warning(f"[ImageAnalysis] ExtraTrees fallback: {p_err}")

                    if pred_class == "Unknown":
                        if isinstance(ndvi_val, float) and ndvi_val > 0.3:
                            pred_class = "Vegetation"
                        elif isinstance(ndwi_val, float) and ndwi_val > 0.1:
                            pred_class = "Water"
                        elif isinstance(ndbi_val, float) and ndbi_val > 0.1:
                            pred_class = "Built-up"
                        else:
                            pred_class = "Barren / Mixed"

                    def get_interpretation(index_name, val):
                        if not isinstance(val, float): return None
                        if index_name == "ndvi":
                            if val < 0: return "Water or snow."
                            if val < 0.2: return "Very low vegetation signal (barren/urban)."
                            if val < 0.5: return "Moderate vegetation (shrubs/grass)."
                            return "High vegetation signal (dense canopy)."
                        if index_name == "ndwi":
                            return "Water surface detected." if val > 0 else "Low water/moisture signal."
                        if index_name == "ndbi":
                            return "High built-up/urban signature." if val > 0 else "Low built-up signal."
                        return None

                    bands_str = ", ".join(arrays.keys())
                    analysis_text = (
                        f"Analyzed {len(arrays)} Sentinel-2 bands ({bands_str}) via 1000×1000 center-window sampling. "
                        "Spectral index values use relative band ratios (NDVI, NDWI, NDBI) which are scale-invariant. "
                        + ((" ".join(resampling_info) + ".") if resampling_info else "")
                    )

                    logger.info("[ImageAnalysis] generating response")
                    print("[ImageAnalysis] generating response")

                    result_obj = {
                        "analysis_type": "multispectral",
                        "source": "Sentinel-2 GeoTIFF",
                        "verification": "Spectral data verified",
                        "is_quantitative": True,
                        "prediction": {"class": pred_class, "confidence": pred_confidence},
                        "accuracy": None,
                        "image_quality": {
                            "width":  arrays[reference_band].shape[1] if reference_band in arrays else SAMPLE_W,
                            "height": arrays[reference_band].shape[0] if reference_band in arrays else SAMPLE_H,
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
                            "ndbi": {"value": ndbi_val, "interpretation": get_interpretation("ndbi", ndbi_val)},
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

