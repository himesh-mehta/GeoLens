import os
import sys
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# ============================================================
# CONSTANTS & CONFIGURATION
# ============================================================

INPUT_CSV = "SIH_SamePoints_2018_2024_Light.csv"
OUTPUT_DIR = "SIH_OUTPUT"

# Dynamic World (0-8) -> 5 Project Classes:
# 0: Water
# 1: Vegetation (Trees, Grass, Flooded Veg, Shrub/Scrub)
# 2: Agriculture (Crops)
# 3: Built-up (Built)
# 4: Barren (Bare, Snow/Ice)
LABEL_MAP = {
    0: 0,  # Water
    1: 1,  # Trees -> Vegetation
    2: 1,  # Grass -> Vegetation
    3: 1,  # Flooded vegetation -> Vegetation
    5: 1,  # Shrub/Scrub -> Vegetation
    4: 2,  # Crops -> Agriculture
    6: 3,  # Built -> Built-up
    7: 4,  # Bare -> Barren
    8: 4   # Snow/Ice -> Barren
}

CLASS_NAMES = {
    0: "Water",
    1: "Vegetation",
    2: "Agriculture",
    3: "Built-up",
    4: "Barren"
}

CLASS_LABELS_ORDER = [0, 1, 2, 3, 4]
CLASS_NAMES_ORDER = [CLASS_NAMES[i] for i in CLASS_LABELS_ORDER]

# Baseline metrics provided for comparison
BASELINE_METRICS = {
    "2018 Accuracy": 0.5970,
    "2024 Accuracy": 0.6310,
    "Combined Accuracy": 0.6140,
    "Combined Macro F1": 0.5298
}


# ============================================================
# 1. FEATURE ENGINEERING FUNCTION
# ============================================================

def compute_spectral_indices(data: pd.DataFrame, suffix: str = "") -> pd.DataFrame:
    """
    Computes spectral indices and band ratios for Sentinel-2 / Sentinel-1 data.
    Indices computed:
    - BSI (Bare Soil Index)
    - SAVI (Soil Adjusted Vegetation Index)
    - NBR (Normalized Burn Ratio)
    - EVI (Enhanced Vegetation Index)
    - UI (Urban Index)
    - NDMI (Normalized Difference Moisture Index)
    - GRVI (Green-Red Vegetation Index)
    - Spectral Brightness & Greenness
    - Band Ratios & Differences
    - VV-VH (if Sentinel-1 SAR bands are present)
    """
    eps = 1e-8
    b2 = data[f"B2{suffix}"]
    b3 = data[f"B3{suffix}"]
    b4 = data[f"B4{suffix}"]
    b8 = data[f"B8{suffix}"]
    b11 = data[f"B11{suffix}"]
    b12 = data[f"B12{suffix}"]

    # 1. BSI (Bare Soil Index)
    # BSI = ((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))
    data[f"BSI{suffix}"] = ((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + eps)

    # 2. SAVI (Soil Adjusted Vegetation Index, L=0.5)
    # SAVI = ((NIR - RED) * (1 + L)) / (NIR + RED + L)
    data[f"SAVI{suffix}"] = ((b8 - b4) * 1.5) / (b8 + b4 + 0.5)

    # 3. NBR (Normalized Burn Ratio)
    # NBR = (NIR - SWIR2) / (NIR + SWIR2)
    data[f"NBR{suffix}"] = (b8 - b12) / (b8 + b12 + eps)

    # 4. EVI (Enhanced Vegetation Index)
    data[f"EVI{suffix}"] = 2.5 * (b8 - b4) / (b8 + 6.0 * b4 - 7.5 * b2 + 1.0 + eps)

    # 5. UI (Urban Index)
    data[f"UI{suffix}"] = (b12 - b8) / (b12 + b8 + eps)

    # 6. NDMI (Normalized Difference Moisture Index)
    data[f"NDMI{suffix}"] = (b8 - b11) / (b8 + b11 + eps)

    # 7. GRVI (Green-Red Vegetation Index)
    data[f"GRVI{suffix}"] = (b3 - b4) / (b3 + b4 + eps)

    # 8. Spectral Composites & Ratios
    data[f"Brightness{suffix}"] = (b2 + b3 + b4 + b8 + b11 + b12) / 6.0
    data[f"Greenness{suffix}"] = b8 - (b4 + b3) / 2.0
    data[f"SWIR_Ratio{suffix}"] = b11 / (b12 + eps)
    data[f"NIR_Red_Ratio{suffix}"] = b8 / (b4 + eps)
    data[f"NIR_Green_Ratio{suffix}"] = b8 / (b3 + eps)

    # 9. Spectral Difference Cross-Indices
    if f"NDBI{suffix}" in data.columns and f"NDVI{suffix}" in data.columns:
        data[f"NDBI_NDVI_diff{suffix}"] = data[f"NDBI{suffix}"] - data[f"NDVI{suffix}"]
    if f"MNDWI{suffix}" in data.columns and f"NDVI{suffix}" in data.columns:
        data[f"MNDWI_NDVI_diff{suffix}"] = data[f"MNDWI{suffix}"] - data[f"NDVI{suffix}"]

    # 10. Sentinel-1 SAR VV-VH check
    vv_col = f"VV{suffix}"
    vh_col = f"VH{suffix}"
    if vv_col in data.columns and vh_col in data.columns:
        data[f"VV_minus_VH{suffix}"] = data[vv_col] - data[vh_col]
        data[f"VV_div_VH{suffix}"] = data[vv_col] / (data[vh_col] + eps)

    return data


# ============================================================
# 2. CHANGE DETECTION CLASSIFIER
# ============================================================

def classify_change(old_class: int, new_class: int) -> str:
    """
    Categorizes the land-cover change transition between 2018 and 2024.
    """
    if old_class == new_class:
        return "No Change"
    if old_class == 1 and new_class != 1:
        return "Vegetation Loss"
    if old_class != 1 and new_class == 1:
        return "Vegetation Gain"
    if old_class != 3 and new_class == 3:
        return "Urban Expansion"
    if old_class == 0 and new_class != 0:
        return "Water Loss"
    if old_class != 0 and new_class == 0:
        return "Water Gain"
    if old_class == 2 and new_class != 2:
        return "Agriculture Loss"
    if old_class != 2 and new_class == 2:
        return "Agriculture Gain"
    return "Other Change"


# ============================================================
# MAIN PIPELINE EXECUTION
# ============================================================

def main():
    print("=" * 70)
    print("SIH 2018 -> 2024 LAND-COVER CLASSIFICATION & CHANGE DETECTION")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\n[1/8] Created output directory: {OUTPUT_DIR}/")

    # 1. Load Data
    print(f"\n[2/8] Loading dataset from '{INPUT_CSV}'...")
    if not os.path.exists(INPUT_CSV):
        raise FileNotFoundError(f"Input file not found: {INPUT_CSV}")

    df = pd.read_csv(INPUT_CSV)
    print(f"Loaded dataset successfully. Dimensions: {df.shape[0]} points x {df.shape[1]} columns.")

    # 2. Map Dynamic World Labels to Project Classes
    print("\n[3/8] Mapping Dynamic World labels to 5 project classes...")
    df["class_2018"] = df["DW_LABEL_2018"].map(LABEL_MAP)
    df["class_2024"] = df["DW_LABEL_2024"].map(LABEL_MAP)

    df["class_2018_name"] = df["class_2018"].map(CLASS_NAMES)
    df["class_2024_name"] = df["class_2024"].map(CLASS_NAMES)

    print("2018 Ground Truth Class Distribution:")
    print(df["class_2018_name"].value_counts())
    print("\n2024 Ground Truth Class Distribution:")
    print(df["class_2024_name"].value_counts())

    # 3. Feature Engineering
    print("\n[4/8] Computing Sentinel-2 / Sentinel-1 spectral indices...")
    df = compute_spectral_indices(df, suffix="_2018")
    df = compute_spectral_indices(df, suffix="_2024")

    # Define base feature list
    base_features = [
        "B2", "B3", "B4", "B8", "B11", "B12",
        "NDVI", "NDWI", "MNDWI", "NDBI",
        "BSI", "SAVI", "NBR", "EVI", "UI", "NDMI", "GRVI",
        "Brightness", "Greenness", "SWIR_Ratio", "NIR_Red_Ratio", "NIR_Green_Ratio",
        "NDBI_NDVI_diff", "MNDWI_NDVI_diff"
    ]

    # Include SAR features if present
    if "VV_2018" in df.columns and "VH_2018" in df.columns:
        base_features.extend(["VV", "VH", "VV_minus_VH", "VV_div_VH"])
        print("Included Sentinel-1 SAR features: VV, VH, VV_minus_VH, VV_div_VH.")
    else:
        print("Note: Sentinel-1 VV/VH bands are not in CSV; using enhanced Sentinel-2 optical indices.")

    print(f"Total spectral feature count per year: {len(base_features)}")
    print("Features:", base_features)

    # 4. Leakage-Free Stratified Train/Test Split
    print("\n[5/8] Performing leakage-free point-stratified train/test split (80/20)...")
    pt_meta = df[["point_id", "region", "class_2018"]].drop_duplicates(subset=["point_id"]).copy()

    train_pts, test_pts = train_test_split(
        pt_meta["point_id"],
        test_size=0.20,
        stratify=pt_meta["class_2018"],
        random_state=42
    )

    train_df = df[df["point_id"].isin(train_pts)].copy()
    test_df = df[df["point_id"].isin(test_pts)].copy()

    print(f"Unique points: {len(pt_meta)} (Train: {len(train_pts)}, Test: {len(test_pts)})")
    print(f"Data observations (2018 + 2024): Train = {len(train_df)*2}, Test = {len(test_df)*2}")

    # Build stacked multi-temporal training set
    train_2018 = train_df[[f"{f}_2018" for f in base_features]].copy()
    train_2018.columns = base_features
    train_2018["target"] = train_df["class_2018"].values
    train_2018["year"] = 2018

    train_2024 = train_df[[f"{f}_2024" for f in base_features]].copy()
    train_2024.columns = base_features
    train_2024["target"] = train_df["class_2024"].values
    train_2024["year"] = 2024

    train_all = pd.concat([train_2018, train_2024], ignore_index=True)
    X_train = train_all[base_features]
    y_train = train_all["target"].astype(int)

    # Build test sets (2018, 2024, and Combined)
    test_2018 = test_df[[f"{f}_2018" for f in base_features]].copy()
    test_2018.columns = base_features
    y_test_2018 = test_df["class_2018"].astype(int).values

    test_2024 = test_df[[f"{f}_2024" for f in base_features]].copy()
    test_2024.columns = base_features
    y_test_2024 = test_df["class_2024"].astype(int).values

    test_all = pd.concat([
        pd.DataFrame(test_2018, columns=base_features),
        pd.DataFrame(test_2024, columns=base_features)
    ], ignore_index=True)
    y_test_all = np.concatenate([y_test_2018, y_test_2024])

    # 5. Train Random Forest Model with Class Balancing
    print("\n[6/8] Training Random Forest model with class balancing...")
    rf_model = RandomForestClassifier(
        n_estimators=400,
        criterion="entropy",
        max_features="sqrt",
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1
    )

    rf_model.fit(X_train, y_train)
    print("Random Forest training finished.")

    # 6. Evaluate Model Performance
    print("\n[7/8] Evaluating model on unseen test locations...")

    preds_test_2018 = rf_model.predict(test_2018)
    preds_test_2024 = rf_model.predict(test_2024)
    preds_test_all = rf_model.predict(test_all)

    # Metric calculations
    acc_2018 = accuracy_score(y_test_2018, preds_test_2018)
    prec_2018 = precision_score(y_test_2018, preds_test_2018, average="macro", zero_division=0)
    rec_2018 = recall_score(y_test_2018, preds_test_2018, average="macro", zero_division=0)
    macro_f1_2018 = f1_score(y_test_2018, preds_test_2018, average="macro", zero_division=0)
    weighted_f1_2018 = f1_score(y_test_2018, preds_test_2018, average="weighted", zero_division=0)

    acc_2024 = accuracy_score(y_test_2024, preds_test_2024)
    prec_2024 = precision_score(y_test_2024, preds_test_2024, average="macro", zero_division=0)
    rec_2024 = recall_score(y_test_2024, preds_test_2024, average="macro", zero_division=0)
    macro_f1_2024 = f1_score(y_test_2024, preds_test_2024, average="macro", zero_division=0)
    weighted_f1_2024 = f1_score(y_test_2024, preds_test_2024, average="weighted", zero_division=0)

    acc_all = accuracy_score(y_test_all, preds_test_all)
    prec_all = precision_score(y_test_all, preds_test_all, average="macro", zero_division=0)
    rec_all = recall_score(y_test_all, preds_test_all, average="macro", zero_division=0)
    macro_f1_all = f1_score(y_test_all, preds_test_all, average="macro", zero_division=0)
    weighted_f1_all = f1_score(y_test_all, preds_test_all, average="weighted", zero_division=0)

    print("\n" + "=" * 50)
    print("EVALUATION RESULTS")
    print("=" * 50)
    print(f"2018 Test Accuracy : {acc_2018*100:.2f}% | Macro F1: {macro_f1_2018:.4f}")
    print(f"2024 Test Accuracy : {acc_2024*100:.2f}% | Macro F1: {macro_f1_2024:.4f}")
    print(f"Combined Accuracy  : {acc_all*100:.2f}% | Macro F1: {macro_f1_all:.4f}")
    print(f"Combined Weighted F1: {weighted_f1_all:.4f}")

    # Detailed Classification Report
    print("\nDetailed Combined Classification Report:")
    clf_report_str = classification_report(
        y_test_all,
        preds_test_all,
        labels=CLASS_LABELS_ORDER,
        target_names=CLASS_NAMES_ORDER,
        zero_division=0
    )
    print(clf_report_str)

    clf_report_dict = classification_report(
        y_test_all,
        preds_test_all,
        labels=CLASS_LABELS_ORDER,
        target_names=CLASS_NAMES_ORDER,
        output_dict=True,
        zero_division=0
    )
    clf_report_df = pd.DataFrame(clf_report_dict).transpose().reset_index().rename(columns={"index": "class"})

    # Confusion Matrices
    cm_2018 = confusion_matrix(y_test_2018, preds_test_2018, labels=CLASS_LABELS_ORDER)
    cm_2024 = confusion_matrix(y_test_2024, preds_test_2024, labels=CLASS_LABELS_ORDER)
    cm_all = confusion_matrix(y_test_all, preds_test_all, labels=CLASS_LABELS_ORDER)

    cm_2018_df = pd.DataFrame(cm_2018, index=CLASS_NAMES_ORDER, columns=CLASS_NAMES_ORDER)
    cm_2024_df = pd.DataFrame(cm_2024, index=CLASS_NAMES_ORDER, columns=CLASS_NAMES_ORDER)
    cm_all_df = pd.DataFrame(cm_all, index=CLASS_NAMES_ORDER, columns=CLASS_NAMES_ORDER)

    # Feature Importance
    feature_importance_df = pd.DataFrame({
        "feature": base_features,
        "importance": rf_model.feature_importances_
    }).sort_values(by="importance", ascending=False).reset_index(drop=True)

    print("\nTop 10 Most Important Features:")
    print(feature_importance_df.head(10))

    # 7. Predict on Full Dataset and Perform Change Detection
    print("\n[8/8] Generating full dataset predictions and 2018 -> 2024 change detection...")
    all_2018_feat = df[[f"{f}_2018" for f in base_features]].copy()
    all_2018_feat.columns = base_features

    all_2024_feat = df[[f"{f}_2024" for f in base_features]].copy()
    all_2024_feat.columns = base_features

    df["prediction_2018"] = rf_model.predict(all_2018_feat)
    df["prediction_2024"] = rf_model.predict(all_2024_feat)

    # Probabilities / Confidence
    probs_2018 = rf_model.predict_proba(all_2018_feat)
    probs_2024 = rf_model.predict_proba(all_2024_feat)
    df["confidence_2018"] = np.max(probs_2018, axis=1)
    df["confidence_2024"] = np.max(probs_2024, axis=1)

    df["prediction_2018_name"] = df["prediction_2018"].map(CLASS_NAMES)
    df["prediction_2024_name"] = df["prediction_2024"].map(CLASS_NAMES)

    # Change Detection Classification
    df["change_type"] = [
        classify_change(old, new)
        for old, new in zip(df["prediction_2018"], df["prediction_2024"])
    ]

    # 5x5 Change Matrix (Crosstab)
    change_matrix_5x5 = pd.crosstab(
        df["prediction_2018_name"],
        df["prediction_2024_name"]
    ).reindex(index=CLASS_NAMES_ORDER, columns=CLASS_NAMES_ORDER, fill_value=0)

    print("\n5x5 Land-Cover Change Matrix (2018 -> 2024):")
    print(change_matrix_5x5)

    # Change Statistics
    change_stats_df = (
        df["change_type"]
        .value_counts()
        .rename_axis("change_type")
        .reset_index(name="samples")
    )
    change_stats_df["percentage"] = (change_stats_df["samples"] / len(df)) * 100.0

    print("\nChange Statistics:")
    print(change_stats_df)

    # Class Statistics for 2018 & 2024
    class_stats_2018 = (
        df["prediction_2018_name"]
        .value_counts()
        .rename_axis("class")
        .reset_index(name="samples")
    )
    class_stats_2018["percentage"] = (class_stats_2018["samples"] / len(df)) * 100.0

    class_stats_2024 = (
        df["prediction_2024_name"]
        .value_counts()
        .rename_axis("class")
        .reset_index(name="samples")
    )
    class_stats_2024["percentage"] = (class_stats_2024["samples"] / len(df)) * 100.0

    # Summary Metrics DataFrame
    metrics_summary_df = pd.DataFrame([
        {
            "Split": "2018 Test",
            "Accuracy": acc_2018,
            "Macro_Precision": prec_2018,
            "Macro_Recall": rec_2018,
            "Macro_F1": macro_f1_2018,
            "Weighted_F1": weighted_f1_2018
        },
        {
            "Split": "2024 Test",
            "Accuracy": acc_2024,
            "Macro_Precision": prec_2024,
            "Macro_Recall": rec_2024,
            "Macro_F1": macro_f1_2024,
            "Weighted_F1": weighted_f1_2024
        },
        {
            "Split": "Combined Test (2018+2024)",
            "Accuracy": acc_all,
            "Macro_Precision": prec_all,
            "Macro_Recall": rec_all,
            "Macro_F1": macro_f1_all,
            "Weighted_F1": weighted_f1_all
        }
    ])

    # Comparison DataFrame against Baseline
    baseline_comp_df = pd.DataFrame([
        {
            "Metric": "2018 Accuracy",
            "Baseline": BASELINE_METRICS["2018 Accuracy"],
            "New_Pipeline": acc_2018,
            "Absolute_Change": acc_2018 - BASELINE_METRICS["2018 Accuracy"],
            "Percentage_Change": ((acc_2018 - BASELINE_METRICS["2018 Accuracy"]) / BASELINE_METRICS["2018 Accuracy"]) * 100.0
        },
        {
            "Metric": "2024 Accuracy",
            "Baseline": BASELINE_METRICS["2024 Accuracy"],
            "New_Pipeline": acc_2024,
            "Absolute_Change": acc_2024 - BASELINE_METRICS["2024 Accuracy"],
            "Percentage_Change": ((acc_2024 - BASELINE_METRICS["2024 Accuracy"]) / BASELINE_METRICS["2024 Accuracy"]) * 100.0
        },
        {
            "Metric": "Combined Accuracy",
            "Baseline": BASELINE_METRICS["Combined Accuracy"],
            "New_Pipeline": acc_all,
            "Absolute_Change": acc_all - BASELINE_METRICS["Combined Accuracy"],
            "Percentage_Change": ((acc_all - BASELINE_METRICS["Combined Accuracy"]) / BASELINE_METRICS["Combined Accuracy"]) * 100.0
        },
        {
            "Metric": "Combined Macro F1",
            "Baseline": BASELINE_METRICS["Combined Macro F1"],
            "New_Pipeline": macro_f1_all,
            "Absolute_Change": macro_f1_all - BASELINE_METRICS["Combined Macro F1"],
            "Percentage_Change": ((macro_f1_all - BASELINE_METRICS["Combined Macro F1"]) / BASELINE_METRICS["Combined Macro F1"]) * 100.0
        }
    ])

    print("\n" + "=" * 50)
    print("BASELINE COMPARISON")
    print("=" * 50)
    print(baseline_comp_df.to_string(index=False))

    # ============================================================
    # SAVE ALL OUTPUTS INSIDE SIH_OUTPUT/
    # ============================================================
    print("\n" + "=" * 50)
    print("SAVING ALL DELIVERABLES TO SIH_OUTPUT/")
    print("=" * 50)

    # 1. Saved PKL Model
    model_bundle_path = os.path.join(OUTPUT_DIR, "SIH_LandCover_RandomForest.pkl")
    joblib.dump(
        {
            "model": rf_model,
            "features": base_features,
            "classes": CLASS_NAMES,
            "metrics": {
                "accuracy_2018": acc_2018,
                "accuracy_2024": acc_2024,
                "combined_accuracy": acc_all,
                "combined_macro_f1": macro_f1_all
            }
        },
        model_bundle_path
    )
    print(f"Saved Model Bundle   : {model_bundle_path}")

    # 2. Predictions CSV
    pred_cols = [
        "point_id", "region_id", "region", "latitude", "longitude",
        "DW_LABEL_2018", "DW_LABEL_2024",
        "class_2018", "class_2018_name",
        "class_2024", "class_2024_name",
        "prediction_2018", "prediction_2018_name", "confidence_2018",
        "prediction_2024", "prediction_2024_name", "confidence_2024",
        "change_type"
    ]
    preds_csv_path = os.path.join(OUTPUT_DIR, "predictions_2018_2024.csv")
    df[pred_cols].to_csv(preds_csv_path, index=False)
    print(f"Saved Predictions    : {preds_csv_path}")

    # 3. Metrics Summary CSV
    metrics_summary_path = os.path.join(OUTPUT_DIR, "metrics_summary.csv")
    metrics_summary_df.to_csv(metrics_summary_path, index=False)
    print(f"Saved Metrics Summary: {metrics_summary_path}")

    # 4. Classification Report CSV
    clf_report_path = os.path.join(OUTPUT_DIR, "classification_report.csv")
    clf_report_df.to_csv(clf_report_path, index=False)
    print(f"Saved Clf Report     : {clf_report_path}")

    # 5. Confusion Matrices CSVs
    cm_2018_path = os.path.join(OUTPUT_DIR, "confusion_matrix_2018.csv")
    cm_2018_df.to_csv(cm_2018_path)
    cm_2024_path = os.path.join(OUTPUT_DIR, "confusion_matrix_2024.csv")
    cm_2024_df.to_csv(cm_2024_path)
    cm_all_path = os.path.join(OUTPUT_DIR, "confusion_matrix_combined.csv")
    cm_all_df.to_csv(cm_all_path)
    print(f"Saved Confusion Mat  : {cm_2018_path}, {cm_2024_path}, {cm_all_path}")

    # 6. 5x5 Change Matrix CSV
    change_matrix_path = os.path.join(OUTPUT_DIR, "change_matrix_5x5.csv")
    change_matrix_5x5.to_csv(change_matrix_path)
    print(f"Saved 5x5 Matrix     : {change_matrix_path}")

    # 7. Change Statistics CSV
    change_stats_path = os.path.join(OUTPUT_DIR, "change_statistics.csv")
    change_stats_df.to_csv(change_stats_path, index=False)
    print(f"Saved Change Stats   : {change_stats_path}")

    # 8. Class Statistics CSVs
    class_stats_18_path = os.path.join(OUTPUT_DIR, "class_statistics_2018.csv")
    class_stats_2018.to_csv(class_stats_18_path, index=False)
    class_stats_24_path = os.path.join(OUTPUT_DIR, "class_statistics_2024.csv")
    class_stats_2024.to_csv(class_stats_24_path, index=False)
    print(f"Saved Class Stats    : {class_stats_18_path}, {class_stats_24_path}")

    # 9. Feature Importance CSV
    feat_imp_path = os.path.join(OUTPUT_DIR, "feature_importance.csv")
    feature_importance_df.to_csv(feat_imp_path, index=False)
    print(f"Saved Feature Imp    : {feat_imp_path}")

    # 10. Baseline Comparison CSV
    baseline_comp_path = os.path.join(OUTPUT_DIR, "baseline_comparison.csv")
    baseline_comp_df.to_csv(baseline_comp_path, index=False)
    print(f"Saved Comparison     : {baseline_comp_path}")

    print("\n" + "=" * 70)
    print("ALL PIPELINE TASKS COMPLETED SUCCESSFULLY IN SIH_OUTPUT/")
    print("=" * 70)


if __name__ == "__main__":
    main()
