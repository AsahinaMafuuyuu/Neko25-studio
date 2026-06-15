---
name: Kravix AI Studio
description: Premium creator studio for turning scripts and raw assets into publishable short-drama video.
colors:
  background: "oklch(0.986 0.012 93)"
  foreground: "oklch(0.17 0.028 258)"
  card: "oklch(1 0 0 / 92%)"
  primary: "oklch(0.56 0.19 267)"
  primary-foreground: "oklch(0.99 0.006 95)"
  secondary: "oklch(0.94 0.024 252)"
  secondary-foreground: "oklch(0.26 0.055 260)"
  muted: "oklch(0.94 0.018 252)"
  muted-foreground: "oklch(0.49 0.04 258)"
  accent: "oklch(0.83 0.14 174)"
  accent-foreground: "oklch(0.16 0.035 184)"
  destructive: "oklch(0.61 0.22 28)"
  border: "oklch(0.86 0.02 252)"
  sidebar: "oklch(0.98 0.01 95)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.12em"
rounded:
  sm: "0.525rem"
  md: "0.7rem"
  lg: "0.875rem"
  xl: "1.225rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.625rem"
    height: "2.25rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.625rem"
    height: "2.25rem"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.625rem"
    height: "2.25rem"
---

# Design System: Kravix AI Studio

## 1. Overview

**Creative North Star: "The Cinematic Control Room"**

Kravix should feel like a premium production workspace for short-drama creators: fast, composed, and visually sharp. The system uses crisp contrast, restrained surfaces, compact controls, and cinematic media panels to keep creative work moving without the fatigue of an overloaded editing suite.

The interface is product-first. Familiar controls are a virtue here, but the atmosphere must still feel artistic and modern: white and near-black contrast, disciplined purple emphasis, teal as a rare signal color, and media-led cards that give the studio a creator-native quality.

**Key Characteristics:**
- Product UI that serves speed and publishing confidence.
- Premium through restraint, not decoration.
- Fluid state changes and route transitions that explain progress.
- Cinematic media surfaces balanced by calm operational panels.
- Strong contrast, WCAG AA readability, and reduced-motion alternatives.

## 2. Colors

The palette is a restrained product system: luminous warm-neutral canvas, ink-like foreground, disciplined violet primary, and a teal accent reserved for energy and confirmation.

### Primary
- **Studio Violet**: The primary action, active selection, focus, and progress color. Use it sparingly so it retains authority.

### Secondary
- **Cool Panel Mist**: Secondary controls, inactive selected-adjacent states, sidebar accents, and low-emphasis panels.

### Tertiary
- **Creator Teal**: Accent moments, positive energy, and selected media affordances. It must not compete with primary actions.

### Neutral
- **Warm Gallery White**: The main light background; keep it clean and readable.
- **Ink Blue-Black**: The primary text color and contrast anchor.
- **Translucent Studio Card**: Cards and popovers use soft white layering with borders and low shadows.
- **Soft Divider Blue**: Borders and input strokes; visible but quiet.

### Named Rules

**The Violet Authority Rule.** Primary violet is for decisions, current location, focus, and generation progress. It is not decoration.

**The No Cheap AI Glow Rule.** Glows are forbidden as surface decoration. Use shadow and glow only when tied to state, media depth, or an active balance badge.

## 3. Typography

**Display Font:** Inter with system UI fallbacks.
**Body Font:** Inter with system UI fallbacks.
**Label/Mono Font:** SFMono-Regular, Consolas, Liberation Mono for code-like values only.

**Character:** The product uses a single modern sans-serif family with compact hierarchy. It should feel exact, contemporary, and calm under dense creative workflows.

### Hierarchy
- **Display** (600, 3rem to 4.5rem on brand surfaces, tight line-height): Public landing hero and rare media-led studio headers.
- **Headline** (600, 2.25rem, tight line-height): Dashboard module heroes and major page titles.
- **Title** (500-600, 1rem to 1.5rem): Cards, panels, and grouped creator settings.
- **Body** (400, 0.875rem to 1rem): Operational copy, descriptions, and helper text; cap long prose near 65-75ch.
- **Label** (500, 0.75rem, uppercase only when it aids scanning): Sidebar metadata, compact statuses, and field labels.

### Named Rules

**The No Display Labels Rule.** Labels, buttons, form controls, and data must stay in the product scale. Display-sized type belongs only to true heroes and media-led headers.

## 4. Elevation

Depth is a hybrid of tonal layering, borders, and small shadows. Most surfaces are flat at rest with `border-border/70`, `ring-foreground/10`, or `shadow-xs`; media cards may lift with larger ambient shadows on hover to signal clickability.

### Shadow Vocabulary
- **Control Shadow** (`shadow-xs`): Buttons, inputs, cards, and small elevated controls.
- **Panel Shadow** (`shadow-sm`): Sidebar panels, cards, and top-level grouped surfaces.
- **Media Lift** (`0 18px 48px rgba(16,18,34,0.16)`): Dashboard feature cards at rest.
- **Media Hover Lift** (`0 24px 64px rgba(16,18,34,0.22)`): Hover-only elevation for media-led feature cards.

### Named Rules

**The Flat Until Useful Rule.** Surfaces are quiet by default. Elevation increases only for hover, focus, popover, modal, or media hierarchy.

## 5. Components

### Buttons
- **Shape:** Gently curved compact controls (`rounded-md`, about 11px).
- **Primary:** Studio Violet background with light foreground; default height is 36px, large is 40px.
- **Hover / Focus:** Hover darkens primary to 80%; focus uses a visible ring from `--ring` at 50% opacity.
- **Secondary / Ghost / Outline:** Secondary uses Cool Panel Mist; outline keeps the background visible with a border; ghost is hover-only and should stay quiet.

### Chips
- **Style:** Rounded-pill badges with 20px height, 12px type, and compact horizontal padding.
- **State:** Use primary badges for active or credit-rich states; outline badges for metadata; destructive badges for error states only.

### Cards / Containers
- **Corner Style:** Soft but not bubbly (`rounded-xl`, about 19.6px).
- **Background:** Translucent Studio Card on light surfaces; dark mode uses a low-chroma blue-black card.
- **Shadow Strategy:** Use Control Shadow or Panel Shadow for static cards; use Media Lift only for creator media cards.
- **Border:** Prefer soft full borders or rings. Do not use side-stripe accents.
- **Internal Padding:** Default cards use 24px; compact cards use 16px.

### Inputs / Fields
- **Style:** 36px height, transparent background, soft border, compact padding, and normal body type.
- **Focus:** Border shifts to ring color and adds a 3px translucent focus ring.
- **Error / Disabled:** Error uses destructive border plus ring; disabled lowers opacity and removes interaction.

### Navigation
- **Style:** A left sidebar anchors the studio. Items are 32-48px tall, icon-led, rounded-md, and use background fill for hover and active states.
- **Mobile Treatment:** Sidebar becomes a sheet with the same visual vocabulary and no new navigation language.
- **Top Bar:** Sticky, translucent, lightly blurred, and functional; it should not become a marketing header inside the product.

### Media Feature Cards

Media cards are the signature creator component: rounded-2xl, full-bleed image or video, dark gradient overlay, white text, compact glass-like icon badge, and hover lift. They create cinematic context without turning the whole product into a decorative landing page.

## 6. Do's and Don'ts

### Do:
- **Do** keep Kravix product-first: every visual decision should help creators move from script or raw material to publishable subtitled video faster.
- **Do** use sharp black-and-white contrast and readable body text; WCAG AA is the baseline.
- **Do** reserve Studio Violet for primary action, current location, focus, and progress.
- **Do** make transitions silky but stateful: route changes, generation progress, preview readiness, and media selection.
- **Do** use cinematic media surfaces for creator context, especially in dashboard modules and creation previews.

### Don't:
- **Don't** make the product feel like CapCut's dense, cluttered mobile editing UI.
- **Don't** make it feel like Canva's overly playful, mass-market flat design style.
- **Don't** use gamer, neon, or cyberpunk styling.
- **Don't** drift into generic cookie-cutter SaaS dashboards, including early Notion-like or Jira-style surfaces.
- **Don't** create the cheap AI product feel of excessive gradients, glowing effects, and decorative spectacle layered together.
- **Don't** use side-stripe borders, gradient text, nested cards, or repeated identical icon-card grids as default scaffolding.
