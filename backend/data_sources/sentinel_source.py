"""
Sentinel-2 Data Source implementation.
Reads existing multispectral dataset SIH_SamePoints_2018_2024_Light.csv
and maps Dynamic World labels to the 5 SIH standard land cover classes.
"""
import os
import pandas as pd
from typing import List
from .base_source import BaseEODataSource


class SentinelSource(BaseEODataSource):
    """Sentinel-2 Multi-Spectral Data Source."""

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

    def __init__(self, csv_path: str = "data/raw/SIH_SamePoints_2018_2024_Light.csv"):
        super().__init__(source_name="ESA Sentinel-2 / Dynamic World")
        if not os.path.exists(csv_path) and os.path.exists("SIH_SamePoints_2018_2024_Light.csv"):
            csv_path = "SIH_SamePoints_2018_2024_Light.csv"
        self.csv_path = csv_path
        self._cached_df = None

    def get_supported_bands(self) -> List[str]:
        return ["B2", "B3", "B4", "B8", "B11", "B12"]

    def map_to_standard_classes(self, raw_labels: pd.Series) -> pd.Series:
        return raw_labels.map(self.LABEL_MAP)

    def compute_standard_indices(self, data: pd.DataFrame, suffix: str = "") -> pd.DataFrame:
        eps = 1e-8
        b2 = data[f"B2{suffix}"]
        b3 = data[f"B3{suffix}"]
        b4 = data[f"B4{suffix}"]
        b8 = data[f"B8{suffix}"]
        b11 = data[f"B11{suffix}"]
        b12 = data[f"B12{suffix}"]

        # Spectral Indices
        data[f"BSI{suffix}"] = ((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + eps)
        data[f"SAVI{suffix}"] = ((b8 - b4) * 1.5) / (b8 + b4 + 0.5)
        data[f"NBR{suffix}"] = (b8 - b12) / (b8 + b12 + eps)
        data[f"EVI{suffix}"] = 2.5 * (b8 - b4) / (b8 + 6.0 * b4 - 7.5 * b2 + 1.0 + eps)
        data[f"UI{suffix}"] = (b12 - b8) / (b12 + b8 + eps)
        data[f"NDMI{suffix}"] = (b8 - b11) / (b8 + b11 + eps)
        data[f"GRVI{suffix}"] = (b3 - b4) / (b3 + b4 + eps)

        # Spectral Composites & Ratios
        data[f"Brightness{suffix}"] = (b2 + b3 + b4 + b8 + b11 + b12) / 6.0
        data[f"Greenness{suffix}"] = b8 - (b4 + b3) / 2.0
        data[f"SWIR_Ratio{suffix}"] = b11 / (b12 + eps)
        data[f"NIR_Red_Ratio{suffix}"] = b8 / (b4 + eps)
        data[f"NIR_Green_Ratio{suffix}"] = b8 / (b3 + eps)

        # Differences
        if f"NDBI{suffix}" in data.columns and f"NDVI{suffix}" in data.columns:
            data[f"NDBI_NDVI_diff{suffix}"] = data[f"NDBI{suffix}"] - data[f"NDVI{suffix}"]
        if f"MNDWI{suffix}" in data.columns and f"NDVI{suffix}" in data.columns:
            data[f"MNDWI_NDVI_diff{suffix}"] = data[f"MNDWI{suffix}"] - data[f"NDVI{suffix}"]

        return data

    def load_data(self) -> pd.DataFrame:
        if self._cached_df is not None:
            return self._cached_df

        if not os.path.exists(self.csv_path):
            raise FileNotFoundError(f"Sentinel dataset not found at {self.csv_path}")

        df = pd.read_csv(self.csv_path)

        # Map labels
        if "DW_LABEL_2018" in df.columns:
            df["class_2018"] = self.map_to_standard_classes(df["DW_LABEL_2018"])
            df["class_2018_name"] = df["class_2018"].map(self.CLASS_NAMES)
        if "DW_LABEL_2024" in df.columns:
            df["class_2024"] = self.map_to_standard_classes(df["DW_LABEL_2024"])
            df["class_2024_name"] = df["class_2024"].map(self.CLASS_NAMES)

        # Compute indices for 2018 and 2024
        df = self.compute_standard_indices(df, suffix="_2018")
        df = self.compute_standard_indices(df, suffix="_2024")

        self._cached_df = df
        return df
