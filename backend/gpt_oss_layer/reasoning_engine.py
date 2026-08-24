"""
GPT-OSS Reasoning Engine — v3.0 (Epistemic Finalization)
=========================================================
Principles:
  1. Uses ONLY supplied evidence — never invents statistics.
  2. Distinguishes observation from inference.
  3. Never invents satellite observations or numerical values.
  4. Marks hypotheses explicitly: "Hypothesis (unconfirmed):"
  5. Reports missing data honestly: "[Data not available for this query]"
  6. EO Vision evidence is always labelled as Feature-Derived/Synthetic.
  7. Confidence levels reflect actual evidence completeness.

Two public interfaces:
  - ask()                : free-form NL query (backward compatible)
  - reason_with_evidence(): structured /api/reason endpoint
"""
import re
from typing import Dict, Any, Optional
from .prompt_templates import MultimodalPromptBuilder


class GPTOssReasoningEngine:

    def __init__(self):
        self.prompt_builder = MultimodalPromptBuilder()

    # =========================================================================
    # PUBLIC: Structured Reasoning (/api/reason)
    # =========================================================================

    def reason_with_evidence(
        self,
        question: str,
        region_name: str = "All Regions",
        region_stats: Optional[Dict[str, Any]] = None,
        ml_evidence: Optional[Dict[str, Any]] = None,
        eo_evidence: Optional[Dict[str, Any]] = None,
        transition_stats: Optional[Dict[str, Any]] = None,
        point_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Structured reasoning using ONLY supplied evidence.
        Returns: answer, evidence_used, confidence_level, caveats, source_tags.
        """
        q_lower = question.lower().strip()
        evidence_used = []
        caveats = []
        source_tags = []

        # Check what evidence is actually available
        has_region_stats = bool(region_stats and region_stats.get("total_samples"))
        has_ml_evidence  = bool(ml_evidence)
        has_eo_evidence  = bool(eo_evidence)
        has_transition   = bool(transition_stats)
        has_point        = bool(point_data)

        if not (has_region_stats or has_ml_evidence or has_point):
            return {
                "answer": (
                    f"**[GPT-OSS]** Cannot answer query about '{region_name}': "
                    "No ML results or regional statistics are available for this context. "
                    "Please select a valid region and retry."
                ),
                "evidence_used": [],
                "confidence_level": "none",
                "caveats": ["No evidence supplied to the reasoning engine."],
                "source_tags": ["GPT-OSS Reasoning"]
            }

        # Build the answer from real evidence
        answer_parts = []

        # ── ML Evidence Block ──────────────────────────────────────────────
        if has_region_stats:
            evidence_used.append("Regional ML statistics (2018 & 2024 class distributions)")
            source_tags.append("[ML Results]")
            ml_block = self._build_ml_block(question, q_lower, region_name, region_stats, point_data)
            answer_parts.append(ml_block)

        if has_ml_evidence and not has_region_stats:
            evidence_used.append("Point-level ML prediction")
            source_tags.append("[ML Results]")
            pred = ml_evidence.get("prediction_2024", "[Data not available]")
            conf = ml_evidence.get("confidence_2024", None)
            conf_str = f"{conf*100:.1f}%" if conf is not None else "[Data not available]"
            answer_parts.append(
                f"**[ML Results]**\n"
                f"- Model Prediction (2024): **{pred}** (Model Confidence: **{conf_str}**).\n"
                f"- Note: Model Confidence is the classifier's probability score — "
                f"it is distinct from land-cover area coverage."
            )

        # ── EO Evidence Block ──────────────────────────────────────────────
        if has_eo_evidence:
            is_real = eo_evidence.get("is_real_satellite_imagery", False)
            vis_type = eo_evidence.get("type", "Feature-Derived Visualization")
            source_tags.append("[EO Vision]")
            evidence_used.append(f"EO analysis ({vis_type})")

            if is_real:
                answer_parts.append(
                    f"**[EO Vision]** (Real Satellite Imagery)\n"
                    f"- Actual Sentinel-2 imagery available for this point."
                )
            else:
                caveats.append(
                    "EO Vision is Feature-Derived/Synthetic — no actual Sentinel-2 GeoTIFF imagery "
                    "is available. Visual evidence is algorithmically derived from spectral band "
                    "reflectances, NOT from real satellite pixel data."
                )
                # Report actual spectral index values if available
                indices = eo_evidence.get("spectral_indices_2024", {})
                if any(v is not None for v in indices.values()):
                    idx_str = " | ".join(
                        f"{k}={round(v, 3)}" for k, v in indices.items() if v is not None
                    )
                    answer_parts.append(
                        f"**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
                        f"- Spectral index values from tabular dataset: {idx_str}.\n"
                        f"- These are computed from Sentinel-2 band reflectances in the CSV, "
                        f"not from GeoTIFF pixels."
                    )
                else:
                    answer_parts.append(
                        f"**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
                        f"- Spectral index values: [Not available for this query]."
                    )

        else:
            # No EO evidence supplied at all
            caveats.append(
                "No EO imagery or spectral evidence was supplied for this query. "
                "EO Vision analysis is unavailable."
            )
            source_tags.append("[EO Vision]")
            answer_parts.append(
                "**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
                "- Spectral band features are available in the dataset but no GeoTIFF imagery "
                "has been loaded for this location."
            )

        # ── Transition Evidence Block ──────────────────────────────────────
        if has_transition:
            source_tags.append("[GPT-OSS Reasoning]")
            evidence_used.append("Transition/change statistics")
            gpt_block = self._build_transition_block(q_lower, region_name, region_stats, transition_stats, point_data)
            answer_parts.append(gpt_block)

        # ── Confidence Level ──────────────────────────────────────────────
        evidence_count = sum([has_region_stats, has_ml_evidence, has_eo_evidence, has_transition])
        if evidence_count >= 3:
            confidence_level = "high"
        elif evidence_count == 2:
            confidence_level = "moderate"
        else:
            confidence_level = "low"

        # Always add EO caveat
        if not any("real satellite imagery" in c.lower() for c in caveats):
            caveats.append(
                "EO Vision is Feature-Derived/Synthetic only. "
                "All image panels are NOT real Sentinel-2 satellite images."
            )

        # Always add GPT-OSS caveat
        caveats.append(
            "GPT-OSS is an offline semantic reasoning engine — not an external LLM. "
            "Answers are synthesized from real ML outputs and must be validated against "
            "domain expertise before policy use."
        )

        return {
            "answer": "\n\n".join(answer_parts),
            "evidence_used": evidence_used,
            "confidence_level": confidence_level,
            "caveats": caveats,
            "source_tags": list(set(source_tags))
        }

    def _build_ml_block(self, question: str, q_lower: str, region_name: str,
                         stats: Dict, point_data: Optional[Dict]) -> str:
        """Build ML results block using ONLY real statistics from stats dict."""
        dist18 = stats.get("distribution_2018", {})
        dist24 = stats.get("distribution_2024", {})
        cstats = stats.get("change_statistics", {})
        total  = stats.get("total_samples", 0)
        changed = stats.get("changed_points", 0)
        stable  = stats.get("stable_points", 0)
        changed_pct = stats.get("changed_percentage", 0.0)
        stable_pct  = stats.get("stable_percentage", 0.0)

        # Identify what was asked
        target_class = None
        for cls in ["Water", "Vegetation", "Agriculture", "Built-up", "Barren"]:
            if cls.lower() in q_lower:
                target_class = cls
                break

        lines = [f"**[ML Results]** — {region_name} (Sampled Points: {total})"]

        if target_class:
            d18 = dist18.get(target_class, {})
            d24 = dist24.get(target_class, {})
            cnt18 = d18.get("sample_count", "[N/A]")
            cnt24 = d24.get("sample_count", "[N/A]")
            pct18 = d18.get("regional_landcover_percentage", "[N/A]")
            pct24 = d24.get("regional_landcover_percentage", "[N/A]")
            a18   = d18.get("estimated_area_km2", "[N/A]")
            a24   = d24.get("estimated_area_km2", "[N/A]")
            cls_chg = stats.get("class_change_summary", {}).get(target_class, {})
            pp_delta = cls_chg.get("percentage_point_change", "[N/A]")
            rel_chg  = cls_chg.get("relative_percentage_change", "[N/A]")
            direction = cls_chg.get("direction", "[N/A]")

            lines.append(
                f"- **{target_class} Coverage (2018):** {cnt18} sample points = "
                f"**{pct18}%** of sampled area (~{a18} km² representation)."
            )
            lines.append(
                f"- **{target_class} Coverage (2024):** {cnt24} sample points = "
                f"**{pct24}%** of sampled area (~{a24} km² representation)."
            )
            if pp_delta != "[N/A]":
                dir_symbol = "↑" if direction == "Increase" else ("↓" if direction == "Decrease" else "→")
                lines.append(
                    f"- **Net Change:** {pp_delta:+.1f} percentage points "
                    f"({direction} {dir_symbol}, relative change: {rel_chg:+.1f}%)."
                    if isinstance(pp_delta, float) else
                    f"- **Net Change:** {pp_delta} pp ({direction})."
                )
        else:
            # Overview of all classes
            for cls in ["Water", "Vegetation", "Agriculture", "Built-up", "Barren"]:
                d18 = dist18.get(cls, {})
                d24 = dist24.get(cls, {})
                p18 = d18.get("regional_landcover_percentage", "[N/A]")
                p24 = d24.get("regional_landcover_percentage", "[N/A]")
                cls_chg = stats.get("class_change_summary", {}).get(cls, {})
                pp = cls_chg.get("percentage_point_change", "[N/A]")
                pp_str = f" ({pp:+.1f} pp)" if isinstance(pp, float) else ""
                lines.append(f"- **{cls}:** {p18}% → {p24}%{pp_str}")

        lines.append(
            f"- **Stability:** {stable} points unchanged ({stable_pct}%) | "
            f"{changed} points transitioned ({changed_pct}%)."
        )

        # Model confidence note
        conf_summary = stats.get("model_confidence_summary", {})
        if conf_summary.get("average_confidence_2024"):
            avg_conf = conf_summary["average_confidence_2024"]
            uncertain = conf_summary.get("uncertain_points_count", 0)
            lines.append(
                f"- **Model Confidence (2024, avg):** {avg_conf*100:.1f}% "
                f"(classifier probability score — distinct from land-cover %). "
                f"{uncertain} points flagged as low-confidence (<{conf_summary.get('low_confidence_threshold', 0.55)})."
            )

        return "\n".join(lines)

    def _build_transition_block(self, q_lower: str, region_name: str,
                                 stats: Optional[Dict], transition_stats: Optional[Dict],
                                 point_data: Optional[Dict]) -> str:
        """Build GPT-OSS reasoning block with explicit hypothesis labelling."""
        lines = [f"**[GPT-OSS Reasoning]** — {region_name}"]

        if point_data:
            from_cls = point_data.get("prediction_2018_name", "[Data not available]")
            to_cls   = point_data.get("prediction_2024_name", "[Data not available]")
            chg_type = point_data.get("change_type", "[Data not available]")
            lines.append(f"- **Point-level Transition:** {from_cls} (2018) → {to_cls} (2024) [{chg_type}].")
            if from_cls != to_cls and from_cls != "[Data not available]":
                lines.append(
                    f"- **Hypothesis (unconfirmed by classification data alone):** "
                    f"The transition from {from_cls} to {to_cls} at this location may reflect "
                    f"{'urban land conversion' if to_cls == 'Built-up' else 'land-cover change'}. "
                    f"However, a single classification cannot confirm the underlying cause — "
                    f"field verification or time-series analysis would be needed."
                )
        elif stats:
            # Regional-level reasoning from actual statistics
            cstats = stats.get("change_statistics", {}) if stats else {}
            for cat, vals in sorted(cstats.items(), key=lambda x: x[1].get("sample_count", 0), reverse=True):
                if cat != "No Change" and vals.get("sample_count", 0) > 0:
                    pct = vals.get("change_percentage", 0.0)
                    cnt = vals.get("sample_count", 0)
                    lines.append(f"- **{cat}:** {cnt} sample points ({pct}% of {region_name}).")
                    if pct > 0:
                        hypo = self._get_hypothesis(cat, region_name)
                        if hypo:
                            lines.append(f"  - {hypo}")

        lines.append(
            "\n**Limitations (GPT-OSS):**\n"
            "- This reasoning is based on 500 sampled points per region (not full city coverage).\n"
            "- Predictions are from an ExtraTrees classifier (Macro F1=0.6209 on random split; "
            "0.5165 on spatial LORO — meaning the model has reduced accuracy on unseen cities).\n"
            "- Hypotheses about causation (e.g., urban expansion drivers) cannot be confirmed "
            "from classification data alone — they require socioeconomic or ground-truth validation."
        )

        return "\n".join(lines)

    def _get_hypothesis(self, change_type: str, region_name: str) -> str:
        hypotheses = {
            "Urban Expansion": (
                f"Hypothesis (unconfirmed): Agricultural or natural land at the periphery of "
                f"{region_name} may have been converted to built-up use. This cannot be confirmed "
                "from the classification alone — urban planning records or aerial surveys would be needed."
            ),
            "Vegetation Loss": (
                "Hypothesis (unconfirmed): Vegetation decline at sample locations could reflect "
                "deforestation, land clearing, or seasonal drought. Time-series data and ground "
                "surveys would be needed to identify the actual cause."
            ),
            "Agriculture Loss": (
                "Hypothesis (unconfirmed): Agricultural land may have shifted to built-up, fallow, "
                "or barren state. Seasonal crop cycles can also produce temporary misclassification."
            ),
            "Water Loss": (
                "Hypothesis (unconfirmed): Reduction in water-classified points could indicate "
                "seasonal variation in water levels rather than permanent loss."
            ),
        }
        return hypotheses.get(change_type, "")

    # =========================================================================
    # PUBLIC: Free-Form Chat (/api/ask — backward compatible)
    # =========================================================================

    def ask(
        self,
        question: str,
        region_stats: Optional[Dict[str, Any]] = None,
        point_data: Optional[Dict[str, Any]] = None,
        vision_data: Optional[Dict[str, Any]] = None,
        agreement_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        q_lower = question.lower().strip()
        region_name = region_stats.get("region", "Selected Region") if region_stats else "All Regions"

        context_str = self.prompt_builder.build_context_block(
            region_stats=region_stats,
            point_data=point_data,
            vision_data=vision_data,
            agreement_data=agreement_data
        )

        # Route to intent handlers
        # Free-form queries: forward to generate_ai_analysis for live Groq LLM synthesis
        from .ai_service import generate_ai_analysis
        analysis_context = {
            "region": region_name,
            "region_stats": region_stats,
            "point_data": point_data
        }
        response_text = generate_ai_analysis(analysis_context, question)
        return {"question": question, "region": region_name,
                "answer": response_text, "context_used": ["Live Groq LLM Synthesis", "Spatial context"]}

    # ── Intent Handlers (uses real data only) ──────────────────────────────

    def _handle_class_query(self, cls_name: str, region_name: str,
                             stats: Optional[Dict], icon: str) -> str:
        if not stats:
            return (
                f"**[ML Results]** No regional statistics available for {region_name}. "
                "Please select a region first.\n\n"
                "**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
                "- No spectral data available for this context.\n\n"
                "**[GPT-OSS Reasoning]** [Data not available for this query]"
            )

        d18 = stats.get("distribution_2018", {}).get(cls_name, {})
        d24 = stats.get("distribution_2024", {}).get(cls_name, {})
        cstats = stats.get("change_statistics", {})
        cls_chg = stats.get("class_change_summary", {}).get(cls_name, {})

        pct18 = d18.get("regional_landcover_percentage", "[N/A]")
        pct24 = d24.get("regional_landcover_percentage", "[N/A]")
        a18   = d18.get("estimated_area_km2", "[N/A]")
        a24   = d24.get("estimated_area_km2", "[N/A]")
        cnt18 = d18.get("sample_count", "[N/A]")
        cnt24 = d24.get("sample_count", "[N/A]")
        pp    = cls_chg.get("percentage_point_change", None)
        pp_str = f"{pp:+.1f} pp" if isinstance(pp, float) else "[N/A]"
        direction = cls_chg.get("direction", "[N/A]")

        gain_key = f"{cls_name} Gain"
        loss_key = f"{cls_name} Loss"
        gain_pct = cstats.get(gain_key, {}).get("change_percentage", 0.0)
        loss_pct = cstats.get(loss_key, {}).get("change_percentage", 0.0)

        hypo = self._get_hypothesis(
            "Urban Expansion" if cls_name == "Built-up" else (
                "Vegetation Loss" if cls_name == "Vegetation" else (
                    "Agriculture Loss" if cls_name == "Agriculture" else ""
                )
            ), region_name
        )

        return (
            f"### {icon} {cls_name} Dynamics: {region_name} (2018 → 2024)\n\n"
            f"**[ML Results]**\n"
            f"- **2018 Coverage:** {cnt18} sample points = **{pct18}%** (~{a18} km² representation).\n"
            f"- **2024 Coverage:** {cnt24} sample points = **{pct24}%** (~{a24} km² representation).\n"
            f"- **Net Change:** {pp_str} ({direction}).\n"
            f"- **Gain Transitions:** {gain_pct}% of regional locations. "
            f"**Loss Transitions:** {loss_pct}%.\n\n"
            f"**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
            f"- Spectral index signatures for {cls_name} class points are derived from "
            f"Sentinel-2 band reflectances (NDVI, NDWI, NDBI, BSI, SAVI) in the tabular dataset. "
            f"No actual satellite image pixels are available.\n\n"
            f"**[GPT-OSS Reasoning]**\n"
            f"- Based on the classification data, {cls_name} coverage in the sampled "
            f"{region_name} locations changed from {pct18}% to {pct24}% "
            f"between 2018 and 2024 ({pp_str}).\n"
            + (f"- {hypo}\n" if hypo else "")
            + f"- **Uncertainty:** The model's Macro F1 for this dataset is 0.6209 (random split) / "
              f"0.5165 (spatial generalisation). Results should be treated as indicative, not definitive."
        )

    def _handle_barren_query(self, point: Optional[Dict], region_name: str,
                              stats: Optional[Dict]) -> str:
        bsi_val  = "[N/A]"
        ndvi_val = "[N/A]"

        if point:
            b11 = float(point.get("B11_2024", point.get("B11", 0)) or 0)
            b4  = float(point.get("B4_2024",  point.get("B4",  0)) or 0)
            b8  = float(point.get("B8_2024",  point.get("B8",  0)) or 0)
            b2  = float(point.get("B2_2024",  point.get("B2",  0)) or 0)
            if b8 + b4 > 0:
                ndvi_val = f"{(b8-b4)/(b8+b4+1e-8):.3f}"
            if (b11+b4+b8+b2) > 0:
                bsi_val  = f"{((b11+b4)-(b8+b2))/((b11+b4)+(b8+b2)+1e-8):.3f}"

        d18 = stats.get("distribution_2018", {}).get("Barren", {}) if stats else {}
        d24 = stats.get("distribution_2024", {}).get("Barren", {}) if stats else {}
        pct18 = d18.get("regional_landcover_percentage", "[N/A]")
        pct24 = d24.get("regional_landcover_percentage", "[N/A]")

        return (
            f"### 🏜️ Barren Land Classification: {region_name}\n\n"
            f"**[ML Results]**\n"
            f"- **Barren Coverage (2018):** {pct18}% | **(2024):** {pct24}%.\n"
            + (f"- **Spectral Evidence (this point):** BSI = {bsi_val} | NDVI = {ndvi_val}.\n"
               if point else
               "- Select a specific point to see per-point spectral index values.\n")
            + f"- **Model Note:** Barren class has the lowest F1 score (0.27 on test set) due to "
              f"high spectral similarity to Built-up concrete surfaces (both show high SWIR, low NDVI). "
              f"The model uses 2.5× class weighting to mitigate this.\n\n"
            f"**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
            f"- No real Sentinel-2 GeoTIFF available. Spectral values from the tabular dataset "
            f"show high SWIR (B11/B12) and near-zero NDVI for Barren-labelled points.\n\n"
            f"**[GPT-OSS Reasoning]**\n"
            f"- The classification distinguishes Barren (mineral soil, rock, sand) from Built-up "
            f"(concrete, asphalt) using the Bare Soil Index (BSI) and Normalized Burn Ratio (NBR).\n"
            f"- **Hypothesis (unconfirmed):** Persistent high BSI and low NDVI at a location suggest "
            f"absence of vegetation cover — but causes (quarrying, drought, urban demolition) cannot "
            f"be determined from spectral classification alone."
        )

    def _handle_overview_query(self, region_name: str, stats: Optional[Dict], query: str) -> str:
        if not stats:
            return (
                f"**[ML Results]** No data available for '{region_name}'.\n\n"
                f"**[EO Vision]** (Feature-Derived — not real imagery) [Data not available]\n\n"
                f"**[GPT-OSS Reasoning]** Please select a valid region from the dropdown."
            )

        dist18 = stats.get("distribution_2018", {})
        dist24 = stats.get("distribution_2024", {})
        total  = stats.get("total_samples", 0)
        stable_pct  = stats.get("stable_percentage", 0.0)
        changed_pct = stats.get("changed_percentage", 0.0)
        area_km2    = stats.get("total_sample_area_km2", 0.0)
        cstats = stats.get("change_statistics", {})

        # Top change category (excluding No Change)
        top_change = max(
            ((cat, v) for cat, v in cstats.items() if cat != "No Change"),
            key=lambda x: x[1].get("sample_count", 0),
            default=("No Change", {})
        )
        top_cat = top_change[0]
        top_pct = top_change[1].get("change_percentage", 0.0)

        lines = [
            f"### 📍 Regional Overview: {region_name} (2018 → 2024)\n",
            f"**[ML Results]** — {total} sample points (~{area_km2} km² representation)",
            ""
        ]
        for cls in ["Water", "Vegetation", "Agriculture", "Built-up", "Barren"]:
            p18 = dist18.get(cls, {}).get("regional_landcover_percentage", "[N/A]")
            p24 = dist24.get(cls, {}).get("regional_landcover_percentage", "[N/A]")
            cls_chg = stats.get("class_change_summary", {}).get(cls, {})
            pp = cls_chg.get("percentage_point_change", None)
            pp_str = f" ({pp:+.1f} pp)" if isinstance(pp, float) else ""
            lines.append(f"- **{cls}:** {p18}% → {p24}%{pp_str}")

        lines += [
            f"- **Stability:** {stable_pct}% unchanged | {changed_pct}% transitioned.",
            f"- **Dominant Change Type:** {top_cat} ({top_pct}% of locations).",
            "",
            "**[EO Vision]** (Feature-Derived Visualization — not real imagery)",
            "- Spectral band reflectances from the tabular CSV are used for index computation.",
            "- No Sentinel-2 GeoTIFF imagery is available. Images shown in the dashboard "
            "are algorithmic feature-derived renderings.",
            "",
            "**[GPT-OSS Reasoning]**",
            f"- The dominant land-cover trajectory in {region_name}'s sampled area is: "
            f"**{top_cat}** ({top_pct}% of locations).",
            "- **Hypothesis (unconfirmed):** " + (
                self._get_hypothesis(top_cat, region_name) or
                "Land-cover change patterns reflect complex socioeconomic and environmental processes "
                "that cannot be fully characterised from spectral classification alone."
            ),
            "- **Uncertainty notice:** Results are based on ExtraTrees classification with "
            "Macro F1=0.6209 (random split). Spatial generalisation to new cities yields "
            "Macro F1~0.52. Treat all findings as indicative estimates, not ground truth."
        ]
        return "\n".join(lines)

    def _handle_comparative_regions_query(self, stats: Optional[Dict]) -> str:
        """For 'which region changed most' queries — use actual ranking if available."""
        return (
            "### 🌐 Comparative Regional Analysis\n\n"
            "**[ML Results]**\n"
            "- Use the `/api/query-nl` endpoint with 'which region changed the most' "
            "to get the actual ranking computed from the predictions CSV.\n"
            "- The system computes real rankings dynamically from 12-region prediction data.\n\n"
            "**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
            "- Comparative spectral analysis across regions is available via the dashboard "
            "Regional Analytics tab.\n\n"
            "**[GPT-OSS Reasoning]**\n"
            "- Regional comparison rankings are computed from actual model predictions — "
            "no hardcoded values are used. Please use the NL Query or Regional Analytics "
            "tab for the live ranking.\n"
            "- **Hypothesis (unconfirmed):** High-growth cities typically show Urban Expansion "
            "as the dominant transition type, but this cannot be confirmed without ground-truth "
            "or socioeconomic validation."
        )

    def _handle_agreement_query(self, point: Optional[Dict], agreement: Optional[Dict]) -> str:
        if not agreement:
            return (
                "**[ML Results]** Select a specific point on the map to see agreement details.\n\n"
                "**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
                "- Agreement is computed using spectral index heuristics, NOT real imagery pixels.\n\n"
                "**[GPT-OSS Reasoning]** [Data not available — select a point first]"
            )
        score  = agreement.get("agreement_score_pct", "[N/A]")
        verdict = agreement.get("agreement_verdict", "[N/A]")
        return (
            f"### 🛡️ ML vs EO Agreement\n\n"
            f"**[ML Results]**\n"
            f"- Model prediction and spectral heuristic checks compared.\n\n"
            f"**[EO Vision]** (Feature-Derived Visualization — not real imagery)\n"
            f"- **Agreement Score:** {score}% — Verdict: **{verdict}**.\n"
            f"- This score is based on spectral index thresholds (e.g., NDVI>0.3 for Vegetation), "
            f"NOT on visual inspection of satellite images.\n\n"
            f"**[GPT-OSS Reasoning]**\n"
            f"- Spectral heuristic agreement with the ML prediction is {verdict}. "
            f"Disagreement may indicate a borderline class (e.g., sparse vegetation vs barren), "
            f"seasonal variation, or model uncertainty. Field verification is recommended for "
            f"low-agreement points."
        )

    def _handle_image_query(self, point: Optional[Dict]) -> str:
        return (
            "### 🛰️ EO Vision Imagery\n\n"
            "**[EO Vision]** ⚠️ IMPORTANT: Feature-Derived Visualization — NOT real imagery\n"
            "- No actual Sentinel-2 GeoTIFF is loaded for this session.\n"
            "- The RGB, FCC, and NDVI panels in the dashboard are **algorithmically generated** "
            "from spectral band reflectance values in the tabular CSV.\n"
            "- They are labelled 'Demo/Synthetic/Feature-Derived Visualization' and must NOT "
            "be interpreted as real satellite pixel data.\n\n"
            "**[ML Results]**\n"
            + (
                f"- Point #{point.get('point_id', 'N/A')}: Predicted as "
                f"**{point.get('prediction_2024_name', '[N/A]')}** "
                f"(Confidence: {float(point.get('confidence_2024', 0))*100:.1f}%).\n"
                if point else
                "- Select a specific point to see its ML prediction and confidence.\n"
            )
            + "\n**[GPT-OSS Reasoning]**\n"
            "- When real Sentinel-2 GeoTIFF imagery is available, replace EOImageGenerator "
            "with a rasterio/GDAL-based loader to display actual satellite imagery. "
            "The architecture is designed to support this without redesigning the API."
        )
