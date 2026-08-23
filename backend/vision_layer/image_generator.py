"""
EO Image Generator.
Synthesizes high-resolution satellite image patches (True Color Composite,
False Color Composite, NDVI Heatmap, and Land Cover Classification Overlays)
from multispectral bands and spatial context.
"""
import io
import base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from typing import Dict, Any, Optional


class EOImageGenerator:
    """
    Renders satellite imagery views from Sentinel-2 / EO spectral bands.
    Supports True Color (RGB), False Color Infrared (FCC), NDVI, and ML Overlays.
    """

    CLASS_COLORS_RGB = {
        0: (0, 119, 190),     # Water (Blue)
        1: (46, 125, 50),     # Vegetation (Forest/Trees)
        2: (139, 195, 74),    # Agriculture (Crops/Farmland)
        3: (211, 47, 47),     # Built-up (Urban/Structures)
        4: (255, 152, 0)      # Barren (Soil/Sand)
    }

    CLASS_NAMES = {
        0: "Water",
        1: "Vegetation",
        2: "Agriculture",
        3: "Built-up",
        4: "Barren"
    }

    def __init__(self, patch_size: int = 256):
        self.patch_size = patch_size

    def _normalize_band(self, val: float, min_val: float = 0.0, max_val: float = 0.5) -> float:
        """Clamps and normalizes reflectance values to [0, 1]."""
        v = (val - min_val) / (max_val - min_val + 1e-8)
        return float(np.clip(v, 0.0, 1.0))

    def _generate_synthetic_texture(self, base_rgb: tuple, variance: float, class_id: int, seed: int = 42) -> np.ndarray:
        """
        Creates realistic micro-texture patterns (e.g. canopy grain, urban edges, water ripples)
        based on the spectral reflectance and land-cover class.
        """
        np.random.seed(seed % 100000)
        h = self.patch_size
        w = self.patch_size

        # Create base color array
        img = np.zeros((h, w, 3), dtype=np.float32)
        for c in range(3):
            img[:, :, c] = base_rgb[c] / 255.0

        # Generate noise / pattern based on class
        if class_id == 0:  # Water - subtle smooth waves
            x = np.linspace(0, 10, w)
            y = np.linspace(0, 10, h)
            xx, yy = np.meshgrid(x, y)
            ripple = 0.04 * np.sin(xx + yy) + 0.02 * np.random.randn(h, w)
            for c in range(3):
                img[:, :, c] = np.clip(img[:, :, c] + ripple, 0.0, 1.0)

        elif class_id == 1:  # Vegetation - canopy texture
            noise = np.random.normal(0, 0.08, (h, w))
            # Smooth texture
            img[:, :, 0] = np.clip(img[:, :, 0] + noise * 0.5, 0.0, 1.0)
            img[:, :, 1] = np.clip(img[:, :, 1] + noise * 1.0, 0.0, 1.0)
            img[:, :, 2] = np.clip(img[:, :, 2] + noise * 0.4, 0.0, 1.0)

        elif class_id == 2:  # Agriculture - field line textures
            grid_y = (np.arange(h)[:, None] % 16 < 3).astype(float) * 0.08
            grid_x = (np.arange(w)[None, :] % 24 < 2).astype(float) * 0.06
            noise = np.random.normal(0, 0.04, (h, w))
            pattern = grid_y + grid_x + noise
            for c in range(3):
                img[:, :, c] = np.clip(img[:, :, c] + pattern * (0.8 if c == 1 else 0.5), 0.0, 1.0)

        elif class_id == 3:  # Built-up - blocky urban street grid & rooftop patterns
            grid_x = (np.arange(w)[None, :] % 20 < 4).astype(float) * 0.15
            grid_y = (np.arange(h)[:, None] % 20 < 4).astype(float) * 0.15
            buildings = (grid_x + grid_y) + np.random.normal(0, 0.09, (h, w))
            for c in range(3):
                img[:, :, c] = np.clip(img[:, :, c] + buildings * 0.7, 0.0, 1.0)

        else:  # Barren - sandy / granular noise
            noise = np.random.normal(0, 0.07, (h, w))
            for c in range(3):
                img[:, :, c] = np.clip(img[:, :, c] + noise, 0.0, 1.0)

        return (img * 255).astype(np.uint8)

    def render_point_imagery(
        self,
        point_data: Dict[str, Any],
        year: int = 2024,
        mode: str = "rgb"
    ) -> Image.Image:
        """
        Renders a synthetic satellite image patch for the requested point, year, and visualization mode.
        Modes:
        - 'rgb': True Color Composite (B4, B3, B2)
        - 'fcc': False Color Infrared (B8 NIR, B4 Red, B3 Green)
        - 'ndvi': Colorized NDVI map
        - 'overlay': Land Cover classification mask overlay
        """
        suffix = f"_{year}"
        b2 = float(point_data.get(f"B2{suffix}", point_data.get("B2", 0.08)))
        b3 = float(point_data.get(f"B3{suffix}", point_data.get("B3", 0.10)))
        b4 = float(point_data.get(f"B4{suffix}", point_data.get("B4", 0.12)))
        b8 = float(point_data.get(f"B8{suffix}", point_data.get("B8", 0.25)))
        ndvi = float(point_data.get(f"NDVI{suffix}", point_data.get("NDVI", (b8 - b4)/(b8 + b4 + 1e-8))))

        pred_class = int(point_data.get(f"prediction_{year}", point_data.get(f"class_{year}", 1)))
        point_id = int(point_data.get("point_id", 0))

        if mode == "rgb":
            # True Color: R=B4, G=B3, B=B2
            r_norm = int(self._normalize_band(b4, 0.02, 0.35) * 255)
            g_norm = int(self._normalize_band(b3, 0.02, 0.30) * 255)
            b_norm = int(self._normalize_band(b2, 0.01, 0.25) * 255)
            base_color = (r_norm, g_norm, b_norm)
            arr = self._generate_synthetic_texture(base_color, variance=0.1, class_id=pred_class, seed=point_id + year)
            img = Image.fromarray(arr)

        elif mode == "fcc":
            # False Color Infrared: R=B8 (NIR), G=B4 (Red), B=B3 (Green)
            r_norm = int(self._normalize_band(b8, 0.05, 0.50) * 255)
            g_norm = int(self._normalize_band(b4, 0.02, 0.35) * 255)
            b_norm = int(self._normalize_band(b3, 0.02, 0.30) * 255)
            base_color = (r_norm, g_norm, b_norm)
            arr = self._generate_synthetic_texture(base_color, variance=0.1, class_id=pred_class, seed=point_id + year + 7)
            img = Image.fromarray(arr)

        elif mode == "ndvi":
            # Colorized NDVI Heatmap
            # -1 to 0: Blue (Water), 0 to 0.2: Red/Orange (Barren/Urban), 0.2 to 0.4: Yellow/Light Green (Agri), 0.4+: Dark Green (Dense Veg)
            h, w = self.patch_size, self.patch_size
            arr = np.zeros((h, w, 3), dtype=np.uint8)

            ndvi_clamped = np.clip(ndvi, -0.5, 0.8)
            # Center circular gradient
            y, x = np.ogrid[:h, :w]
            dist = np.sqrt((x - w/2)**2 + (y - h/2)**2) / (w/2)
            local_ndvi = ndvi_clamped + (np.random.randn(h, w) * 0.05) - (dist * 0.04)

            # Colormap
            water_mask = local_ndvi < 0.0
            barren_mask = (local_ndvi >= 0.0) & (local_ndvi < 0.2)
            agri_mask = (local_ndvi >= 0.2) & (local_ndvi < 0.45)
            veg_mask = local_ndvi >= 0.45

            arr[water_mask] = [20, 80, 200]
            arr[barren_mask] = [230, 140, 40]
            arr[agri_mask] = [170, 220, 60]
            arr[veg_mask] = [20, 150, 40]

            img = Image.fromarray(arr)
            img = img.filter(ImageFilter.GaussianBlur(radius=1.5))

        elif mode == "overlay":
            # Land Cover Classification Overlay
            base_rgb = self.CLASS_COLORS_RGB.get(pred_class, (120, 120, 120))
            arr = self._generate_synthetic_texture(base_rgb, variance=0.08, class_id=pred_class, seed=point_id + year)
            img = Image.fromarray(arr)

            # Draw semi-transparent label banner
            draw = ImageDraw.Draw(img)
            class_name = self.CLASS_NAMES.get(pred_class, "Unknown")
            conf = float(point_data.get(f"confidence_{year}", 0.85)) * 100
            label_text = f"{year}: {class_name} ({conf:.1f}%)"
            draw.rectangle([(0, self.patch_size - 28), (self.patch_size, self.patch_size)], fill=(0, 0, 0))
            draw.text((8, self.patch_size - 22), label_text, fill=(255, 255, 255))
        else:
            img = Image.new("RGB", (self.patch_size, self.patch_size), color=(100, 100, 100))

        return img

    def get_image_base64(self, point_data: Dict[str, Any], year: int = 2024, mode: str = "rgb") -> str:
        """Generate and return Base64 Data URI string for HTML embedding."""
        img = self.render_point_imagery(point_data, year=year, mode=mode)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"
