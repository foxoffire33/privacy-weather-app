#!/usr/bin/env node
// Keeps the Android versionName/versionCode in sync with package.json.
//
//   node scripts/android-version.mjs            write package.json's version into build.gradle
//   node scripts/android-version.mjs --check v1.2.3
//                                               fail unless the tag, package.json and build.gradle agree
//
// versionCode is derived from the version so it always increases:
//   MAJOR * 10000 + MINOR * 100 + PATCH   (0.1.4 -> 104, 1.2.3 -> 10203)
// F-Droid reads the literal values from build.gradle at the release tag,
// so they must be committed before tagging. `npm version <patch|minor|major>` does that.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradlePath = join(root, 'android/app/build.gradle');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

function versionCode(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`Version "${version}" is not plain MAJOR.MINOR.PATCH`);
  const [maj, min, pat] = m.slice(1).map(Number);
  if (min > 99 || pat > 99) throw new Error(`Minor and patch must be 0-99 (got ${version})`);
  return maj * 10000 + min * 100 + pat;
}

const gradle = readFileSync(gradlePath, 'utf8');
const nameRe = /versionName\s+"([^"]*)"/;
const codeRe = /versionCode\s+(\d+)/;

const args = process.argv.slice(2);

if (args[0] === '--check') {
  const tag = (args[1] || '').replace(/^refs\/tags\//, '');
  const tagVersion = tag.replace(/^v/, '');
  const gName = nameRe.exec(gradle)?.[1];
  const gCode = Number(codeRe.exec(gradle)?.[1]);
  const errors = [];
  let expected;
  try {
    expected = versionCode(tagVersion);
  } catch (e) {
    errors.push(`Tag "${tag}": ${e.message}. F-Droid only picks up tags like v1.2.3.`);
  }
  if (pkg.version !== tagVersion) errors.push(`package.json version is ${pkg.version}, tag is ${tag}.`);
  if (gName !== tagVersion) errors.push(`build.gradle versionName is ${gName}, tag is ${tag}.`);
  if (expected !== undefined && gCode !== expected)
    errors.push(`build.gradle versionCode is ${gCode}, expected ${expected} for ${tagVersion}.`);

  const changelog = expected !== undefined
    ? `fastlane/metadata/android/en-US/changelogs/${expected}.txt` : null;
  const warnings = [];
  if (changelog && !existsSync(join(root, changelog)))
    warnings.push(`No ${changelog}; F-Droid will show no "what's new" text for this version.`);

  const lines = [`## F-Droid release check for \`${tag}\``, ''];
  if (errors.length) {
    lines.push('❌ F-Droid will not build this release correctly:', '', ...errors.map((e) => `- ${e}`), '',
      'Fix: delete the release and tag, run `npm version <x.y.z>` (it updates build.gradle, commits and tags), then push with `git push --follow-tags` and publish the release again.');
  } else {
    lines.push(`✅ Tag, package.json and build.gradle agree: ${tagVersion} (versionCode ${expected}). F-Droid will pick this up on its next update check.`);
  }
  if (warnings.length) lines.push('', ...warnings.map((w) => `- ⚠️ ${w}`));
  const summary = lines.join('\n');
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  for (const w of warnings) console.log(`::warning::${w}`);
  for (const e of errors) console.log(`::error::${e}`);
  process.exit(errors.length ? 1 : 0);
}

const code = versionCode(pkg.version);
if (!nameRe.test(gradle) || !codeRe.test(gradle)) throw new Error('versionName/versionCode not found in build.gradle');
writeFileSync(
  gradlePath,
  gradle.replace(nameRe, `versionName "${pkg.version}"`).replace(codeRe, `versionCode ${code}`),
);
console.log(`build.gradle -> versionName ${pkg.version}, versionCode ${code}`);
