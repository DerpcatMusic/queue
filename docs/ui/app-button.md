# AppButton

Minimal button wrapper for the app.

## Why

- reduce repeated `Pressable` boilerplate
- use **Expo UI** native buttons where they are good enough
- keep a custom fallback for branded/custom cases

## Native behavior

### iOS
Uses `@expo/ui/swift-ui` only for simple text buttons.

Falls back when the button needs:

- icons
- loading states
- full-width layout
- square shape
- custom background/radius overrides

### Android
Uses `@expo/ui/jetpack-compose` for text buttons, including many full-width/custom color cases.

Falls back when the button needs:

- icons
- loading states
- square shape

### Web
Always uses the custom fallback.

## Props

Same core API as `ActionButton`, plus:

- `native?: boolean`
- `radius?: number`
- `colors?: { backgroundColor, pressedBackgroundColor, disabledBackgroundColor, labelColor, disabledLabelColor, nativeTintColor }`

## Notes

- `ActionButton` is now a thin compatibility wrapper over `AppButton`.
- iOS Expo UI styling is more limited than Android. Custom tint works; full custom filled styling still falls back.
