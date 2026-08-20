# SIH25170 Frontend ↔ ML Backend Contract

## Purpose

Keep frontend development independent from the ML/dataset
implementation.

The frontend consumes stable API responses.

## Start Analysis

`POST /api/analyses`

Input may include: - image/file - area/location - date -
dataset/source - optional metadata

Response:

``` json
{
  "analysis_id": "analysis_123",
  "status": "queued"
}
```

## Status

`GET /api/analyses/{analysis_id}`

``` json
{
  "analysis_id": "analysis_123",
  "status": "processing",
  "progress": 65,
  "stage": "finding_changes"
}
```

Frontend should translate technical stages into simple user-facing
messages.

Example: - `vision_analysis` → "Checking the image..." -
`change_detection` → "Finding changes..." - `report_generation` →
"Preparing results..."

## Results

`GET /api/analyses/{analysis_id}/results`

Example:

``` json
{
  "analysis_id": "analysis_123",
  "summary": "Vegetation decreased while developed areas increased.",
  "findings": [
    {
      "id": "finding_1",
      "label": "vegetation",
      "status": "decreased",
      "description": "Vegetation decreased in the western part of the selected area.",
      "confidence": 0.92,
      "geometry": null
    }
  ],
  "statistics": {},
  "metadata": {}
}
```

## Important Frontend Rules

-   Do not invent data.
-   Do not invent confidence.
-   Do not invent area values.
-   Do not invent change percentages.
-   Handle missing geometry.
-   Handle missing statistics.
-   Handle failed analysis.
-   Handle partial results.
-   Keep API code separate from UI components.

## Chat

`POST /api/analyses/{analysis_id}/chat`

Input:

``` json
{
  "message": "Why did vegetation decrease?"
}
```

Response:

``` json
{
  "answer": "Vegetation decreased mainly in the western part of the area.",
  "references": [
    {
      "finding_id": "finding_1"
    }
  ]
}
```

## Comparison

`POST /api/comparisons`

Input: - first image/analysis - second image/analysis

Response:

``` json
{
  "comparison_id": "comparison_123",
  "status": "queued"
}
```

Results can contain: - changes - categories - statistics - geometries -
explanation

## Mock Data

During frontend development, use mock API responses.

Mock data must: - live in `mocks/` - use the same TypeScript types as
real API data - be obviously replaceable - never be presented as real
analysis

## Suggested Frontend Structure

``` text
src/
  app/
  components/
    layout/
    home/
    analysis/
    compare/
    history/
    help/
    common/
  lib/
    api/
    types/
    utils/
  hooks/
  mocks/
  styles/
```
