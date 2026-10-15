# CooperativeOS — Mobile (Flutter spike)

An exploratory native mobile client for the CooperativeOS member experience,
talking to the **same** Django REST API (`/api/v1`) as the web app. This is a
**spike**, not a finished app: it proves the shape of a Flutter build and gives a
concrete basis for the PWA-vs-native decision below.

## What's here

The **full member section** — the same five screens as the web member app,
behind a bottom navigation bar, all wired to live API data:

```
lib/
  main.dart              app entry; routes to Login or the member tabs
  theme.dart             design tokens (green/gold/paper) mirroring the web @theme
  api.dart               Api client (token + X-Cooperative-Id) and typed models;
                         me/, statement, statement-pdf, contribution-types,
                         contributions/initiate, resolutions (+vote), announcements
  format.dart            naira / date / initials helpers
  widgets.dart           shared building blocks (GreenPanel, AppCard, SectionTitle)
  screens/
    login_screen.dart    branded sign-in (defaults to the demo member login)
    member_scaffold.dart bottom-nav shell; loads /me/ once, hosts the five tabs
    home_tab.dart        savings hero, quick actions, vote nudge, recent activity
    savings_tab.dart     balance + statement + Download PDF (open_filex)
    contribute_tab.dart  pick type · amount · Card/Transfer/USSD · initiate payment
    vote_tab.dart        resolutions with For/Against/Abstain; results bar when closed
    profile_tab.dart     profile, announcements, settings, sign out
```

Token + active cooperative are persisted with `shared_preferences`, matching the
web app's `session.ts`. Auth routing uses the same enriched `/me/` payload.

All five tabs have been rendered on an iOS simulator against the live backend and
match the web member surface.

## Run it

```bash
# Backend on the host (repo root)
.venv/bin/python manage.py runserver

# Flutter (this directory) — needs a booted simulator/emulator
flutter pub get
flutter run                        # iOS simulator (API base defaults to localhost)
# Android emulator reaches the host at 10.0.2.2:
flutter run --dart-define=API_BASE=http://10.0.2.2:8000/api/v1
```

Demo member login is pre-filled (`adebayo@example.com` / `member123`).

> **CORS:** the API's `CORS_ALLOWED_ORIGINS` currently lists the Vite origin only.
> Native apps don't send an `Origin`, so device/simulator builds work as-is; only
> a *Flutter-web* build would need the origin added.

## Verify

```bash
flutter analyze     # static analysis — currently clean
flutter test        # widget smoke test (unauthenticated → sign-in screen)
```

## Distributing the APK from the website (side-loading)

Members download this from the marketing page while the app is not yet on Google
Play. It is a different artefact from the Play release — an `.apk`, not an
`.aab` — but it must be signed with **the same upload key**, for the reason in
the warning below.

### Sign it first. This is not optional for anything a member installs.

Android refuses to update an installed app unless the new version carries the
**same signature**. A debug-signed APK therefore cannot be upgraded in place to a
properly signed one: every member who installed it has to uninstall the app
before they can take any future update, and you have to tell them so.

So create the upload key (§ *Releasing to Google Play* → step 1) **before** you
put an APK on the website, and use it for both. Then the same signature carries
through from the side-loaded build to the eventual Play release, and nobody has
to uninstall anything.

Gradle prints a loud warning when `android/key.properties` is missing and falls
back to debug keys. Treat that warning as a stop sign for anything you intend to
distribute. To check an APK you already have:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
"$ANDROID_HOME"/build-tools/36.0.0/apksigner verify --print-certs <file>.apk
```

`CN=Android Debug` means debug-signed. Your own build shows the name you typed
into `keytool`.

### Build and name it

```bash
flutter build apk --release
mkdir -p dist && cp build/app/outputs/flutter-apk/app-release.apk \
  dist/CooperativeOS.apk
```

The file name is what members see in their downloads, so it is renamed from
Flutter's `app-release.apk`. `mobile/dist/` is git-ignored: a 22 MB binary does
not belong in the repository, and the APK is reproducible from any commit.

`--dart-define=API_BASE=...` is unnecessary for production — that is already the
default — but is how you point a build at staging.

### Publish it

Django admin → **Site content** → *Mobile apps* → upload the file into
**Android apk**, and leave **Android store url** empty until the app is on Play
(a store link takes precedence, so filling it in later switches members over
without touching the file).

If the upload times out, the host's request size limit is the cause: put the file
on the server over SFTP and set **Android store url** to its URL instead.

### Download counts

The marketing page links to `/api/v1/public/app/android/`, which records the
download and then redirects to the file (or to the store listing when one is
set). Counts are visible in Django admin → **App download tallies**, which shows
a running total and a figure per day.

It counts *clicks on the link*, not installs — bots, link previews and browser
prefetching are included — so read it as a direction of travel. The table stores
only a platform, a date and a count: no IP address, no user agent, nothing that
identifies anyone, so there is no retention question to answer.

## Releasing to Google Play

### What is already configured

| Item | State |
|---|---|
| `applicationId` | `com.mycooperativeos.app` — **permanent once published** (matches the Play Console listing) |
| `targetSdk` / `compileSdk` | **36**, pinned explicitly (not inherited from `flutter.*`) |
| `minSdk` | 24 (Android 7.0), pinned — the minimum Play automatic protection accepts |
| `ndkVersion` | `27.0.12077973` — matches what all six Android plugins require |
| Release signing | Reads `android/key.properties`; falls back to debug signing with a warning when absent |
| `INTERNET` permission | Declared in the **main** manifest, so the release build has network access |
| Launcher icons | Generated from `assets/icon/` via `flutter_launcher_icons`, incl. adaptive layers |
| API base URL | Defaults to `https://mycooperativeos.com/api/v1` — no `--dart-define` needed for a release build |

### 1. Create the upload key — you must do this yourself

The keystore is protected by passwords you type, so run this yourself; it is
never generated or stored for you. From `mobile/android/`:

```bash
keytool -genkey -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Then create `mobile/android/key.properties`:

```properties
storePassword=<the store password you just chose>
keyPassword=<the key password you just chose>
keyAlias=upload
storeFile=../upload-keystore.jks
```

`android/.gitignore` already excludes `key.properties`, `*.jks` and
`*.keystore`, so none of it enters the repository. **Back the keystore up
somewhere you will still have in five years** — whoever holds it can ship an
update to your listing, and without it you must ask Google to reset the upload
key before you can publish again.

### 2. Build the bundle

```bash
flutter clean && flutter pub get
flutter build appbundle          # release is the default
# → build/app/outputs/bundle/release/app-release.aab  (~43 MB)
```

Confirm Gradle did **not** print the `key.properties not found` warning. If it
did, the bundle is debug-signed and the Console will reject it.

Raise `version:` in `pubspec.yaml` before every upload — the part after `+` is
the `versionCode`, and Play refuses a value it has already seen. `1.0.0+1` →
`1.0.1+2`, and so on.

### 3. Play Console

Upload the `.aab` under **Release → Production** (or start with internal
testing, which is worth doing for an app that moves money).

**Privacy policy URL** — required, because the app collects personal and
financial data:

```
https://mycooperativeos.com/privacy
```

**Data deletion** — Play requires a route for any app with sign-in. The same
page documents it; point the Console at the section:

```
https://mycooperativeos.com/privacy#deleting-your-account-and-your-data
```

**Data Safety declaration.** What this app actually does, so the form matches
the code:

| Question | Answer |
|---|---|
| Collected / shared | **Collected**, and shared only with processors (payments, email) |
| Name, email, phone, address, DOB | Yes — account management |
| National identification number | Yes — membership verification by the society |
| Financial info (payment history, bank account) | Yes — the core purpose |
| Photos | Yes — profile photograph and uploaded documents, user-initiated only |
| Location, contacts, calendar, messages, call logs | **No** — none requested or collected |
| Advertising / third-party ads | **No** |
| Encrypted in transit | Yes (HTTPS) |
| Users can request deletion | Yes — see the URL above |
| App collects data from children | No; not directed at under-18s |

**Release name and notes.** The release name is for you only — members never
see it — so make it the version, which is what you'll search for when a
problem report comes in. Play caps it at 50 characters. The notes are what
members read under "What's new"; Play caps them at 500 characters per
language, and they go in the box with the language tags as below.

Current release (`1.1.14+16`):

Release name:

```
1.1.14 (16) — Verified badge
```

Release notes:

```
<en-US>
Welcome to CooperativeOS — your cooperative, in your pocket.

New: complete your profile and upload a means of ID to get the verified tick.

• See your savings, share capital and every contribution
• Pay dues by card, bank transfer or USSD
• Apply for a loan, follow repayments and repay in the app
• Set savings goals and watch your progress
• Vote on resolutions and see your dividends
• Download your statement any time

Your money stays in your cooperative's own account.
</en-US>
```

For later releases: name them `<versionName> (<versionCode>)`, and write
the notes as what a member can now do or what got fixed, in their words, not
the commit log. Replace this block each release rather than appending, so it
always shows the one being uploaded.

### Permissions — the full declared set

The release manifest declares exactly one permission: **`INTERNET`**. Verify it
yourself before any upload, rather than trusting this table:

```bash
grep -oE 'android:name="android.permission[^"]*"' \
  build/app/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml \
  | sort -u
```

No `CAMERA` permission is declared — `image_picker` (0.8.13+1) declares none at
all, using the Android Photo Picker and the capture *intent* instead. Camera and
photo-library access are therefore requested by the OS at the moment the member
chooses to add a photograph or document, and only the chosen image is sent.

**Four permissions are explicitly removed** in
`android/app/src/main/AndroidManifest.xml` via `tools:node="remove"`:

| Removed | Merged in by | Why it is not needed |
|---|---|---|
| `READ_EXTERNAL_STORAGE` (maxSdk 32) | `open_filex` 4.7.0 | — |
| `READ_MEDIA_IMAGES` | `open_filex` 4.7.0 | The only `OpenFilex.open` call is in `savings_tab.dart`, |
| `READ_MEDIA_VIDEO` | `open_filex` 4.7.0 | opening the statement PDF the app just wrote itself via |
| `READ_MEDIA_AUDIO` | `open_filex` 4.7.0 | `path_provider`, in its own app-specific directory. |

Reading a file your own app wrote in its own storage needs no media permission
on any API level. Keeping them would have exposed the submission to Play's
**Photo and Video Permissions** policy, which expects broad media access to be a
*core* purpose of the app — and `READ_MEDIA_AUDIO` cannot be justified here at
all, since CooperativeOS has no audio feature.

> **Test on a device after any change to this.** Removing permissions is a
> runtime behaviour change and cannot be verified by a build. Check both paths:
> **Savings → Download PDF statement**, and **Profile → set photo** from
> *camera* and from *gallery*. If `open_filex` is ever used for a file outside
> the app's own directory, these removals must be revisited.

### Still outstanding

- **Confirm the required target API in the Console before uploading.** Play's
  minimum rises every August. 36 is set here deliberately, but verify rather
  than assume — a rejected upload costs a day.
- **Test on a real Android 16 device.** Moving to `targetSdk 36` opts into
  Android 16 behaviour changes (edge-to-edge enforcement, predictive back). It
  builds clean; that is not the same as looking right.
- **Store listing assets** are yours to supply: app name, short and full
  description, at least two screenshots per form factor, a 512×512 icon and a
  1024×500 feature graphic.
- **Token storage.** The auth token sits in `shared_preferences`, i.e. plain
  text in app-private storage — readable on a rooted device. For an app holding
  financial records, `flutter_secure_storage` is the right home for it.
- **Paystack return URL.** `kPaymentReturnUrl` is
  `https://cooperativeos.app/paystack/return`, a sentinel the WebView intercepts
  so it never loads. It is still handed to Paystack as the real `callbackUrl`,
  so if interception ever misses, the member lands on a domain that may not
  resolve, mid-payment. Consider pointing it at a path on
  `mycooperativeos.com`.
- **Flutter 3.32.0's engine is ~17 months old.** Fine for this release; worth a
  planned upgrade rather than an urgent one.

## PWA vs. native Flutter — the decision this spike informs

The web member app is already an **installable PWA** with offline read + a
sync-on-reconnect write queue (see `../frontend`). That covers most of the PRD's
mobile-first, low-connectivity goals today, at zero extra codebase cost.

| Factor | PWA (shipping) | Flutter (this spike) |
|---|---|---|
| Cost | One codebase, already built | A second codebase + toolchain to staff |
| Reach | Any browser; "Add to home screen" | App Store / Play Store presence |
| Offline | Service worker + outbox (done) | First-class, but must be rebuilt here |
| Push notifications | Limited/none on iOS | Full FCM/APNs |
| Device APIs (USSD dial, contacts, biometrics) | Constrained | Full native access |
| Distribution friction | Instant (a URL) | Store review + update cycles |

**Recommendation:** stay PWA-first for the pilot. Revisit Flutter when a concrete
native-only need appears — reliable push, deep USSD/telephony integration, or a
store presence a partner requires. This spike de-risks that path: the full member
section, API layer, theme, and auth already port cleanly, so a native build is a
known quantity when it's justified. Next steps if pursued: `flutter_secure_storage`
for the token, an offline queue mirroring the web outbox, richer error/empty
states, and CI (`flutter analyze` + `flutter test`).

### Screenshotting the tabs

Two dev-only `--dart-define`s (empty in normal builds) let a simulator boot
straight into an authenticated tab for screenshots:

```bash
TOK=$(curl -s -X POST localhost:8000/api/v1/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"adebayo@example.com","password":"member123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
flutter run -d <booted-sim> \
  --dart-define=DEMO_TOKEN=$TOK --dart-define=DEMO_COOP=1 --dart-define=INITIAL_TAB=2
# then: xcrun simctl io <booted-sim> screenshot contribute.png
```
