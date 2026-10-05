import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Upload-key material, read from android/key.properties — which is NOT in the
// repository (android/.gitignore excludes key.properties, *.jks and *.keystore)
// and must never be. Whoever holds the upload key can publish an update to the
// Play listing, and for a financial app that is the whole game. Losing it is
// recoverable via Play's key reset; leaking it is not.
//
// The file is absent on a fresh clone and on CI, so the build falls back to
// debug signing to keep `flutter run --release` working. A debug-signed bundle
// is rejected by the Play Console, so that fallback cannot be published by
// accident — but it is warned about loudly below all the same.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}
val hasUploadKey = keystorePropertiesFile.exists()

android {
    // The Kotlin/R-class package. Unlike applicationId this is not the app's
    // public identity, so it stays as generated — renaming it would move
    // MainActivity and buy nothing.
    namespace = "co.startupripple.cooperativeos_mobile"

    // Pinned rather than inherited from `flutter.*`. Google Play enforces a
    // minimum target API that rises every August, and the level a build was
    // submitted against must be a deliberate choice — not something a
    // `flutter upgrade` silently changes underneath a release.
    compileSdk = 36

    // Every Android plugin in this app (image_picker, webview_flutter,
    // path_provider, shared_preferences, open_filex,
    // flutter_plugin_android_lifecycle) asks for 27.0.12077973, while
    // flutter.ndkVersion resolves to 26.3.11579264. NDK versions are backward
    // compatible, so the highest wins; leaving them mismatched risks native
    // crashes on a user's device that never appear in a debug build.
    ndkVersion = "27.0.12077973"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // Permanent once published: this is the app's identity on Google Play
        // and in its store URL, and it can never be changed afterwards.
        applicationId = "co.startupripple.cooperativeos"

        // Android 5.0. Pinned deliberately: raising it silently cuts off the
        // older handsets a cooperative's members are most likely to own.
        minSdk = 21

        // Must equal or trail compileSdk. See the note on compileSdk above —
        // Play's required level moves every August, so confirm this against the
        // Console before each submission rather than assuming it still passes.
        targetSdk = 36

        // Both come from `version:` in pubspec.yaml (currently 1.0.0+1).
        // versionCode must increase on every upload; Play rejects a reused one.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            // Left null when key.properties is absent; the release build type
            // below then stays on debug signing rather than failing a dev build.
            keyAlias = keystoreProperties.getProperty("keyAlias")
            keyPassword = keystoreProperties.getProperty("keyPassword")
            storePassword = keystoreProperties.getProperty("storePassword")
            storeFile = keystoreProperties.getProperty("storeFile")?.let { file(it) }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasUploadKey) {
                signingConfigs.getByName("release")
            } else {
                logger.warn(
                    "\n*** android/key.properties not found — signing this " +
                    "release with DEBUG keys. Fine for `flutter run --release`; " +
                    "the Play Console will reject the bundle. See " +
                    "mobile/README.md § Releasing to Google Play. ***\n"
                )
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}
