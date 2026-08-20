<div align="center">

# 🌍 GeoVision AI

### Multimodal Satellite Land Change Detection & Automated EO Reporting

**Making Earth Observation simple for everyone.**

![Project](https://img.shields.io/badge/Project-GeoVision_AI-1f6f50)
![Theme](https://img.shields.io/badge/Theme-Space_Technology-17466d)
![Category](https://img.shields.io/badge/Category-Software-5d3fd3)
![Status](https://img.shields.io/badge/Status-In_Development-f0a500)

</div>

---

## 🌱 About the Project

GeoVision AI is a simple Earth Observation application that helps users understand how land has changed over time.

A user selects a location and two time periods. The system compares satellite imagery and presents the detected changes through:

- 🛰️ Before-and-after satellite images
- 🌳 Vegetation change
- 💧 Water-body change
- 🏙️ Possible built-up growth
- 📊 Area and percentage statistics
- 🗺️ Simple change maps
- 📄 Human-readable reports

The product is designed for farmers, students, government workers and other non-technical users who may not understand AI, GIS or remote sensing.

> **Simple for everyone, powerful when needed.**

---

## 🚀 What Problem Are We Solving?

Satellite imagery contains valuable information, but traditional Earth Observation tools can be difficult for non-technical users.

Users often need to understand:

- What changed?
- Where did it change?
- How much area changed?
- What does the change mean?

GeoVision AI converts technical satellite analysis into clear maps, measurements and simple explanations.

---

## 🧭 SIH 2025 Alignment

This project is inspired by:

| Field | Details |
|---|---|
| **Problem Statement ID** | SIH25170 |
| **Organization** | ISRO, Department of Space |
| **Theme** | Space Technology |
| **Category** | Software |
| **Title** | Enhancing OpenAI’s GPT-OSS with Multimodal Vision Capabilities extensible to ISRO EO Data |

GeoVision AI demonstrates a focused Earth Observation application aligned with the multimodal vision direction of SIH25170.

It combines:

- Temporal satellite imagery
- Geospatial change maps
- Spectral indicators
- Numerical statistics
- Human-readable reports

> **Important:** The current prototype does not claim to train or enhance GPT-OSS. GPT-OSS multimodal integration is part of the future scope.

---

## 👥 Who Is It For?

- 👨‍🌾 Farmers monitoring land, crops and water
- 🎓 Students learning about environmental change
- 🏛️ Government workers reviewing regional changes
- 🔬 Researchers conducting preliminary analysis
- 🌍 Citizens exploring changes in their surroundings

No prior knowledge of AI, GIS, satellites or remote sensing is required.

---

## ✨ Core Features

- Select a location or area of interest
- Choose two years or time periods
- Compare before-and-after satellite imagery
- Detect vegetation gain or loss
- Monitor water-body expansion or shrinkage
- Identify possible built-up expansion
- Calculate changed area in hectares
- Display change percentages
- Generate an understandable summary
- Download reports and results when available
- Open technical details through an optional Expert View

---

## 🛰️ Data and Analysis

The application can use Sentinel satellite imagery through Google Earth Engine.

### Vegetation Change

Vegetation change can be analysed using NDVI:

\[
NDVI = \frac{NIR - Red}{NIR + Red}
\]

### Water Change

Water-body change can be analysed using MNDWI:

\[
MNDWI = \frac{Green - SWIR}{Green + SWIR}
\]

### Possible Built-Up Change

Possible built-up growth can be analysed using NDBI:

\[
NDBI = \frac{SWIR - NIR}{SWIR + NIR}
\]

Technical terms are not displayed by default. Normal users see simple labels such as:

| Technical term | Simple label |
|---|---|
| NDVI decrease | Vegetation decreased |
| MNDWI change | Water area changed |
| NDBI increase | Possible built-up growth |
| AOI | Selected area |
| Run inference | Start analysis |

---

## 🧭 Simple User Flow

```mermaid
flowchart TD
    A[Choose a location] --> B[Select two time periods]
    B --> C[Start analysis]
    C --> D[Process satellite imagery]
    D --> E[View what changed]
    E --> F[Read or download report]
