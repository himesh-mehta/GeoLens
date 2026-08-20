# SIH25170 Frontend Master Specification

## Goal

Create a user-friendly Earth Observation analysis platform powered by
GPT-OSS.

The system should help ordinary users understand changes in an area
using EO imagery without requiring technical knowledge.

## Product Promise

**Select your area → See the image → Ask what you want to know → Get a
simple answer with visual evidence.**

## Primary Users

### General users

-   Farmers
-   Students
-   General public
-   Semi-educated/non-technical users

### Advanced users

-   Researchers
-   GIS professionals
-   Government users
-   Technical evaluators

The general-user experience is the default.

## Simple Mode

The main interface should focus on five things:

1.  Your area
2.  Your image/data
3.  What we found
4.  What changed
5.  Ask a question

## Expert Mode

Technical information can be opened when needed: - Sensor -
Dataset/source - Resolution - Coordinates - Acquisition date - Bands -
Confidence - Technical statistics - Processing details

Never make Expert Mode the default.

## Main User Flow

1.  Open the application.
2.  Select an area OR upload EO imagery.
3.  Select/confirm the date if required.
4.  Start analysis.
5.  See a clear processing status.
6.  View the image.
7.  Read simple findings.
8.  Ask a question in natural language.
9.  Open visual details if needed.
10. Compare dates when comparison data is available.
11. Generate a report if required.

## UI Philosophy

The application should feel: - calm - trustworthy - clear - scientific
but approachable - modern - accessible

It should NOT feel: - flashy - futuristic for the sake of appearance -
crowded - technical - like a generic AI chatbot - like a developer
dashboard

## Default Screen Density

Prefer one large useful visual and a few important findings over many
small cards.

A user should understand the screen within a few seconds.

## Information Hierarchy

Always prioritize:

1.  Location/area
2.  Main image/map
3.  Simple result
4.  Visual evidence
5.  Ask AI
6.  Details

## Language

Use everyday words.

Examples:

Avoid: - "land-cover transition" - "spectral anomaly" - "multispectral
classification"

Prefer: - "What changed?" - "Vegetation decreased" - "Buildings
increased" - "Water area changed"

Technical terms can appear in Expert Mode.

## AI Positioning

Do not make the AI the entire product.

The EO data is the primary object.

The AI is the assistant that helps the user understand it.
