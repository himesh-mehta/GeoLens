# SIH25170 Agent Build Rules

## Before Coding

Read: - `00_READ_ME_FIRST.md` - `01_FRONTEND_MASTER_SPEC.md` -
`03_UI_DESIGN_SYSTEM.md`

Then read the page-specific specification.

## Do Not Change the Product Direction

Agents must not independently introduce: - neon themes - dark futuristic
dashboards - glassmorphism - huge gradients - animated backgrounds - 3D
AI graphics - excessive cards - excessive charts - giant hero sections -
decorative statistics

## User First

Ask:

**Can a farmer understand this screen without knowing what GPT-OSS or
satellite bands are?**

If not, simplify it.

## One Primary Action

Every page should have one obvious primary action.

Examples: - Home → Select an area - Upload → Analyze image - Analysis →
Ask a question - Compare → Compare images

## Progressive Disclosure

Show simple information first.

Hide technical information under: - View details - Technical details -
Expert mode

## No Fake Intelligence

Never use: - fake confidence scores - fake analysis - fake satellite
data - fake statistics - fake AI responses

If the backend is not ready, use clearly labeled mock data in
development.

## No Overengineering

Do not build every possible feature immediately.

Build in this order:

1.  App shell
2.  Home
3.  Area selection/upload
4.  Analysis screen
5.  Image viewer
6.  Simple findings
7.  AI chat
8.  Compare
9.  History
10. Expert details
11. Reports

## Visual Consistency

Before creating a new component: 1. Check whether an existing component
can be reused. 2. Follow the same spacing. 3. Follow the same
typography. 4. Follow the same button styles. 5. Follow the same
border/radius rules.

## Responsive

Test: - mobile - tablet - desktop

The core flow must work on a phone.

## Accessibility

Use: - semantic HTML - labels - keyboard support - focus states -
readable contrast - touch-friendly controls

## Copywriting

Use short, friendly sentences.

Good: - "What would you like to know?" - "What changed here?" - "Show me
where vegetation decreased." - "No major change found."

Avoid: - "Initiate multimodal inference" - "Execute EO classification" -
"Run temporal segmentation" - "Configure inference parameters"

## Final Review Before Commit

Check: - Is the screen simple? - Is the main action obvious? - Is there
unnecessary information? - Are all displayed values real or clearly
mocked? - Does it work on mobile? - Does it match the design system? -
Did the change break another page?
