# Supplime

A private Android app for your supplement routine: reminders at the right meal, a record of
what you took, and an honest read on **when a supplement should start working** and **when it
is reasonable to raise the dose**.

It started as a Grok web prototype. This version runs fully offline on the phone (no account,
no server) and is packaged as an APK with [Capacitor](https://capacitorjs.com).

## Install on your phone

1. Open the [latest release](../../releases/latest) on your Android phone.
2. Tap the `.apk`. When Android asks, allow your browser to *install unknown apps*.
3. Open Supplime, pick your goals and supplements, and turn reminders on.

Every push to GitHub builds a new APK (see *Actions*). New builds install over old ones and
keep your data.

## What it does

**How long until it works.** Every supplement in the guide (30 of them) comes with a timeline:
the day you might first notice it, the day most people do, the minimum days at one dose before
changing it, and a verdict day to decide keep / adjust / stop. Journey shows each one as an
experiment on that timeline, marks the day *you* first felt it, and locks dose changes until
the minimum time has passed. For your own products you set those numbers yourself.

**Verdicts, not guesswork.** On verdict day Supplime looks at your consistency, your check-ins
and the dose ladder and suggests: keep, step up, lower, give it more time, or stop. It won't
suggest changing a dose before you've checked in, calls out an unfair test when you missed
too many days, and never pushes melatonin up. Stopped supplements stay as past experiments
with the verdict and your notes.

**Built around your day, not 8 am breakfast.** Tell it when you wake, when you first and last
eat, and when you go to bed. Windows follow that ("First meal" can be 1 pm), late nights count
as the same day, and with *flexible wake* the morning reminders wait for **I'm up**, which also
moves the morning plan.

**Habit flags.** Each dose shows what matters: take with food, empty stomach, pairs with your
coffee, keep away from coffee, no alcohol 4 h before melatonin, stimulating late in the day,
supplements that compete for absorption. Log a coffee or a drink on Today and the flags react.

**Missed doses handled properly.** "Not now" asks why — later, not with me, forgot, skip — and
answers per supplement: slow builders like Lion's Mane get a catch-up reminder with your next
meal once you're home; same-day ones like L-theanine don't need catching up; melatonin is
skipped if it's too late. Notifications have **Took them / In 1 hour / Not with me** buttons.

**Motivation (Octalysis).** XP and levels for real actions, a streak protected by earned
shields, a weekly target, three small quests a day, a field note that unlocks each complete
day, your "why" on Today, and notes to your future self on each verdict. Honest logging of a
miss earns XP too.

**Adding from iHerb.** In the iHerb app tap *Share → Supplime*, or paste a product link or
title. Supplime reads the brand, dose and capsule count and matches it to the guide.

Also: stock counting with a low-bottle alert, body log (sleep, HRV, mood…) with Fitbit CSV
import, JSON backup/restore, and an optional coach using your own xAI key.

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
