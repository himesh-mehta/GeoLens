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
        Extracts visual characteristics from an observation.
        """
        suffix = f"_{year}"
        b2 = float(point_data.get(f"B2{suffix}", point_data.get("B2", 0.08)))
        b3 = float(point_data.get(f"B3{suffix}", point_data.get("B3", 0.10)))
        b4 = float(point_data.get(f"B4{suffix}", point_data.get("B4", 0.12)))
        b8 = float(point_data.get(f"B8{suffix}", point_data.get("B8", 0.25)))
        b11 = float(point_data.get(f"B11{suffix}", point_data.get("B11", 0.20)))
        b12 = float(point_data.get(f"B12{suffix}", point_data.get("B12", 0.15)))

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
            "visual_2018": vis_2018,
            "visual_2024": vis_2024,
            "delta_canopy": delta_canopy,
            "delta_urban": delta_urban,
            "delta_water": delta_water,
            "delta_barren": delta_barren,
            "visual_findings": findings,
            "visual_summary": summary_text
        }
