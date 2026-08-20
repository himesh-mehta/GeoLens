"""
ISRO (Indian Space Research Organisation) EO Data Adapter.
Enables pluggable integration of ISRO satellite missions:
- Resourcesat-2 / 2A (LISS-3, LISS-4, AWiFS)
- Cartosat-2 / 3 (High-Resolution Optical PAN + Multispectral)
- Oceansat-2 / 3 (Ocean Colour Monitor - OCM)
- GISAT-1 / EOS-04 (Radar Imaging Satellite - RISAT)

Standardizes ISRO band conventions (Green, Red, NIR, SWIR) and Bhuvan Land Cover
classes to the 5 SIH project classes.
"""
import os
import pandas as pd
from typing import Dict, List, Optional
from .base_source import BaseEODataSource


class ISRODataSource(BaseEODataSource):
    """
    Pluggable Data Source Adapter for ISRO Bhuvan / NRSC products.
    """

    # Mapping from ISRO LISS-3/4 Band names to Standard Optical bands:
    # Band 2: Green (0.52 - 0.59 µm) -> B3
    # Band 3: Red (0.62 - 0.68 µm)   -> B4
    # Band 4: NIR (0.77 - 0.86 µm)   -> B8
    # Band 5: SWIR (1.55 - 1.70 µm)  -> B11
    ISRO_TO_STANDARD_BANDS = {
        "LISS_B2": "B3",   # Green
        "LISS_B3": "B4",   # Red
        "LISS_B4": "B8",   # NIR
        "LISS_B5": "B11",  # SWIR1
        "CARTOSAT_PAN": "B8"
    }

    # Bhuvan 1:50,000 / 1:250,000 Land Use Land Cover (LULC) Level-1 to SIH classes
    BHUVAN_CLASS_MAP = {
        "Water bodies": 0,
        "Forest": 1,
        "Scrubland": 1,
        "Grassland": 1,
        "Plantations": 1,
        "Cropland": 2,
        "Agricultural land": 2,
        "Fallow land": 2,
        "Built up (Urban)": 3,
        "Built up (Rural)": 3,
        "Industrial area": 3,
        "Mining / Industrial": 3,
        "Barren / unculturable": 4,
        "Sandy area": 4,
        "Snow / Glacial": 4,
        "Wastelands": 4
    }

    CLASS_NAMES = {
        0: "Water",
        1: "Vegetation",
        2: "Agriculture",
        3: "Built-up",
        4: "Barren"
    }

    def __init__(self, filepath: Optional[str] = None, mission: str = "Resourcesat-2A LISS-4"):
        super().__init__(source_name=f"ISRO NRSC / Bhuvan ({mission})")
        self.filepath = filepath
        self.mission = mission

    def get_supported_bands(self) -> List[str]:
        return ["B2", "B3", "B4", "B8", "B11", "B12"]

    def map_to_standard_classes(self, raw_labels: pd.Series) -> pd.Series:
        return raw_labels.map(lambda x: self.BHUVAN_CLASS_MAP.get(str(x), 4))

    def compute_standard_indices(self, data: pd.DataFrame, suffix: str = "") -> pd.DataFrame:
        eps = 1e-8
        b2 = data.get(f"B2{suffix}", data.get(f"B3{suffix}", 0.0))
        b3 = data[f"B3{suffix}"]
        b4 = data[f"B4{suffix}"]
        b8 = data[f"B8{suffix}"]
        b11 = data.get(f"B11{suffix}", data.get(f"B4{suffix}", 0.0))
        b12 = data.get(f"B12{suffix}", b11)

        # Compute standard indices for ISRO data
        data[f"NDVI{suffix}"] = (b8 - b4) / (b8 + b4 + eps)
        data[f"NDWI{suffix}"] = (b3 - b8) / (b3 + b8 + eps)
        data[f"SAVI{suffix}"] = ((b8 - b4) * 1.5) / (b8 + b4 + 0.5)
        data[f"BSI{suffix}"] = ((b11 + b4) - (b8 + b2)) / ((b11 + b4) + (b8 + b2) + eps)
        data[f"Brightness{suffix}"] = (b3 + b4 + b8 + b11) / 4.0
        data[f"Greenness{suffix}"] = b8 - (b4 + b3) / 2.0
        return data

    def load_data(self) -> pd.DataFrame:
        if self.filepath and os.path.exists(self.filepath):
            df = pd.read_csv(self.filepath)
            # Rename ISRO band headers if present
            rename_map = {k: v for k, v in self.ISRO_TO_STANDARD_BANDS.items() if k in df.columns}
            if rename_map:
                df = df.rename(columns=rename_map)
            return self.compute_standard_indices(df)
        else:
            # Returns empty dataframe with schema when no file is mounted
            cols = ["point_id", "region", "latitude", "longitude", "B2", "B3", "B4", "B8", "B11", "B12", "NDVI", "NDWI", "SAVI", "BSI"]
            return pd.DataFrame(columns=cols)
