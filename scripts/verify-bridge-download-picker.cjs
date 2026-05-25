#!/usr/bin/env node
/**
 * Smoke test for installer filename selection (no network).
 * Run: node scripts/verify-bridge-download-picker.cjs
 */

const RELEASE_ASSETS = [
  'TradeIntel.Bridge_1.0.0_aarch64.dmg',
  'TradeIntel.Bridge_1.0.0_x64_en-US.msi',
  'TradeIntel.Bridge_1.0.0_x64-setup.exe',
  'TradeIntel.Bridge_1.0.0_amd64.AppImage',
  'TradeIntel.Bridge_1.0.0_amd64.deb',
];

function isMacArm64Asset(filename) {
  return /aarch64|arm64/i.test(filename);
}

function isMacX64Asset(filename) {
  return (
    (/x64|x86_64|intel/i.test(filename) || /\.dmg$/i.test(filename)) &&
    !isMacArm64Asset(filename)
  );
}

function pickMacDmg(filenames, macArch) {
  const dmgs = filenames.filter((f) => /\.dmg$/i.test(f));
  if (dmgs.length === 0) return undefined;
  if (macArch === 'arm64') return dmgs.find(isMacArm64Asset) ?? dmgs[0];
  if (macArch === 'x64') return dmgs.find(isMacX64Asset);
  return dmgs.find(isMacArm64Asset) ?? dmgs[0];
}

function pickWindowsInstaller(filenames) {
  return filenames.find((f) => /\.msi$/i.test(f)) ?? filenames.find((f) => /\.exe$/i.test(f));
}

function pickLinuxInstaller(filenames) {
  return filenames.find((f) => /\.AppImage$/i.test(f));
}

let failed = 0;

const arm = pickMacDmg(RELEASE_ASSETS, 'arm64');
if (arm !== 'TradeIntel.Bridge_1.0.0_aarch64.dmg') {
  console.error('FAIL mac arm64:', arm);
  failed++;
} else {
  console.log('OK mac arm64 ->', arm);
}

const intel = pickMacDmg(RELEASE_ASSETS, 'x64');
if (intel !== undefined) {
  console.error('FAIL mac x64 should be undefined (no Intel DMG in release):', intel);
  failed++;
} else {
  console.log('OK mac x64 -> none (expected until x64 DMG is built)');
}

const msi = pickWindowsInstaller(RELEASE_ASSETS);
if (msi !== 'TradeIntel.Bridge_1.0.0_x64_en-US.msi') {
  console.error('FAIL windows:', msi);
  failed++;
} else {
  console.log('OK windows ->', msi);
}

const appimage = pickLinuxInstaller(RELEASE_ASSETS);
if (appimage !== 'TradeIntel.Bridge_1.0.0_amd64.AppImage') {
  console.error('FAIL linux:', appimage);
  failed++;
} else {
  console.log('OK linux ->', appimage);
}

process.exit(failed ? 1 : 0);
