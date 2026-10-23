---
name: Risk Scoring
description: A light SOC case workspace for connecting alerts and assessing risk.
colors:
  primary: "#176c59"
  primary-hover: "#11533f"
  accent-soft: "#edf5ef"
  bg: "#f5f6f3"
  surface: "#fff"
  ink: "#233432"
  muted: "#65716e"
  line: "#e4e8e2"
  rail: "#142c2b"
  rail-active: "#284440"
  rail-text: "#d5e3dd"
  phishing-bg: "#f8f0db"
  phishing-text: "#7d5b18"
  malware-bg: "#faeae7"
  malware-text: "#9e4839"
  network-bg: "#eaf0f9"
  network-text: "#45658b"
  credential-bg: "#f0ebf7"
  credential-text: "#775192"
typography:
  headline:
    fontFamily: "Inter, 'Segoe UI', Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 650
    letterSpacing: "-1px"
  title:
    fontFamily: "Inter, 'Segoe UI', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    letterSpacing: "-.2px"
  body:
    fontFamily: "Inter, 'Segoe UI', Arial, sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "Inter, 'Segoe UI', Arial, sans-serif"
    fontSize: "10px"
  host:
    fontFamily: "Consolas, monospace"
    fontSize: "10px"
  score:
    fontFamily: "Inter, 'Segoe UI', Arial, sans-serif"
    fontSize: "64px"
    fontWeight: 550
    lineHeight: 1.1
    letterSpacing: "-3px"
rounded:
  badge: "4px"
  action: "5px"
  control: "6px"
  navigation: "7px"
  panel: "12px"
spacing:
  small: "8px"
  control: "12px"
  compact: "16px"
  panel: "24px"
  page: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  navigation-active:
    backgroundColor: "{colors.rail-active}"
    textColor: "#f2f7f3"
    rounded: "{rounded.navigation}"
    padding: "13px 12px"
---

# Design System: Risk Scoring

## Overview

**Creative North Star: "The Analyst Workspace"**

A calm, light SOC workspace framed by a dark teal navigation rail. The visual hierarchy supports operating a shared case: scan alerts, select related signals, apply policy context, then read the risk assessment.

Restrained green actions, compact rows, and quiet borders keep dense information readable. This document captures the implemented stylesheet in `public/styles.css`; it does not prescribe a replacement visual identity.

**Key Characteristics:**
- Light work surfaces with a dark teal rail.
- Compact, scanable alerts with category badges.
- Prominent risk score and aligned numeric breakdowns.

## Colors

### Primary
Deep evergreen identifies the primary policy action, focus outlines, saved state, and score fill. Its pale tint supports secondary action hover states.

### Neutral
Warm near-white forms the page canvas; white panels, pale gray-green borders, dark green-gray ink, and muted text establish hierarchy. The deep teal rail has a lighter teal active destination and pale text.

### Semantic categories
Amber phishing, soft red malware, blue network scan, and violet credential-access badges pair tinted backgrounds with darker text. Severity uses a separate low-to-critical color sequence already defined in CSS.

**The Semantic Color Rule.** Preserve readable text labels alongside category and severity colors.

## Typography

Display and body use the Inter, Segoe UI, Arial, sans-serif stack. Inter is named in CSS but is not loaded by the HTML; rendering may use the fallback. Hosts use Consolas or monospace. The page headline and section titles use the frontmatter hierarchy; compact table and control text generally falls between 10px and 13px.

The risk number is the largest element. Numeric scores, counts, case identifier, and scale labels use tabular figures. Paragraph line height is 1.6; rail notes use 1.8.

## Layout

The desktop rail is fixed at 224px; the content shell offsets by the same amount. The top bar is 70px high. Main content has a maximum width of 1510px with 34px top and 36px horizontal padding. The workspace uses a flexible alert column and a 334px scoring column, separated by 24px; stacked panels use 22px gaps.

At 1600px, the scoring column becomes 360px. At 1180px, the rail becomes 185px and the scoring column 300px. At 1000px, the rail becomes a 66px icon strip and the scoring column 290px. At 760px, navigation becomes a 64px horizontal header, the workspace becomes one column, and scoring panels share a two-column row. At 540px, scoring panels and toolbar controls stack. Tables retain horizontal overflow when necessary.

## Elevation & Depth

The implemented system uses no shadows. White panels, tinted score surfaces, thin borders, and the dark rail create separation. Keep these distinctions flat and legible.

## Shapes

Panels use the panel radius token with a one-pixel border and clipped contents. Controls, action buttons, badges, and navigation use the smaller radii defined above. Dots are circular; icons are outlined SVGs with rounded caps and joins.

## Components

### Buttons
The full-width policy action uses evergreen, white text, and a darker hover. Add buttons are white with a fine border and green text; disabled add buttons switch to a pale surface and muted text. Remove buttons are transparent with a soft red hover. Buttons transition background and color over .16s.

### Chips
Category badges are compact, text-bearing tinted rectangles. Severity badges pair a named level with its semantic tint. Counts use a neutral gray-green pill-like rectangle.

### Cards / Containers
Panels use white backgrounds, quiet borders, and no shadow. Panel headings use 23px top and 24px horizontal padding. The risk panel has a subtly tinted background and a prominent score above a track and breakdown.

### Inputs / Fields
Search and select controls have white fills, fine gray-green strokes, and gently rounded corners. Search focus-within uses a green two-pixel outline. Keyboard focus uses a two-pixel accent outline with four-pixel offset. Policy options use native checkbox and radio controls with the accent color.

### Navigation
The rail uses a pale wordmark, small uppercase workspace label, and a lighter teal active destination. Its responsive behavior follows Layout. Navigation includes an active-state dot when room permits.

### Risk assessment
The score is tabular and oversized; the six-pixel track animates its width over .35s ease-out. Breakdown labels and numbers align to opposite edges. Reduced-motion preferences disable transitions.

## Do's and Don'ts

### Do:
- Do preserve text labels alongside semantic colors.
- Do align scores with tabular figures and clear row boundaries.
- Do retain keyboard focus outlines and reduced-motion behavior.
- Do use the existing flat surfaces, restrained accent, and responsive rail behavior.

### Don't:
- Don't treat the named Inter font as a guaranteed downloaded font.
- Don't replace score or category labels with color alone.
- Don't add shadows to represent the current flat panel system.
