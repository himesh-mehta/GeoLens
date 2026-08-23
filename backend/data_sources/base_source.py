"""
Abstract Base Class for pluggable Earth Observation (EO) Data Sources.
Provides an extensible interface to ingest data from Sentinel-2, Landsat,
or Indian Space Research Organisation (ISRO) satellites (Cartosat, Resourcesat, Oceansat).
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
import pandas as pd


class BaseEODataSource(ABC):
    """
    Abstract interface for all EO Data Sources.
    Ensures seamless pluggability for current and future satellite missions.
    """

    def __init__(self, source_name: str):
        self.source_name = source_name

    @abstractmethod
    def load_data(self) -> pd.DataFrame:
        """Load and return standard structured dataframe of EO points."""
        pass

    @abstractmethod
    def get_supported_bands(self) -> List[str]:
        """Return list of supported spectral bands for this sensor."""
        pass

    @abstractmethod
    def compute_standard_indices(self, data: pd.DataFrame, suffix: str = "") -> pd.DataFrame:
        """
        Compute standard spectral indices (NDVI, NDWI, MNDWI, NDBI, BSI, SAVI, NBR, etc.)
        from the available sensor bands.
        """
        pass

    @abstractmethod
    def map_to_standard_classes(self, raw_labels: pd.Series) -> pd.Series:
        """Map sensor-specific or catalog land-cover classes to the 5 SIH project classes."""
        pass
