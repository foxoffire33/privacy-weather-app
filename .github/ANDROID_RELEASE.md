# Android release signing and verification

GitHub releases use a signed `assembleRelease` APK. The CI debug APK is only uploaded to workflow artifacts on non-release runs and is not published as an app release.

Configure the protected `android-release` GitHub environment with these secrets:

- `ANDROID_SIGNING_KEYSTORE_BASE64` — base64-encoded contents of the release keystore.
- `ANDROID_SIGNING_STORE_PASSWORD` — keystore password.
- `ANDROID_SIGNING_KEY_ALIAS` — alias of the release key.
- `ANDROID_SIGNING_KEY_PASSWORD` — key password.

Use an existing distribution signing key for updates. Do not create a new key unless you intend to change signing identity. Keep an offline backup of the keystore and recovery procedure; never commit it to git.

The release workflow verifies lint, unit tests and browser tests before building the signed APK. It uploads `app-release.apk` and `app-release.apk.sha256` to the GitHub release and generates a GitHub artifact attestation.

To verify a downloaded APK:

```sh
sha256sum -c app-release.apk.sha256
apksigner verify --verbose --print-certs app-release.apk
gh attestation verify app-release.apk --repo foxoffire33/privacy-weather-app
```

Compare the signer certificate SHA-256 digest to the known release certificate. The checksum file alone does not authenticate its publisher; use the GitHub release identity and attestation together with certificate verification.

The F-Droid path has a separate signing identity and packaging process; a byte-for-byte identical APK is not guaranteed. Maintain version identity and reproducibility notes for that pipeline separately.

Before the next production release, verify backup/restore behavior on supported Android versions, including cloud and device-to-device transfer. The manifest currently sets `allowBackup=false`; device-transfer behavior can vary by Android version/vendor.
