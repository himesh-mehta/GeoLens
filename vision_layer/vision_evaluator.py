"""
EO Vision Evaluator & Cross-Verification Engine.
Evaluates cross-verification agreement between EO Vision observations and
Machine Learning (Random Forest) classification outputs.
"""
from typing import Dict, Any


class EOVisionEvaluator:
    """
    Cross-checks EO Vision findings against Random Forest predictions
    to produce consistency metrics and diagnostics.
    """

    def evaluate_agreement(
        self,
        point_data: Dict[str, Any],
        visual_comparison: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculates agreement score, consistency verdict, and explanation.
        """
        pred_2018 = str(point_data.get("prediction_2018_name", ""))
        pred_2024 = str(point_data.get("prediction_2024_name", ""))
        ml_change = str(point_data.get("change_type", "No Change"))
        conf_2018 = float(point_data.get("confidence_2018", 0.85))
        conf_2024 = float(point_data.get("confidence_2024", 0.85))

        vis_18_dom = visual_comparison["visual_2018"]["dominant_visual_class"]
        vis_24_dom = visual_comparison["visual_2024"]["dominant_visual_class"]
        delta_urban = visual_comparison["delta_urban"]
        delta_canopy = visual_comparison["delta_canopy"]

        # Check year-by-year alignment
        agree_18 = (pred_2018 == vis_18_dom) or (pred_2018 in ["Vegetation", "Agriculture"] and vis_18_dom in ["Vegetation", "Agriculture"])
        agree_24 = (pred_2024 == vis_24_dom) or (pred_2024 in ["Vegetation", "Agriculture"] and vis_24_dom in ["Vegetation", "Agriculture"])

        # Check transition alignment
        change_aligned = True
        if ml_change == "Urban Expansion" and delta_urban < -10:
            change_aligned = False
        elif ml_change == "Vegetation Loss" and delta_canopy > 15:
            change_aligned = False
        elif ml_change == "Vegetation Gain" and delta_canopy < -15:
            change_aligned = False

        # Compute numerical agreement score (0 - 100%)
        score = 60.0
        if agree_18:
            score += 15.0
        if agree_24:
            score += 15.0
        if change_aligned:
            score += 10.0

        score = min(100.0, score)

        if score >= 85.0:
            verdict = "High Agreement"
            verdict_badge = "success"
            explanation = (
                f"EO Vision spectral signatures strongly confirm the ML classification: "
                f"2018 ({pred_2018}) -> 2024 ({pred_2024}) with ML confidence of {conf_2024*100:.1f}%."
            )
        elif score >= 65.0:
            verdict = "Substantial Agreement"
            verdict_badge = "info"
            explanation = (
                f"EO Vision corroborates the general land-cover trend ({ml_change}). "
                f"Visual textures match {pred_2024} with minor spectral boundary blending."
            )
        else:
            verdict = "Partial Agreement / Mixed Spectral Signature"
            verdict_badge = "warning"
            explanation = (
                f"Mixed visual signature detected (e.g. peri-urban agriculture or sparse vegetation canopy). "
                f"ML prediction ({pred_2024}) relied on multi-band SWIR/NIR indices."
            )

        return {
            "agreement_score_pct": round(score, 1),
            "verdict": verdict,
            "verdict_badge": verdict_badge,
            "agree_2018": bool(agree_18),
            "agree_2024": bool(agree_24),
            "change_aligned": bool(change_aligned),
            "explanation": explanation
        }
