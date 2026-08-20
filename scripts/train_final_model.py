import pandas as pd
import numpy as np
import joblib
import json
import os
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, confusion_matrix
from imblearn.over_sampling import RandomOverSampler
from datetime import datetime

# ============================================================
# ML Pipeline v4.0 - Spatial Leakage Fix & SAR Multi-Source
# ============================================================

INPUT_CSV = "SIH_SamePoints_2018_2024_Enriched.csv"
MODEL_OUTPUT = "SIH_OUTPUT/SIH_LandCover_ExtraTrees_MultiSource.pkl"
REPORT_JSON = "SIH_OUTPUT/full_model_validation.json"

LABEL_MAP = {
    0: 0, 1: 1, 2: 1, 3: 1, 5: 1,  # Water, Vegetation
    4: 2,  # Agriculture
    6: 3,  # Built-up
    7: 4, 8: 4   # Barren
}

CLASS_NAMES = {0: "Water", 1: "Vegetation", 2: "Agriculture", 3: "Built-up", 4: "Barren"}
CLASS_NAMES_LIST = ["Water", "Vegetation", "Agriculture", "Built-up", "Barren"]

OPTICAL_FEATURES = [
    "B2", "B3", "B4", "B8", "B11", "B12",
    "NDVI", "NDWI", "MNDWI", "NDBI",
    "BSI", "SAVI", "NBR", "EVI", "UI", "NDMI", "GRVI",
    "Brightness", "Greenness", "SWIR_Ratio", "NIR_Red_Ratio", "NIR_Green_Ratio",
    "NDBI_NDVI_diff", "MNDWI_NDVI_diff"
]
SAR_FEATURES = ["VV", "VH"]

ALL_FEATURES = OPTICAL_FEATURES + SAR_FEATURES

def prepare_data(df):
    """Parses 2018 and 2024 into a long format dataset."""
    df["class_2018"] = df["DW_LABEL_2018"].map(LABEL_MAP)
    df["class_2024"] = df["DW_LABEL_2024"].map(LABEL_MAP)
    
    # Calculate derived indices for both years
    for yr in ["2018", "2024"]:
        b2 = df[f"B2_{yr}"]
        b3 = df[f"B3_{yr}"]
        b4 = df[f"B4_{yr}"]
        b8 = df[f"B8_{yr}"]
        b11 = df[f"B11_{yr}"]
        b12 = df[f"B12_{yr}"]
        
        # BSI = ((SWIR1 + Red) - (NIR + Blue)) / ((SWIR1 + Red) + (NIR + Blue))
        df[f"BSI_{yr}"] = ((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + 1e-6)
        
        # SAVI = ((NIR - Red) / (NIR + Red + 0.5)) * 1.5
        df[f"SAVI_{yr}"] = ((b8 - b4) / (b8 + b4 + 0.5)) * 1.5
        
        # NBR = (NIR - SWIR2) / (NIR + SWIR2)
        df[f"NBR_{yr}"] = (b8 - b12) / (b8 + b12 + 1e-6)
        
        # EVI = 2.5 * ((NIR - Red) / (NIR + 6 * Red - 7.5 * Blue + 1))
        df[f"EVI_{yr}"] = 2.5 * ((b8 - b4) / (b8 + 6 * b4 - 7.5 * b2 + 1))
        
        # UI = (SWIR2 - NIR) / (SWIR2 + NIR)
        df[f"UI_{yr}"] = (b12 - b8) / (b12 + b8 + 1e-6)
        
        # NDMI = (NIR - SWIR1) / (NIR + SWIR1)
        df[f"NDMI_{yr}"] = (b8 - b11) / (b8 + b11 + 1e-6)
        
        # GRVI = (Green - Red) / (Green + Red)
        df[f"GRVI_{yr}"] = (b3 - b4) / (b3 + b4 + 1e-6)
        
        # Brightness = sqrt(B2^2 + B3^2 + B4^2 + B8^2 + B11^2 + B12^2)
        df[f"Brightness_{yr}"] = np.sqrt(b2**2 + b3**2 + b4**2 + b8**2 + b11**2 + b12**2)
        
        # Greenness = (Green / (Red + Green + Blue))
        df[f"Greenness_{yr}"] = b3 / (b4 + b3 + b2 + 1e-6)
        
        # SWIR_Ratio = SWIR1 / SWIR2
        df[f"SWIR_Ratio_{yr}"] = b11 / (b12 + 1e-6)
        
        # NIR_Red_Ratio = NIR / Red
        df[f"NIR_Red_Ratio_{yr}"] = b8 / (b4 + 1e-6)
        
        # NIR_Green_Ratio = NIR / Green
        df[f"NIR_Green_Ratio_{yr}"] = b8 / (b3 + 1e-6)
        
        # NDBI_NDVI_diff
        df[f"NDBI_NDVI_diff_{yr}"] = df[f"NDBI_{yr}"] - df[f"NDVI_{yr}"]
        
        # MNDWI_NDVI_diff
        df[f"MNDWI_NDVI_diff_{yr}"] = df[f"MNDWI_{yr}"] - df[f"NDVI_{yr}"]

    
    # Drop rows missing SAR or Optical
    req_cols = [f"{feat}_2018" for feat in ALL_FEATURES] + [f"{feat}_2024" for feat in ALL_FEATURES] + ["class_2018", "class_2024"]
    df = df.dropna(subset=req_cols).copy()
    
    # 2018 Data
    df_2018 = df[[f"{feat}_2018" for feat in ALL_FEATURES] + ["class_2018", "region"]].copy()
    df_2018.columns = ALL_FEATURES + ["target", "region"]
    df_2018["year"] = 2018
    
    # 2024 Data
    df_2024 = df[[f"{feat}_2024" for feat in ALL_FEATURES] + ["class_2024", "region"]].copy()
    df_2024.columns = ALL_FEATURES + ["target", "region"]
    df_2024["year"] = 2024
    
    return pd.concat([df_2018, df_2024], ignore_index=True)

def train_and_evaluate(X_train, y_train, X_test, y_test, features, name):
    print(f"\n--- Training {name} ---")
    
    # Class balancing ONLY on training set
    ros = RandomOverSampler(random_state=42)
    X_train_res, y_train_res = ros.fit_resample(X_train[features], y_train)
    
    print("Train distribution (balanced):", dict(pd.Series(y_train_res).value_counts()))
    print("Test distribution (unbalanced):", dict(pd.Series(y_test).value_counts()))
    
    model = ExtraTreesClassifier(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1)
    model.fit(X_train_res, y_train_res)
    
    y_pred = model.predict(X_test[features])
    
    acc = accuracy_score(y_test, y_pred)
    macro_f1 = f1_score(y_test, y_pred, average="macro")
    weighted_f1 = f1_score(y_test, y_pred, average="weighted")
    precision = precision_score(y_test, y_pred, average=None, labels=[0,1,2,3,4])
    recall = recall_score(y_test, y_pred, average=None, labels=[0,1,2,3,4])
    f1s = f1_score(y_test, y_pred, average=None, labels=[0,1,2,3,4])
    cm = confusion_matrix(y_test, y_pred, labels=[0,1,2,3,4])
    
    print(f"Accuracy: {acc:.4f} | Macro F1: {macro_f1:.4f}")
    
    importances = None
    if hasattr(model, "feature_importances_"):
        importances = {feat: float(imp) for feat, imp in zip(features, model.feature_importances_)}
        # Sort desc
        importances = dict(sorted(importances.items(), key=lambda x: x[1], reverse=True))
        
    return {
        "model": model,
        "features": features,
        "metrics": {
            "accuracy": acc,
            "macro_f1": macro_f1,
            "weighted_f1": weighted_f1,
            "per_class": {
                CLASS_NAMES[i]: {
                    "precision": float(precision[i]),
                    "recall": float(recall[i]),
                    "f1": float(f1s[i]),
                    "support": int(np.sum(y_test == i))
                } for i in range(5)
            },
            "confusion_matrix": {
                "labels": CLASS_NAMES_LIST,
                "matrix": cm.tolist()
            }
        },
        "feature_importance": importances
    }

def main():
    if not os.path.exists(INPUT_CSV):
        print(f"Error: {INPUT_CSV} not found. Run extraction script first.")
        return
        
    print("Loading enriched dataset...")
    df = pd.read_csv(INPUT_CSV)
    
    data = prepare_data(df)
    print(f"Total valid samples: {len(data)}")
    
    # SPATIAL SPLIT based on region
    print("\nSplitting by region to prevent spatial leakage...")
    gss = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=42)
    train_idx, test_idx = next(gss.split(data, data["target"], groups=data["region"]))
    
    train_data = data.iloc[train_idx]
    test_data = data.iloc[test_idx]
    
    print("Training Regions:", train_data["region"].unique().tolist())
    print("Testing Regions:", test_data["region"].unique().tolist())
    
    X_train = train_data.drop(columns=["target"])
    y_train = train_data["target"].astype(int)
    X_test = test_data.drop(columns=["target"])
    y_test = test_data["target"].astype(int)
    
    # Train 3 models for comparison
    res_optical = train_and_evaluate(X_train, y_train, X_test, y_test, OPTICAL_FEATURES, "Optical Only")
    res_sar = train_and_evaluate(X_train, y_train, X_test, y_test, SAR_FEATURES, "SAR Only")
    res_multi = train_and_evaluate(X_train, y_train, X_test, y_test, ALL_FEATURES, "Multi-Source (Optical + SAR)")
    
    # Save the best model
    print(f"\nSaving Multi-Source model to {MODEL_OUTPUT}...")
    os.makedirs("SIH_OUTPUT", exist_ok=True)
    bundle = {
        "model": res_multi["model"],
        "features": res_multi["features"],
        "metrics": res_multi["metrics"],
        "model_name": "ExtraTrees Classifier (Multi-Source)",
        "timestamp": datetime.now().isoformat(),
        "train_regions": train_data["region"].unique().tolist(),
        "test_regions": test_data["region"].unique().tolist(),
        "preprocessing": "SAR VV/VH added, strict spatial holdout."
    }
    joblib.dump(bundle, MODEL_OUTPUT)
    
    # Save validation report
    report = {
        "Optical": res_optical["metrics"],
        "SAR": res_sar["metrics"],
        "MultiSource": res_multi["metrics"],
        "FeatureImportance_MultiSource": res_multi["feature_importance"],
        "Dataset": {
            "TotalSamples": len(data),
            "TrainSamples": len(train_data),
            "TestSamples": len(test_data),
            "TrainRegions": train_data["region"].unique().tolist(),
            "TestRegions": test_data["region"].unique().tolist()
        }
    }
    with open(REPORT_JSON, "w") as f:
        json.dump(report, f, indent=4)
        
    print("\nDONE!")

if __name__ == "__main__":
    main()
