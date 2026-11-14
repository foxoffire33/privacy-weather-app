# Publishing on F-Droid (and /e/OS App Lounge)

App Lounge lists open source apps from the F-Droid catalogue, so getting into F-Droid is all that's needed.

## One-time submission

1. Merge the release PR and tag it: `git tag v0.3.0 && git push origin v0.3.0`, then publish a GitHub release for it. The recipe builds `v0.3.0`.
   Tags v0.2.5 to v0.2.9 were made without bumping the version (their `package.json` and `build.gradle` say 0.2.4), so F-Droid can't use them; 0.3.0 is the first good one since v0.2.4.
2. Fork https://gitlab.com/fdroid/fdroiddata, copy `nl.delaparraservices.apps.weather.yml` from this folder to `metadata/` in your fork, and open a merge request.
3. F-Droid's CI test-builds it; reviewers may ask for tweaks to the build steps.

Before submitting you can test the recipe locally with [fdroidserver](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/):
`fdroid readmeta && fdroid lint nl.delaparraservices.apps.weather && fdroid build -v -l nl.delaparraservices.apps.weather`.

## What F-Droid checks, and where it is handled

- **No proprietary code.** No Google Play Services, Firebase or Google services Gradle plugin (removed in 0.3.0).
- **No prebuilt binaries in the source tree.** npm's native build tools (esbuild, rollup, unrs) are listed under `scandelete`.
- **No dependency metadata blob** in the APK: `dependenciesInfo` is off in `android/app/build.gradle`.
- **Node version:** Debian's packaged Node is too old for Vite, so the recipe downloads Node 22 and checks its SHA-256.
- **Anti-features:** none. The app has no tracking and no ads, and Open-Meteo is open source and self-hostable.
- **Store listing:** `fastlane/metadata/android/en-US/` holds the title, descriptions, icon, feature graphic, screenshots and per-versionCode changelogs.

After it is merged, F-Droid checks this repo for new `vX.Y.Z` tags and builds them on its own. No further merge requests are needed.

## Releasing

```bash
# optional: write release notes for F-Droid first, named after the new versionCode
#   fastlane/metadata/android/en-US/changelogs/<versionCode>.txt   (0.1.6 -> 106)
npm version patch        # or minor / major: bumps package.json + build.gradle, commits, tags
git push --follow-tags
```

Then publish a GitHub release for the new tag. Two workflows run:

- **Android APK** builds a debug APK and attaches it to the release.
- **F-Droid release check** fails if the tag, `package.json` and `build.gradle` disagree, because F-Droid would then build the wrong version or skip it.

versionCode is `MAJOR*10000 + MINOR*100 + PATCH`, so minor and patch must stay below 100.
