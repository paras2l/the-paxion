import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const rootDir = path.join(__dirname, '..');
// The external raizen website project
const raizenDownloadsDir = 'D:\\Antigravity\\raizen\\downloads';

// Ensure the downloads directory exists
if (!fs.existsSync(raizenDownloadsDir)) {
  fs.mkdirSync(raizenDownloadsDir, { recursive: true });
}

console.log('\n🚀 Publishing builds to your Raizen website folder...');

// 1. Copy Android Build (APK)
const apkPath = path.join(rootDir, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (fs.existsSync(apkPath)) {
  console.log('📱 Copying Android APK...');
  fs.copyFileSync(apkPath, path.join(raizenDownloadsDir, 'raizen.apk'));
  console.log('✅ Android APK updated.');
} else {
  console.log('⚠️ No Android APK found. Skipping.');
}

// 2. Archive and Copy Windows Build (ZIP)
const winUnpackedDir = path.join(rootDir, 'release/win-unpacked');
const zipDest = path.join(raizenDownloadsDir, 'raizen.zip');

if (fs.existsSync(winUnpackedDir)) {
  console.log('🖥️ Archiving Windows build into a ZIP (this might take a few moments)...');
  try {
    // Run PowerShell to execute the compression
    execSync(`powershell -Command "Compress-Archive -Path '${winUnpackedDir}\\*' -DestinationPath '${zipDest}' -Force"`, { stdio: 'inherit' });
    console.log('✅ Windows ZIP updated.');
  } catch (error) {
    console.error('❌ Failed to package Windows build:', error.message);
  }
} else {
  console.log('⚠️ No Windows "win-unpacked" folder found. Skipping.');
}

console.log('\n🎉 Automation Complete! Your website now has the latest builds!\n');
