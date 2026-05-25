export type BridgePlatform = 'windows' | 'mac' | 'linux';

export const INSTALL_TIPS: Record<BridgePlatform, string> = {
  mac: `macOS may say the app is "damaged" — this is normal for unsigned apps (not corrupt).

After download:
1. Open the .dmg and drag TradeIntel Bridge to Applications
2. Run in Terminal:
   xattr -dr com.apple.quarantine "/Applications/TradeIntel Bridge.app"
   OR right-click the app → Open (first time only)

Current installer is for Apple Silicon (M1/M2/M3). Intel Macs need an x64 build (contact support).

Then open the app from Applications (not the DMG).`,

  windows: `Windows may show SmartScreen ("Windows protected your PC") — the installer is unsigned.

Click More info → Run anyway, then complete setup.

Use the .msi installer. After install, launch TradeIntel Bridge from the Start menu.`,

  linux: `For AppImage: chmod +x the file, then run it.

Example:
chmod +x tradeintel-bridge*.AppImage
./tradeintel-bridge*.AppImage`,
};

export function getPostDownloadTip(platform: BridgePlatform): string {
  return INSTALL_TIPS[platform];
}
