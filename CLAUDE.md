# Design Context

## Project Overview
- **Queue** - An Expo app for managing job applications and instructor zones (QuickFit migration target)
- **Tech Stack**: Expo, React Native, Convex (backend), expo-router
- **Users**: Driving instructors and driving schools (studios)
- **Platforms**: iOS, Android, Web

## Brand Identity

### Colors
- **Primary**: Vibrant purple `#8B5CF6` (light) / `#A78BFA` (dark)
- **Brand Personality**: Purple conveys creativity, expertise, and trust
- **Semantic colors**: success (green), warning (amber), danger (red)

### Typography
- **Primary font**: Rubik (various weights: 400, 500, 600, 700)
- **Display font**: Barlow Condensed ExtraBold (headlines, hero text)
- **Scale**: display (42px), hero (38px), heading (28px), title (20px), body (16px), caption (13px), micro (11px)

### Spacing System
```
xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32
```

### Radius
```
card: 24, button: 20, input: 20, pill: 999 (full)
```

## Aesthetic Direction

### Visual References
- **Uber/Wolt-inspired**: Fast scan hierarchy, strong contrast, large touch targets, motion with purpose
- **Key traits**:
  - One primary action per viewport
  - Low-noise backgrounds
  - Bright brand accent used sparingly
  - High-quality spacing for calm scrolling
  - Rounded surfaces (cards, buttons)

### Design Principles
1. **Utility-first**: Every element must serve a clear purpose
2. **Single primary action**: One dominant action per screen
3. **Consistent spacing**: Follow the spacing scale strictly
4. **Semantic over hardcoded**: Use design tokens, never hardcoded colors
5. **Native feel**: Preserve native behaviors (haptics, ripple, safe areas)
6. **Accessible contrast**: Ensure WCAG compliance for text readability

### Light/Dark Mode
- Both modes supported
- Light: Purple on white/light backgrounds
- Dark: Lighter purple on dark backgrounds

## UI Architecture

### Custom UI Kit (`@/components/ui/kit`)
- Centralized reusable components (KitChip, KitSurface, KitTextField, KitList, KitSwitchRow, etc.)
- All styling derives from global semantic palette (`useBrand`)
- Adapter hook (`useKitTheme`) produces semantic tokens

### Custom TopSheet Component
- Expandable sheets with directional snapping
- Sticky headers/footers
- Overlay mode for maps
- Configurable snap points

## Design Anti-Patterns to Avoid
- Hardcoded colors in components
- Decorative complexity without purpose
- Too many primary actions per screen
- Inconsistent spacing
- Generic/mixed typography styles
