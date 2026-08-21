"""
Prompt Templates and Multimodal Context Assembler for GPT-OSS.
Formats ML predictions, confidence scores, regional change statistics,
and EO Vision observations into structured context prompts.
"""
from typing import Dict, Any, Optional


class MultimodalPromptBuilder:
    """
    Constructs rich prompt contexts containing tabular ML metrics,
    geospatial attributes, and optical vision observations.
    """

    @staticmethod
    def build_system_prompt() -> str:
        return (
            "You are GPT-OSS, an Earth Observation (EO) and Geospatial AI reasoning agent "
            "designed for the Smart India Hackathon (SIH). You specialize in multi-temporal "
            "satellite imagery interpretation, land-cover dynamics, and cross-verifying "
            "Machine Learning classification outputs with computer vision observations.\n"
            "CORE RULES:\n"
            "1. Google Earth Engine (GEE) is the absolute numerical source of truth for satellite metrics (NDVI, NDWI, etc.).\n"
            "2. ML handles only land-cover classification.\n"
            "3. You act strictly as an interpreter. You MUST NEVER invent, estimate, synthesize, or modify numerical satellite measurements or spectral index values.\n"
            "4. If a value is missing or unavailable, clearly state that it is unavailable.\n"
            "5. RGB images are used for qualitative visual analysis only, not quantitative spectral indexing.\n"
            "Explain technical findings in simple, clear, and actionable language with concise bullet points."
        )

    @staticmethod
    def build_context_block(
        region_stats: Optional[Dict[str, Any]] = None,
        point_data: Optional[Dict[str, Any]] = None,
        vision_data: Optional[Dict[str, Any]] = None,
        agreement_data: Optional[Dict[str, Any]] = None
    ) -> str:
        lines = []

        # Region context
        if region_stats:
            reg_name = region_stats.get("region", "All Regions")
            total = region_stats.get("total_samples", 0)
            lines.append(f"### REGIONAL CONTEXT: {reg_name} (Total Points Analyzed: {total})")

            # 2018 vs 2024 Distribution
            dist18 = region_stats.get("distribution_2018", {})
            dist24 = region_stats.get("distribution_2024", {})
            
            def format_dist_items(d):
                items = []
                for k, v in d.items():
                    pct = v.get("regional_landcover_percentage", v.get("pct", 0.0))
                    cnt = v.get("sample_count", v.get("count", 0))
                    items.append(f"{k}: {pct}% ({cnt})")
                return ", ".join(items)

            def format_change_items(d):
                items = []
                for k, v in list(d.items())[:5]:
                    pct = v.get("change_percentage", v.get("pct", 0.0))
                    cnt = v.get("sample_count", v.get("count", 0))
                    items.append(f"{k}: {pct}% ({cnt})")
                return ", ".join(items)

            if dist18:
                lines.append("- 2018 Land Cover: " + format_dist_items(dist18))
            if dist24:
                lines.append("- 2024 Land Cover: " + format_dist_items(dist24))

            # Change Stats
            cstats = region_stats.get("change_statistics", {})
            if cstats:
                lines.append("- Key Change Categories: " + format_change_items(cstats))

        # Specific point context
        if point_data:
            pid = point_data.get("point_id", "N/A")
            lat = point_data.get("latitude", "N/A")
            lon = point_data.get("longitude", "N/A")
            p18 = point_data.get("prediction_2018_name", "N/A")
            c18 = float(point_data.get("confidence_2018", 0.0)) * 100
            p24 = point_data.get("prediction_2024_name", "N/A")
            c24 = float(point_data.get("confidence_2024", 0.0)) * 100
            chg = point_data.get("change_type", "No Change")

            lines.append(f"\n### INSPECTED POINT CONTEXT (Point #{pid} at Lat: {lat}, Lon: {lon})")
            lines.append(f"- 2018 ML Prediction: {p18} (Confidence: {c18:.1f}%)")
            lines.append(f"- 2024 ML Prediction: {p24} (Confidence: {c24:.1f}%)")
            lines.append(f"- ML Change Classification: {chg}")

        # Vision observations
        if vision_data:
            lines.append("\n### EO VISION OBSERVATIONS")
            lines.append(f"- Visual Summary: {vision_data.get('visual_summary', 'Normal spectral signature.')}")
            lines.append(f"- Canopy Shift: {vision_data.get('delta_canopy', 0.0)}% | Urban Texture Shift: {vision_data.get('delta_urban', 0.0)}%")
            lines.append(f"- Water Surface Shift: {vision_data.get('delta_water', 0.0)}% | Barren Soil Shift: {vision_data.get('delta_barren', 0.0)}%")

        # Agreement verdict
        if agreement_data:
            lines.append("\n### VISION vs ML VERIFICATION")
            lines.append(f"- Agreement Score: {agreement_data.get('agreement_score_pct', 0.0)}% ({agreement_data.get('verdict', 'N/A')})")
            lines.append(f"- Diagnostic: {agreement_data.get('explanation', '')}")

        return "\n".join(lines)
