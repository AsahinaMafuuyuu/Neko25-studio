---
target: button UI and layout color
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-06-16T01-15-19Z
slug: ton-tsx-app-locale-dashboard-page-tsx-layout-color
---
# Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading/route/progress states exist; selected button/card states could be more standardized. |
| 2 | Match System / Real World | 3 | Familiar product controls; dashboard still says SaaS/backend in some surfaces instead of creator/video production. |
| 3 | User Control and Freedom | 3 | Clear auth/dashboard navigation; dashboard routes need consistently visible exits/cancel actions in creation flows. |
| 4 | Consistency and Standards | 3 | Shared Button is cohesive; page-level tonal cards and custom pill buttons drift from the central system. |
| 5 | Error Prevention | 3 | Forms have validation and disabled states; destructive/recharge flows rely on page-specific patterns. |
| 6 | Recognition Rather Than Recall | 3 | Icons are usually paired with text; some icon-only controls depend on title/aria. |
| 7 | Flexibility and Efficiency | 2 | Keyboard shortcut exists for sidebar; no visible command/power path for creator-heavy workflows. |
| 8 | Aesthetic and Minimalist Design | 3 | Strong premium base; color surfaces compete in dashboard home and billing pages. |
| 9 | Error Recovery | 3 | Auth has useful validation/toasts; dashboard async failures are unevenly surfaced. |
| 10 | Help and Documentation | 2 | Little contextual help beyond helper text and empty states. |
| **Total** | | **28/40** | **Good foundation; color/action hierarchy needs tightening.** |

# Anti-Patterns Verdict

LLM assessment: The UI does not look like obvious AI slop. The design has a real system: OKLCH tokens, compact controls, strong black/white contrast, disciplined violet primary, and cinematic media panels. The risk is second-order sameness: many dashboard surfaces reuse the same formula of rounded card + violet/teal tint + icon badge + soft shadow, so the premium control-room idea can flatten into a familiar generated-dashboard rhythm.

Deterministic scan: `detect.mjs --json components app` returned `[]`. No detector hits for hard banned patterns such as gradient text, side-stripe cards, or repeated obvious scaffolding.

Visual evidence: Live inspection of `http://localhost:3000/zh` and `/zh/sign-in` confirmed the shared button shape, color tokens, and auth layout render as intended. `/zh/dashboard` redirects to auth without a session, so dashboard assessment uses source evidence from `app/[locale]/dashboard/page.tsx`, `components/dashboard/dashboard-shell.tsx`, `components/dashboard/billing-page.tsx`, and shared UI components.

# Overall Impression

The button primitive is solid: compact, readable, keyboard-focusable, and aligned with the design system. The bigger issue is color authority. Violet is supposed to mean primary action/current state/progress, but the dashboard uses violet, teal, dark media overlays, tonal cards, rounded badges, gradients, and glows in too many adjacent roles. That makes the interface feel polished but less decisive.

# What's Working

- Shared buttons in `components/ui/button.tsx` have a good product scale: 36px default, 40/44-ish large use, consistent radius, focus rings, disabled state, icon sizing, and straightforward variants.
- The palette in `app/globals.css` matches `DESIGN.md`: warm gallery background, ink foreground, Studio Violet, and Creator Teal. Contrast appears strong on the visible landing/auth surfaces.
- The public/auth surfaces create a credible premium feel: dark media panel on one side, restrained form card on the other, and primary actions that are easy to find.

# Priority Issues

**[P1] Color authority is diluted**

Why it matters: The design doc says violet is for decisions, current location, focus, and generation progress. In practice, violet also appears in badges, cards, icon wells, gradients, section panels, chart shadows, and decorative tints. Users lose the fast visual answer to "what should I do next?"

Fix: Reserve saturated `bg-primary` for primary CTAs, selected navigation, focused controls, and progress. Convert decorative violet blocks to neutral surfaces with `border-primary/15` or a tiny icon/text accent. Use teal only for positive/generated/ready states, not ordinary feature cards.

Suggested command: `/impeccable colorize`

**[P1] Dashboard home has too many competing action-card treatments**

Why it matters: `app/[locale]/dashboard/page.tsx` stacks a dark hero, priority cards, one large media card, and module cards, each with its own tonal system. The user sees many clickable things, but the visual hierarchy does not make the next production step obvious enough.

Fix: Choose one dominant dashboard entry pattern. Make the hero's primary CTA the clear start point, keep module cards mostly neutral, and use media cards only for the signature/featured workflow. Reduce tonal backgrounds on secondary cards.

Suggested command: `/impeccable layout`

**[P2] Bespoke button-like controls outnumber the shared Button vocabulary**

Why it matters: Shared buttons are consistent, but many dashboard controls are hand-built links/buttons with local gradients, rounded-full badges, custom shadows, or state colors. This increases maintenance cost and makes similar actions feel subtly different.

Fix: Promote common patterns into variants: segmented choice, feature link, tonal status chip, and media card CTA. Keep shape and state logic centralized. Avoid one-off `hover:-translate-y`, glow, and gradient choices unless the component is explicitly media-led.

Suggested command: `/impeccable extract`

**[P2] CTA shapes are slightly inconsistent across contexts**

Why it matters: Most buttons use rounded-md/11px, but the billing buy button switches to `rounded-full` with a larger glow; theme toggle is pill/circle; badges are very pill-like. This is acceptable in isolated cases, but too many rounded systems weaken the premium precision.

Fix: Keep real buttons at `rounded-md`/`rounded-xl` depending on size. Reserve rounded-full for chips, avatar controls, and progress meters. Make the billing "Buy Credits" CTA a strong large button without pill/glow styling.

Suggested command: `/impeccable polish`

**[P3] Auth OAuth icons read as placeholder letters**

Why it matters: The live auth view shows `GGoogle` and `XX` as text/icon combinations. It works functionally, but it feels unfinished beside the premium media/auth layout.

Fix: Use recognizable provider icons or a cleaner monogram treatment with spacing that reads as icon + label, not duplicated text.

Suggested command: `/impeccable polish`

# Persona Red Flags

Alex, power user: Dashboard source has many visible workflow cards and action surfaces, but no obvious command palette or shortcut path for quickly starting a generation job. Sidebar shortcut exists, but production actions still look card-driven.

Jordan, first-timer: The landing/auth copy currently reads more like a generic AI SaaS/control-console in places than a short-drama creator studio. The visible first action is clear, but the promise does not fully match the product purpose in `PRODUCT.md`.

Sam, accessibility-dependent user: Shared focus rings are good. Risk remains in custom card-buttons and tonal choices where selection may be indicated mainly by color/tint/shadow. Make selected states include explicit icons, text, or aria state where applicable.

# Minor Observations

- `ThemeToggle` uses a rounded-full outline button while the core button spec prefers gently curved compact controls; this is okay as an icon utility, but keep it the exception.
- `BillingPage` includes glow shadows and gradient credit meters. Some are state-related, but the page is close to the "cheap AI glow" boundary named in `DESIGN.md`.
- `Badge` default uses primary, which can make small metadata compete with true CTAs. Prefer outline/secondary badges for metadata.

# Questions to Consider

- Should the dashboard home push one primary creator workflow, or should it act as a module launcher?
- Which color should mean "ready to publish" across the whole product: teal, foreground, or a semantic success token?
- Are the current dashboard cards meant to feel cinematic, or should only media-preview surfaces get that treatment?
