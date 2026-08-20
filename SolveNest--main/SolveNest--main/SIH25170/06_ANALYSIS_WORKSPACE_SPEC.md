# SIH25170 Analysis Workspace

## Purpose

This is the main result screen.

It should answer three questions immediately:

1.  What area am I looking at?
2.  What did the system find?
3.  What can I ask next?

## Recommended Layout

``` text
┌──────────────────────────────────────────────┐
│ ← Back     Your Area                 Help     │
├──────────────────────────────────────────────┤
│                                              │
│                EO IMAGE / MAP                │
│                                              │
├──────────────────────────────────────────────┤
│ What we found                                │
│                                              │
│ 🌱 Vegetation      Decreased                 │
│ 🏠 Buildings       Increased                 │
│ 💧 Water           No major change           │
├──────────────────────────────────────────────┤
│ What changed?                                │
│ [Earlier image] → [Recent image]             │
│                                              │
│ Short AI summary                             │
├──────────────────────────────────────────────┤
│ Ask a question                               │
│ [ Type your question...                 ➤ ] │
└──────────────────────────────────────────────┘
```

## Desktop Enhancement

On larger screens, the AI assistant can appear as a right-side panel.

The map/image remains the largest area.

## Default Finding Limit

Show only the most important findings.

If more exist:

**See all findings**

## Simple Wording

Example:

Bad: "Built-up land cover increased by 13.4%."

Default: "Buildings and developed areas increased."

Technical details: "Built-up land cover increased by 13.4%."

## Evidence

When a user taps a finding: - highlight region - explain result - show
source/date if available

## AI Chat

The assistant must be contextual to the selected area.

Good: "Based on the images you selected, vegetation decreased mainly in
the western part."

Bad: Generic chatbot response unrelated to the selected imagery.

## Error

If AI cannot confidently answer:

"I couldn't determine this from the available image."

Then suggest: - Try another question - View the image - Compare another
date

Do not fabricate an answer.

## Processing

Long-running analysis should show understandable progress.

Example:

"Checking the images..."

"Finding changes..."

"Preparing your results..."

Avoid exposing internal model names during processing.

## Technical Details

Place a clearly labeled expandable section:

**Technical details**

Never show it automatically unless the user is in Expert Mode.
