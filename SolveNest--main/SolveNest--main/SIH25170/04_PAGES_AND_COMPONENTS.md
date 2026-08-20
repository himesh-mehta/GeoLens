# SIH25170 Pages and Components

## Shared Components

-   AppShell
-   SimpleSidebar
-   MobileHeader
-   PageHeader
-   LanguageSelector
-   UserMenu
-   PrimaryButton
-   SecondaryButton
-   StatusBadge
-   EmptyState
-   ErrorState
-   LoadingState

## Home Components

-   WelcomeHeader
-   AreaSelector
-   UploadEOData
-   RecentAreas
-   SimpleGettingStarted

The Home page should not contain a large analytics dashboard.

## My Areas Components

-   AreaList
-   AreaCard
-   SearchAreas
-   OpenAreaButton

## Analysis Components

### AreaHeader

Shows: - area name - date - simple analysis status

### EOViewer

Shows: - main EO image - basic zoom - reset - fullscreen

### WhatWeFound

Three to five high-value findings maximum in the default view.

Example: - Vegetation --- Decreased - Buildings --- Increased - Water
--- No major change

### FindingCard

Contains: - simple label - simple result - short explanation - See
details

### EvidenceViewer

Highlights the region related to a selected finding.

### AskAI

Simple conversational input.

Example placeholder: "Ask something about this area..."

Suggested questions: - What changed here? - Where did vegetation
decrease? - Show me the change area. - Explain this result.

### SimpleSummary

Short natural-language explanation.

### TechnicalDetails

Collapsed by default.

Contains: - source - sensor - date - resolution - coordinates -
confidence - processing details

## Compare Components

-   CompareHeader
-   BeforeImage
-   AfterImage
-   SwipeControl
-   SimpleChangeSummary
-   ChangeHighlight
-   CompareDetails

## History Components

-   HistoryList
-   HistoryItem
-   Search
-   DateFilter

## Help Components

-   SimpleFAQ
-   HowItWorks
-   GettingStarted

## Component Rule

Every component must have one clear responsibility.

Avoid giant components containing the entire application.

Use reusable components rather than copying similar UI between pages.
