# SIH25170 Frontend Documentation --- Read First

## Product Direction

Build a simple Earth Observation application that a farmer, student,
government worker, or non-technical user can understand without knowing
AI, GIS, satellites, or remote sensing.

**Core principle: Simple for everyone, powerful when needed.**

The interface must not look like a flashy AI-generated website or a
complex GIS control room.

## Reading Order

1.  `01_FRONTEND_MASTER_SPEC.md`
2.  `02_INFORMATION_ARCHITECTURE.md`
3.  `03_UI_DESIGN_SYSTEM.md`
4.  `04_PAGES_AND_COMPONENTS.md`
5.  `05_SIMPLE_USER_FLOW.md`
6.  `06_ANALYSIS_WORKSPACE_SPEC.md`
7.  `07_FRONTEND_BACKEND_CONTRACT.md`
8.  `08_AGENT_BUILD_RULES.md`

## Non-Negotiable Rules

-   Do not redesign the application independently.
-   Reuse the existing design system and components.
-   Do not add decorative UI just to make the page look impressive.
-   Do not expose technical ML/EO concepts by default.
-   Do not show fake AI results, statistics, confidence values, or
    imagery.
-   Do not create a dashboard packed with charts.
-   Every screen must have one obvious primary action.
-   Use simple English in user-facing text.
-   Keep technical details available through an optional Expert/Details
    view.
