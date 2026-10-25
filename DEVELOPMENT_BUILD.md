# Android development build

Screenshot OCR includes native code, so Expo Go cannot run DailyBudget from this phase onward. Use the `development` profile in `eas.json`.

## Build the APK

Use Node.js 24 LTS, then run these commands from the repository root:

```powershell
npm install
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile development
```

The last command prints an EAS build URL. Download its Android APK to this repository and name it `dailybudget-development.apk`.

## Install on a physical Android phone

Enable Developer options and USB debugging, connect the phone by USB, and run:

```powershell
adb devices
adb install -r ".\dailybudget-development.apk"
adb reverse tcp:8081 tcp:8081
npx expo start --dev-client --localhost
```

Open DailyBudget on the phone. The `adb reverse` command lets the development client reach Metro over USB, which is also useful when testing the import flow with the phone in airplane mode. Re-run `adb reverse tcp:8081 tcp:8081` after reconnecting the phone.

## Install on an Android emulator

With an emulator running, install the latest EAS development build and start Metro:

```powershell
npx eas-cli@latest build:run --platform android --latest
npx expo start --dev-client
```

A new development build is required whenever native dependencies or native app configuration change. JavaScript-only changes need only a Metro restart.
