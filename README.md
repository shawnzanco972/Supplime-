# Supplime

A private Android app for your supplement routine: reminders at the right meal, a record of
what you took, and an honest read on **when a supplement should start working** and **when it
is reasonable to raise the dose**.

It started as a Grok web prototype. This version runs fully offline on the phone (no account,
no server) and is packaged as an APK with [Capacitor](https://capacitorjs.com).

## Install on your phone

1. Open the [latest release](../../releases/latest) on your Android phone.
2. Tap `Supplime-1.0.x.apk`. When Android asks, allow your browser to *install unknown apps*.
3. Open Supplime, pick your goals and supplements, and turn reminders on.

Every push to GitHub builds a new APK (see *Actions*). New builds install over old ones and
keep your data.

## What it does

- **Today**: your supplements grouped by meal window and by food timing (empty stomach,
  with food, after food). Take, skip, or *Take all* for a window.
- **Real reminders**: Android notifications fire even when the app is closed, with
  **Took them** and **Snooze 15 min** buttons. You can get them on time or a few minutes
  early, plus an optional nudge if you haven't logged a window. They survive reboots.
  Windows you have already logged stay quiet.
- **Onset tracking**: for each supplement you see days on it, days actually taken, and the
  typical onset window from the built-in guide of 25 supplements. Near that window, Today asks
  *"Is it working?"* (Nothing yet / Maybe / Noticeable / Clear effect). Supplime records the
  day you first felt it and shows it against the typical window on **Record**.
- **Dose steps**: changing a dose starts a new step with its own *days at this dose* clock.
  Each item shows when its dose review is due, along with the guide's step-up advice and
  typical ceiling. Once you have logged a clear effect, it tells you to hold the dose instead.
- **Started on**: backdate supplements you were already taking so the clocks are right.
- **Stock**: counts servings down as you log them, warns in-app, and sends one notification
  when a bottle is about 10 days from empty (configurable).
- **Body**: sleep, resting HR, HRV, energy, mood and focus, typed in or imported from a Fitbit
  CSV.
- **Backup**: Settings → Export opens the share sheet (Drive, email…). Restore from the same
  file.
- **Coach (optional)**: paste your own xAI (Grok) API key in Settings. The coach gets your
  dose history and effect check-ins, so its dose advice is based on your own data.

Supplime is a personal tracker, not medical advice.

## Develop

```bash
npm install
npm run dev         # web preview at http://localhost:8080
npm test            # logic tests (dose steps, adherence, reminder schedule, backups)
npm run typecheck
```

Build the APK locally (needs Android Studio / the Android SDK and JDK 21):

```bash
npm run apk         # -> android/app/build/outputs/apk/release/app-release.apk
```

App icons and the splash screen come from `scripts/make-icons.py`.

### Signing

Android only installs an update over an existing app if both are signed with the same key.
The repo includes a personal signing key (`android/app/supplime-release.keystore`) so every
CI build installs over the last one. **This repo is public**, so anyone could sign an APK with
that key. That is harmless as long as you only install Supplime from your own releases. To use
a private key, add these repository secrets and CI will use them instead:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. Switching keys means uninstalling once, so export a backup first.
