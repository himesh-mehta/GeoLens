import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# ============================================================
# SIH25170
# 2018 + 2024 LAND-COVER CLASSIFICATION
# + CHANGE DETECTION
# ============================================================

CSV_FILE = "SIH_SamePoints_2018_2024_Light.csv"

# ============================================================
# 1. LOAD DATA
# ============================================================

print("Loading dataset...")

df = pd.read_csv(CSV_FILE)

print("Dataset shape:", df.shape)

print("\nRegions:")
print(df["region"].value_counts())


# ============================================================
# 2. DYNAMIC WORLD → 5 PROJECT CLASSES
# ============================================================

# Dynamic World labels:
#
# 0 = Water
# 1 = Trees
# 2 = Grass
# 3 = Flooded vegetation
# 4 = Crops
# 5 = Shrub/Scrub
# 6 = Built
# 7 = Bare
# 8 = Snow/Ice

LABEL_MAP = {
    0: 0,  # Water

    1: 1,  # Vegetation
    2: 1,  # Vegetation
    3: 1,  # Vegetation
    5: 1,  # Vegetation

    4: 2,  # Agriculture

    6: 3,  # Built-up

    7: 4,  # Barren
    8: 4   # Barren
}

CLASS_NAMES = {
    0: "Water",
    1: "Vegetation",
    2: "Agriculture",
    3: "Built-up",
    4: "Barren"
}


df["class_2018"] = (
    df["DW_LABEL_2018"]
    .map(LABEL_MAP)
)

df["class_2024"] = (
    df["DW_LABEL_2024"]
    .map(LABEL_MAP)
)


# ============================================================
# 3. FEATURES
# ============================================================

FEATURES = [
    "B2",
    "B3",
    "B4",
    "B8",
    "B11",
    "B12",
    "NDVI",
    "NDWI",
    "MNDWI",
    "NDBI"
]


FEATURES_2018 = [
    feature + "_2018"
    for feature in FEATURES
]

FEATURES_2024 = [
    feature + "_2024"
    for feature in FEATURES
]


# ============================================================
# 4. REMOVE INVALID DATA
# ============================================================

required_columns = (
    FEATURES_2018
    + FEATURES_2024
    + [
        "class_2018",
        "class_2024"
    ]
)

df = df.dropna(
    subset=required_columns
).copy()

print("\nValid samples:", len(df))


# ============================================================
# 5. TRAIN / TEST REGIONS
# ============================================================

# These regions are completely held out
# for geographical testing.

TEST_REGIONS = [
    "Mumbai",
    "Ahmedabad",
    "Jaipur",
    "Hyderabad"
]


TRAIN_REGIONS = [
    region
    for region in df["region"].unique()
    if region not in TEST_REGIONS
]


train_df = df[
    df["region"].isin(TRAIN_REGIONS)
].copy()


test_df = df[
    df["region"].isin(TEST_REGIONS)
].copy()


print("\n==========================================")
print("TRAIN / TEST SPLIT")
print("==========================================")

print("Training regions:")
print(TRAIN_REGIONS)

print("\nTesting regions:")
print(TEST_REGIONS)

print("\nTraining locations:", len(train_df))
print("Testing locations:", len(test_df))


# ============================================================
# 6. CREATE 2018 TRAINING DATA
# ============================================================

train_2018 = train_df[
    FEATURES_2018
].copy()

train_2018.columns = FEATURES

train_2018["target"] = (
    train_df["class_2018"]
    .values
)

train_2018["year"] = 2018


# ============================================================
# 7. CREATE 2024 TRAINING DATA
# ============================================================

train_2024 = train_df[
    FEATURES_2024
].copy()

train_2024.columns = FEATURES

train_2024["target"] = (
    train_df["class_2024"]
    .values
)

train_2024["year"] = 2024


# ============================================================
# 8. COMBINE 2018 + 2024
# ============================================================

training_data = pd.concat(
    [
        train_2018,
        train_2024
    ],
    ignore_index=True
)


X_train = training_data[
    FEATURES
]

y_train = training_data[
    "target"
].astype(int)


print("\n==========================================")
print("TRAINING DATA")
print("==========================================")

print(
    "Total training samples:",
    len(training_data)
)

print("\nClass distribution:")

print(
    y_train
    .map(CLASS_NAMES)
    .value_counts()
)


# ============================================================
# 9. RANDOM FOREST
# ============================================================

print("\nTraining Random Forest...")

model = RandomForestClassifier(

    n_estimators=300,

    max_features="sqrt",

    min_samples_leaf=2,

    class_weight="balanced_subsample",

    random_state=42,

    n_jobs=-1
)


model.fit(
    X_train,
    y_train
)


print("Training completed.")


# ============================================================
# 10. TEST 2018
# ============================================================

test_2018 = test_df[
    FEATURES_2018
].copy()

test_2018.columns = FEATURES


prediction_2018 = model.predict(
    test_2018
)


actual_2018 = (
    test_df["class_2018"]
    .astype(int)
    .values
)


accuracy_2018 = accuracy_score(
    actual_2018,
    prediction_2018
)


f1_2018 = f1_score(
    actual_2018,
    prediction_2018,
    average="macro"
)


# ============================================================
# 11. TEST 2024
# ============================================================

test_2024 = test_df[
    FEATURES_2024
].copy()

test_2024.columns = FEATURES


prediction_2024 = model.predict(
    test_2024
)


actual_2024 = (
    test_df["class_2024"]
    .astype(int)
    .values
)


accuracy_2024 = accuracy_score(
    actual_2024,
    prediction_2024
)


f1_2024 = f1_score(
    actual_2024,
    prediction_2024,
    average="macro"
)


# ============================================================
# 12. COMBINED ACCURACY
# ============================================================

actual_all = np.concatenate(
    [
        actual_2018,
        actual_2024
    ]
)


prediction_all = np.concatenate(
    [
        prediction_2018,
        prediction_2024
    ]
)


accuracy = accuracy_score(
    actual_all,
    prediction_all
)


macro_f1 = f1_score(
    actual_all,
    prediction_all,
    average="macro"
)


print("\n==========================================")
print("MODEL RESULTS")
print("==========================================")

print(
    "2018 Accuracy:",
    round(accuracy_2018, 4)
)

print(
    "2024 Accuracy:",
    round(accuracy_2024, 4)
)

print(
    "Combined Accuracy:",
    round(accuracy, 4)
)

print(
    "Combined Macro F1:",
    round(macro_f1, 4)
)


# ============================================================
# 13. CLASSIFICATION REPORT
# ============================================================

print("\n==========================================")
print("CLASSIFICATION REPORT")
print("==========================================")

print(
    classification_report(

        actual_all,

        prediction_all,

        labels=[
            0,
            1,
            2,
            3,
            4
        ],

        target_names=[
            "Water",
            "Vegetation",
            "Agriculture",
            "Built-up",
            "Barren"
        ],

        zero_division=0
    )
)


# ============================================================
# 14. CONFUSION MATRIX
# ============================================================

cm = confusion_matrix(

    actual_all,

    prediction_all,

    labels=[
        0,
        1,
        2,
        3,
        4
    ]
)


print("\nConfusion Matrix:")

print(cm)


# ============================================================
# 15. PREDICT ALL 2018 DATA
# ============================================================

all_2018 = df[
    FEATURES_2018
].copy()

all_2018.columns = FEATURES


df["prediction_2018"] = model.predict(
    all_2018
)


# ============================================================
# 16. PREDICT ALL 2024 DATA
# ============================================================

all_2024 = df[
    FEATURES_2024
].copy()

all_2024.columns = FEATURES


df["prediction_2024"] = model.predict(
    all_2024
)


# ============================================================
# 17. CONVERT PREDICTIONS TO NAMES
# ============================================================

df["prediction_2018_name"] = (
    df["prediction_2018"]
    .map(CLASS_NAMES)
)


df["prediction_2024_name"] = (
    df["prediction_2024"]
    .map(CLASS_NAMES)
)


# ============================================================
# 18. CHANGE DETECTION
# ============================================================

def detect_change(row):

    old = row["prediction_2018"]

    new = row["prediction_2024"]


    # No change
    if old == new:
        return "No Change"


    # Vegetation loss
    if old == 1 and new != 1:
        return "Vegetation Loss"


    # Vegetation gain
    if old != 1 and new == 1:
        return "Vegetation Gain"


    # Urban expansion
    if old != 3 and new == 3:
        return "Urban Expansion"


    # Water loss
    if old == 0 and new != 0:
        return "Water Loss"


    # Water gain
    if old != 0 and new == 0:
        return "Water Gain"


    # Agriculture loss
    if old == 2 and new != 2:
        return "Agriculture Loss"


    # Agriculture gain
    if old != 2 and new == 2:
        return "Agriculture Gain"


    return "Other Change"


df["change_type"] = df.apply(
    detect_change,
    axis=1
)


# ============================================================
# 19. CHANGE MATRIX
# ============================================================

change_matrix = pd.crosstab(

    df["prediction_2018_name"],

    df["prediction_2024_name"]

)


print("\n==========================================")
print("2018 -> 2024 CHANGE MATRIX")
print("==========================================")

print(change_matrix)


# ============================================================
# 20. CHANGE STATISTICS
# ============================================================

change_statistics = (

    df["change_type"]

    .value_counts()

    .rename_axis("change_type")

    .reset_index(
        name="samples"
    )
)


change_statistics["percentage"] = (

    change_statistics["samples"]

    / len(df)

    * 100

)


print("\n==========================================")
print("CHANGE STATISTICS")
print("==========================================")

print(change_statistics)


# ============================================================
# 21. CLASS STATISTICS
# ============================================================

stats_2018 = (

    df["prediction_2018_name"]

    .value_counts()

    .rename_axis("class")

    .reset_index(
        name="samples"
    )
)


stats_2018["percentage"] = (

    stats_2018["samples"]

    / len(df)

    * 100

)


stats_2024 = (

    df["prediction_2024_name"]

    .value_counts()

    .rename_axis("class")

    .reset_index(
        name="samples"
    )
)


stats_2024["percentage"] = (

    stats_2024["samples"]

    / len(df)

    * 100

)


# ============================================================
# 22. FEATURE IMPORTANCE
# ============================================================

feature_importance = pd.DataFrame({

    "feature": FEATURES,

    "importance":
        model.feature_importances_

})


feature_importance = (
    feature_importance
    .sort_values(
        "importance",
        ascending=False
    )
)


print("\n==========================================")
print("FEATURE IMPORTANCE")
print("==========================================")

print(feature_importance)


# ============================================================
# 23. SAVE MODEL
# ============================================================

joblib.dump(

    {
        "model": model,

        "features": FEATURES,

        "classes": CLASS_NAMES
    },

    "SIH_2018_2024_RandomForest.pkl"
)


# ============================================================
# 24. SAVE PREDICTIONS
# ============================================================

prediction_columns = [

    "point_id",

    "region_id",

    "region",

    "latitude",

    "longitude",

    "DW_LABEL_2018",

    "DW_LABEL_2024",

    "prediction_2018",

    "prediction_2018_name",

    "prediction_2024",

    "prediction_2024_name",

    "change_type"
]


df[
    prediction_columns
].to_csv(

    "SIH_2018_2024_Predictions.csv",

    index=False
)


# ============================================================
# 25. SAVE CHANGE STATISTICS
# ============================================================

change_statistics.to_csv(

    "SIH_Change_Statistics.csv",

    index=False
)


# ============================================================
# 26. SAVE CLASS STATISTICS
# ============================================================

stats_2018.to_csv(

    "SIH_Class_Statistics_2018.csv",

    index=False
)


stats_2024.to_csv(

    "SIH_Class_Statistics_2024.csv",

    index=False
)


# ============================================================
# 27. SAVE CONFUSION MATRIX
# ============================================================

cm_df = pd.DataFrame(

    cm,

    index=[
        "Water",
        "Vegetation",
        "Agriculture",
        "Built-up",
        "Barren"
    ],

    columns=[
        "Water",
        "Vegetation",
        "Agriculture",
        "Built-up",
        "Barren"
    ]
)


cm_df.to_csv(
    "SIH_Confusion_Matrix.csv"
)


# ============================================================
# 28. SAVE MODEL METRICS
# ============================================================

metrics = pd.DataFrame({

    "metric": [

        "2018 Accuracy",

        "2024 Accuracy",

        "Combined Accuracy",

        "Combined Macro F1"

    ],

    "value": [

        accuracy_2018,

        accuracy_2024,

        accuracy,

        macro_f1

    ]
})


metrics.to_csv(

    "SIH_Model_Metrics.csv",

    index=False
)


# ============================================================
# 29. FINAL MESSAGE
# ============================================================

print("\n")
print("=" * 60)
print("PIPELINE COMPLETED SUCCESSFULLY")
print("=" * 60)

print("\nGenerated files:")

print(
    "1. SIH_2018_2024_RandomForest.pkl"
)

print(
    "2. SIH_2018_2024_Predictions.csv"
)

print(
    "3. SIH_Change_Statistics.csv"
)

print(
    "4. SIH_Class_Statistics_2018.csv"
)

print(
    "5. SIH_Class_Statistics_2024.csv"
)

print(
    "6. SIH_Confusion_Matrix.csv"
)

print(
    "7. SIH_Model_Metrics.csv"
)

print("\nYour model uses BOTH 2018 and 2024 data.")
print("Testing uses geographically unseen regions.")
print("Change detection uses the same geographic points.")
print("\nNext step: use the predictions for the change dashboard.")