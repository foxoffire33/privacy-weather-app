# Publishing on F-Droid (and /e/OS App Lounge)

App Lounge lists open source apps from the F-Droid catalogue, so getting into F-Droid is all that's needed.

## One-time submission

1. Release v0.1.5 (see "Releasing" below) so the tag F-Droid builds exists.
2. Fork https://gitlab.com/fdroid/fdroiddata, copy `nl.delaparraservices.apps.weather.yml` from this folder to `metadata/` in your fork, and open a merge request.
3. F-Droid's CI test-builds it; reviewers may ask for tweaks to the build steps.

After it is merged, F-Droid checks this repo for new `vX.Y.Z` tags and builds them on its own. No further merge requests are needed.

## Releasing

```bash
# optional: write release notes for F-Droid first, named after the new versionCode
#   fastlane/metadata/android/en-US/changelogs/<versionCode>.txt   (0.1.5 -> 105)
npm version patch        # or minor / major: bumps package.json + build.gradle, commits, tags
git push --follow-tags
```

Then publish a GitHub release for the new tag. Two workflows run:

- **Android APK** builds a debug APK and attaches it to the release.
- **F-Droid release check** fails if the tag, `package.json` and `build.gradle` disagree, because F-Droid would then build the wrong version or skip it.

versionCode is `MAJOR*10000 + MINOR*100 + PATCH`, so minor and patch must stay below 100.
