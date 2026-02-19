# Brixlore Mobile (Expo)

React Native mobile app for Brixlore — Expo + TypeScript + Expo Router. Dark theme only; colors match the web project.

## Run

```bash
cd mobile
npx expo start
```

Then scan the QR code with Expo Go (Android) or the Camera app (iOS), or press `a` for Android emulator / `i` for iOS simulator.

## Stack

- **Expo** (SDK 54) + **Expo Router** (file-based routing)
- **TypeScript**
- **Zustand** (state)
- **Axios** (API)
- **React Native Safe Area Context** + **React Native Screens**

## Folder structure

- `app/` — Expo Router routes and layouts (tabs: Home, Explore, Scenes, Live TV, My Stuff)
- `components/` — Reusable UI (Card, VideoThumbnail, SectionCard)
- `screens/` — Screen components (e.g. HomeScreen)
- `services/` — API client (Axios)
- `store/` — Zustand stores (e.g. useAuthStore)
- `constants/` — Theme (colors from web), spacing, typography
- `context/` — DarkThemeProvider
- `hooks/` — Custom hooks (e.g. useContinueWatching)
- `assets/` — Images, fonts

## Theme

Colors are taken from the Brixlore web app (`frontend/src/app/globals.css`):

- Background: `#0b0b0e`
- Foreground: `#f5f7fb`
- Accent: `#e5e7eb`
- Accent foreground: `#0b0b0e`

Dark theme only; no light theme.
