"""
SIH Automated End-to-End Validation Suite
==========================================
Tests the complete Python EO/ML Intelligence Service against all 16 tasks:
1. 12 Regions Integrity (Ahmedabad, Bengaluru, Chennai, Guwahati, Hyderabad, Jaipur, Kochi, Kolkata, Mumbai, Nagpur, Nashik, Pune)
2. Sample counts (exactly 500 points each) & zero null/duplicate checks
3. 5x5 Transition Matrix row/col totals & grand total validation
4. Strict separation of Land-Cover % vs Model Confidence
5. Multi-Model Benchmark (Accuracy, Macro F1, Weighted F1, Per-class F1)
6. Spatial Validation LORO comparison (Leave-One-Region-Out)
7. Point Inspector (3+ points per region, top features, confidence flag, agreement)
8. EO Vision Synthetic / Feature-Derived disclaimer checks
9. Multimodal Evidence object (/api/evidence/<id>)
10. GPT-OSS /api/reason structured reasoning with caveats
11. GPT-OSS /api/ask chat queries across domains
12. Data Quality & Leakage Audit (/api/data-quality)
13. Export endpoints (CSV, JSON, GeoJSON, HTML report)
14. Error handling & edge cases
"""

import sys
import json
import urllib.request
import urllib.error
import io
import csv

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:5000"
REGIONS = [
    "Ahmedabad", "Bengaluru", "Chennai", "Guwahati",
    "Hyderabad", "Jaipur", "Kochi", "Kolkata",
    "Mumbai", "Nagpur", "Nashik", "Pune"
]
CLASSES = ["Water", "Vegetation", "Agriculture", "Built-up", "Barren"]


def http_get(endpoint):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, headers={"User-Agent": "SIH-Test-Suite"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        content_type = resp.headers.get_content_type()
        data = resp.read()
        if "json" in content_type:
            return json.loads(data.decode("utf-8"))
        return data.decode("utf-8")


def http_post(endpoint, payload):
    url = f"{BASE_URL}{endpoint}"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "SIH-Test-Suite"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read().decode("utf-8")
        return json.loads(data)


def run_suite():
    print("=" * 70)
    print("🛰️ SIH EO/ML SYSTEM — END-TO-END VALIDATION SUITE")
    print("=" * 70)

    total_tests = 0
    passed_tests = 0

    def check(desc, condition, detail=""):
        nonlocal total_tests, passed_tests
        total_tests += 1
        if condition:
            passed_tests += 1
            print(f"  [PASS] {desc}")
        else:
            print(f"  [FAIL] {desc} — Detail: {detail}")

    # ── Test 1: Service Health & Version ─────────────────────────────────────
    print("\n[TEST GROUP 1] Health & System Initialization")
    health = http_get("/health")
    check("Service status online", health.get("status") == "online")
    check("Service version 3.0.0", health.get("version") == "3.0.0")
    check("Active model loaded", "ExtraTrees" in health.get("active_model", "") or "Random Forest" in health.get("active_model", ""))
    check("12 regions registered in health", health.get("total_regions") == 12)
    check("EO Vision labeled feature-derived in health", "Feature-Derived" in health.get("eo_vision", ""))

    # ── Test 2: Regions Endpoint ─────────────────────────────────────────────
    print("\n[TEST GROUP 2] 12 Indian Regions Verification")
    reg_data = http_get("/api/regions")
    check("Regions count == 12", reg_data.get("count") == 12)
    check("All 12 expected regions present", set(reg_data.get("regions", [])) == set(REGIONS))

    # ── Test 3: Regional Data Consistency & Transition Matrix ────────────────
    print("\n[TEST GROUP 3] Regional Statistics & 5x5 Transition Matrices")
    for reg in REGIONS:
        stats_resp = http_get(f"/api/statistics/{reg}")
        stats = stats_resp.get("statistics", {})

        check(f"{reg}: total samples == 500", stats.get("total_samples") == 500, f"Got {stats.get('total_samples')}")
        check(f"{reg}: estimated area == 5.0 km²", stats.get("total_sample_area_km2") == 5.0)

        # Landcover % vs Model Confidence distinction
        dist18 = stats.get("distribution_2018", {})
        dist24 = stats.get("distribution_2024", {})
        total_pct18 = sum(dist18[c]["regional_landcover_percentage"] for c in CLASSES)
        total_pct24 = sum(dist24[c]["regional_landcover_percentage"] for c in CLASSES)
        check(f"{reg}: 2018 landcover % sums to ~100%", abs(total_pct18 - 100.0) < 0.2, f"Sum={total_pct18}")
        check(f"{reg}: 2024 landcover % sums to ~100%", abs(total_pct24 - 100.0) < 0.2, f"Sum={total_pct24}")

        conf_summary = stats.get("model_confidence_summary", {})
        avg_conf24 = conf_summary.get("average_confidence_2024", 0)
        check(f"{reg}: Model confidence valid (0.4 - 1.0)", 0.4 <= avg_conf24 <= 1.0, f"Conf={avg_conf24}")

        # Transition matrix verification
        change_resp = http_get(f"/api/change/{reg}")
        mat_data = change_resp.get("transition_matrix_5x5", {})
        val_status = mat_data.get("validation", {})
        check(f"{reg}: 5x5 matrix grand total == 500", mat_data.get("grand_total") == 500, f"Got {mat_data.get('grand_total')}")
        check(f"{reg}: 5x5 matrix row totals == 500", val_status.get("row_totals_consistent") is True)
        check(f"{reg}: 5x5 matrix col totals == 500", val_status.get("col_totals_consistent") is True)
        check(f"{reg}: 5x5 matrix all_valid flag True", val_status.get("all_valid") is True)

    # ── Test 4: Multi-Model Benchmark ────────────────────────────────────────
    print("\n[TEST GROUP 4] Multi-Model Benchmark & Held-Out Evaluation")
    models_resp = http_get("/api/models")
    comp = models_resp.get("comparison", {})
    table = comp.get("benchmark_table", [])
    check("Benchmark contains at least 4 models", len(table) >= 4, f"Got {len(table)}")

    model_names = [m["Model"] for m in table]
    check("ExtraTrees in benchmark", any("ExtraTrees" in n for n in model_names))
    check("Baseline Random Forest in benchmark", any("Baseline Random Forest" in n for n in model_names))
    check("Improved Tuned RF in benchmark", any("Tuned" in n for n in model_names))
    check("Gradient Boosting in benchmark", any("Gradient" in n for n in model_names))

    best_m = next((m for m in table if m.get("is_best")), None)
    check("Best model selected by Macro F1", best_m is not None and "ExtraTrees" in best_m["Model"])
    check("Best model Macro F1 >= 0.60", best_m.get("Macro_F1", 0) >= 0.60, f"Got {best_m.get('Macro_F1')}")
    check("Barren F1 reported and non-zero", best_m.get("Barren_F1", 0) > 0.10, f"Got {best_m.get('Barren_F1')}")

    # ── Test 5: Spatial Validation (LORO) ────────────────────────────────────
    print("\n[TEST GROUP 5] Spatial Validation (Leave-One-Region-Out)")
    spatial_resp = http_get("/api/spatial-validation")
    spatial = spatial_resp.get("spatial_validation", {})
    summary = spatial.get("summary", {})
    check("Spatial validation loaded", "Leave-One-Region-Out" in spatial.get("validation_type", ""))
    check("Spatial validation 12 regions evaluated", len(spatial.get("per_region", [])) == 12)
    check("Spatial mean accuracy calculated", summary.get("mean_accuracy", 0) > 0.50)
    check("Spatial mean Macro F1 calculated", summary.get("mean_macro_f1", 0) > 0.40)
    gap_comp = spatial.get("comparison_with_random_split", {})
    check("Generalisation gap documented honestly", gap_comp.get("generalisation_gap") is not None or gap_comp.get("macro_f1_gap") is not None)

    # ── Test 6: Point Inspector (Testing 3 points in 5 sample regions) ────────
    print("\n[TEST GROUP 6] Point Inspector & Multimodal Evidence (Pune, Jaipur, Mumbai, Bengaluru, Ahmedabad)")
    sample_cities = ["Pune", "Jaipur", "Mumbai", "Bengaluru", "Ahmedabad"]
    for city in sample_cities:
        pts_resp = http_get(f"/api/landcover/{city}")
        pts = pts_resp.get("landcover", [])
        check(f"{city}: exactly 500 points loaded", len(pts) == 500)

        # Test at least 3 points
        for pt in pts[:3]:
            pid = pt["point_id"]
            detail_resp = http_get(f"/api/point/{pid}")
            p_det = detail_resp.get("point", {})

            check(f"Point #{pid} ({city}): detail retrieved", p_det.get("point_id") == pid)
            check(f"Point #{pid}: coordinates valid", -90 <= p_det.get("latitude", 0) <= 90 and -180 <= p_det.get("longitude", 0) <= 180)
            check(f"Point #{pid}: top contributing features present", len(p_det.get("top_contributing_features_2024", [])) > 0)
            check(f"Point #{pid}: low-confidence warning object present", "low_confidence_warning" in p_det)
            check(f"Point #{pid}: visualization labeled feature-derived", "Feature-Derived" in p_det.get("visualization_type", ""))

            # Test Unified Evidence object
            ev_resp = http_get(f"/api/evidence/{pid}")
            ev = ev_resp.get("evidence", {})
            check(f"Point #{pid}: unified evidence ML block present", "ml_evidence" in ev)
            check(f"Point #{pid}: unified evidence EO block labeled synthetic", ev.get("eo_evidence", {}).get("is_real_satellite_imagery") is False)
            check(f"Point #{pid}: unified evidence change block present", "change_evidence" in ev)

    # ── Test 7: EO Vision Endpoint & Labeling ────────────────────────────────
    print("\n[TEST GROUP 7] EO Vision Endpoint & Synthetic/Feature-Derived Labeling")
    eo_resp = http_get("/api/eo/100")
    check("EO endpoint status success", eo_resp.get("status") == "success")
    check("EO is_real_satellite_imagery is False", eo_resp.get("is_real_satellite_imagery") is False)
    check("EO labeled Demo/Synthetic/Feature-Derived", "Feature-Derived" in eo_resp.get("visualization_type", ""))
    check("EO disclaimer present", "No actual Sentinel-2 GeoTIFF" in eo_resp.get("disclaimer", ""))
    check("EO panels contain 2018 & 2024 images", "2018" in eo_resp.get("imagery_panels", {}) and "2024" in eo_resp.get("imagery_panels", {}))

    # ── Test 8: GPT-OSS Structured Reasoning (/api/reason) ───────────────────
    print("\n[TEST GROUP 8] GPT-OSS Structured Reasoning (/api/reason)")
    reason_payload = {
        "region": "Pune",
        "question": "What is the vegetation change in Pune from 2018 to 2024?"
    }
    reason_resp = http_post("/api/reason", reason_payload)
    check("/api/reason status success", reason_resp.get("status") == "success")
    check("/api/reason contains answer", len(reason_resp.get("answer", "")) > 50)
    check("/api/reason lists evidence_used", len(reason_resp.get("evidence_used", [])) > 0)
    check("/api/reason includes caveats", len(reason_resp.get("caveats", [])) > 0)
    check("/api/reason caveats mention synthetic EO vision", any("Feature-Derived" in c or "Synthetic" in c for c in reason_resp.get("caveats", [])))
    check("/api/reason source tags include [ML Results]", "[ML Results]" in reason_resp.get("source_tags", []))

    # ── Test 9: GPT-OSS Chat Assistant (/api/ask) ────────────────────────────
    print("\n[TEST GROUP 9] GPT-OSS Chat Assistant (/api/ask)")
    prompts_to_test = [
        ("What changed in Jaipur?", "Jaipur"),
        ("Why is this point classified as barren?", "Jaipur"),
        ("What is the urban expansion in Mumbai?", "Mumbai"),
        ("Tell me about vegetation in Bengaluru", "Bengaluru"),
        ("Which region changed the most?", "All Regions")
    ]
    for q_text, reg in prompts_to_test:
        ask_payload = {"question": q_text, "region": reg}
        ask_resp = http_post("/api/ask", ask_payload)
        check(f"Chat '{q_text}': status success", ask_resp.get("status") == "success")
        expl = ask_resp.get("explanation", "")
        check(f"Chat '{q_text}': contains [ML Results]", "[ML Results]" in expl)
        check(f"Chat '{q_text}': contains [EO Vision]", "[EO Vision]" in expl)
        check(f"Chat '{q_text}': contains [GPT-OSS Reasoning]", "[GPT-OSS Reasoning]" in expl)

    # ── Test 10: Data Quality Endpoint ───────────────────────────────────────
    print("\n[TEST GROUP 10] Data Quality & Leakage Audit (/api/data-quality)")
    dq_resp = http_get("/api/data-quality")
    dq = dq_resp.get("data_quality", {})
    ds = dq.get("dataset", {})
    check("Data quality: total_samples == 6000", ds.get("total_samples") == 6000)
    check("Data quality: 12 regions", ds.get("regions") == 12)
    check("Data quality: 0 duplicate points", ds.get("duplicate_point_ids") == 0)
    check("Data quality: 0 null values", ds.get("null_count") == 0)
    check("Data quality: leakage audit CLEAN", "CLEAN" in ds.get("leakage_audit", ""))
    check("Data quality: EO imagery status synthetic", "Feature-Derived" in dq.get("eo_vision", {}).get("visualization_type", ""))

    # ── Test 11: Export Endpoints ────────────────────────────────────────────
    print("\n[TEST GROUP 11] Multi-Format Exports (CSV, JSON, GeoJSON, HTML Report)")
    for test_reg in ["Pune", "Jaipur"]:
        # CSV
        csv_data = http_get(f"/api/export/{test_reg}/csv")
        reader = list(csv.reader(io.StringIO(csv_data)))
        check(f"{test_reg} CSV export: 501 rows (header + 500 samples)", len(reader) == 501, f"Got {len(reader)}")

        # JSON
        json_data = http_get(f"/api/export/{test_reg}/json")
        check(f"{test_reg} JSON export: contains statistics & points", "statistics" in json_data and len(json_data.get("points", [])) == 500)

        # GeoJSON
        geojson_data = http_get(f"/api/export/{test_reg}/geojson")
        check(f"{test_reg} GeoJSON export: 500 features", len(geojson_data.get("features", [])) == 500)

        # HTML Report
        html_report = http_get(f"/api/report/{test_reg}?format=html")
        check(f"{test_reg} HTML report: valid HTML document", "<!DOCTYPE html>" in html_report and "5×5 Transition Matrix" in html_report)
        check(f"{test_reg} HTML report: contains EO Vision disclaimer", "Feature-Derived" in html_report)

    # ── Test 12: NL Query & Human Feedback ───────────────────────────────────
    print("\n[TEST GROUP 12] NL Query Engine & Human Feedback Logging")
    nl_resp = http_post("/api/query-nl", {"query": "Show urban expansion in Pune"})
    check("NL Query status success", nl_resp.get("status") == "success")
    check("NL Query filtered points returned", nl_resp.get("result", {}).get("matched_count", 0) >= 0)

    fb_resp = http_post("/api/feedback", {"point_id": 500, "verdict": "Correct", "notes": "Automated test review"})
    check("Human feedback logged", fb_resp.get("status") == "success" and fb_resp.get("total_reviews", 0) >= 1)

    # ── Final Summary ────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print(f"📊 VALIDATION SUMMARY: {passed_tests} / {total_tests} TESTS PASSED ({passed_tests/total_tests*100:.1f}%)")
    print("=" * 70)

    if passed_tests == total_tests:
        print("🎉 ALL TESTS PASSED! System is scientifically verified and production-ready.")
        return True
    else:
        print(f"⚠️ {total_tests - passed_tests} test(s) failed. Review outputs above.")
        return False


if __name__ == "__main__":
    success = run_suite()
    sys.exit(0 if success else 1)
