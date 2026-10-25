# DailyBudget

DailyBudget is an Android-first, local-only budgeting app built with Expo, React Native, TypeScript, Expo Router, SQLite, and Drizzle ORM. It has no login, server, analytics, or advertising.

## Requirements

- Node.js 24 LTS
- npm
- Android Studio/SDK and `adb` for local device work
- An Expo account for EAS builds

The screenshot importer, notifications, and app lock use native code. Expo Go cannot run this project; use a development build.

## Install and run

```powershell
npm install
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
```

Download the resulting APK as `dailybudget-development.apk`, connect an Android device with USB debugging, then run:

```powershell
adb install -r ".\dailybudget-development.apk"
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --localhost
```

## Test

```powershell
npm test
npm run typecheck
```

To verify the Android JavaScript/Hermes bundle:

```powershell
npx expo export --platform android
```

## Build

Development client APK:

```powershell
npx eas-cli@latest build -p android --profile development
```

Installable preview APK:

```powershell
npx eas-cli@latest build -p android --profile preview
```

Google Play production AAB:

```powershell
npx eas-cli@latest build -p android --profile production
```

Before publishing, replace the placeholder Android package `com.yourname.dailybudget` with the final unique package identifier and review the app name, version, icons, store listing, and [privacy statement](./PRIVACY.md). Crash information comes from Google Play Console; do not add a third-party crash or analytics SDK.
