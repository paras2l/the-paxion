import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const rootDir = path.join(__dirname, '..');
// The external raizen website project
const raizenDownloadsDir = 'D:\\Antigravity\\raizen\\downloads';
// The internal website folder in this repo
const internalWebsiteDownloads = path.join(rootDir, 'website', 'downloads');

// Ensure directories exist
[raizenDownloadsDir, internalWebsiteDownloads].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('\n🚀 Publishing builds to your Raizen website folder...');

// 1. Copy Android Build (APK)
const apkPath = path.join(rootDir, 'android/app/build/outputs/apk/debug/app-debug.apk');
if (fs.existsSync(apkPath)) {
  console.log('📱 Copying Android APK...');
  fs.copyFileSync(apkPath, path.join(raizenDownloadsDir, 'raizen.apk'));
  fs.copyFileSync(apkPath, path.join(internalWebsiteDownloads, 'raizen.apk'));
  console.log('✅ Android APK updated (Internal & External).');
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
    const internalZipDest = path.join(internalWebsiteDownloads, 'raizen.zip');
    
    console.log('🖥️ Archiving Windows build into External ZIP...');
    execSync(`powershell -Command "Compress-Archive -Path '${winUnpackedDir}\\*' -DestinationPath '${zipDest}' -Force"`, { stdio: 'inherit' });
    
    console.log('🖥️ Archiving Windows build into Internal ZIP...');
    execSync(`powershell -Command "Compress-Archive -Path '${winUnpackedDir}\\*' -DestinationPath '${internalZipDest}' -Force"`, { stdio: 'inherit' });

    // 3. Copy the Setup/Installer EXE
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    console.log(`🔍 Looking for installer for version ${pkg.version}...`);
    
    // List all files in release and find the one that starts with "The Raizen Setup" and ends with ".exe"
    const releaseFiles = fs.readdirSync(path.join(rootDir, 'release'));
    const setupExeName = releaseFiles.find(f => f.startsWith('The Raizen Setup') && f.endsWith('.exe') && f.includes(pkg.version));
    
    if (setupExeName) {
      const setupExePath = path.join(rootDir, 'release', setupExeName);
      const setupExeDest = path.join(internalWebsiteDownloads, 'raizen-setup.exe');
      console.log(`📦 Copying ${setupExeName} to website/downloads/raizen-setup.exe...`);
      fs.copyFileSync(setupExePath, setupExeDest);
      console.log('✅ Setup EXE updated.');
    } else {
      console.log(`⚠️ No Setup EXE found for version ${pkg.version} in release/ directory.`);
    }

    console.log('✅ Windows builds updated (Internal & External).');
  } catch (error) {
    console.error('❌ Failed to package Windows build:', error.message);
  }
} else {
  console.log('⚠️ No Windows "win-unpacked" folder found. Skipping.');
}

// 4. Update Website version in index.html
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const indexPath = path.join(rootDir, 'website', 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log(`📝 Updating website version to ${pkg.version}...`);
    let html = fs.readFileSync(indexPath, 'utf8');
    // Regex to find <span id="version">...</span>
    html = html.replace(/(<span id="version">)([^<]*)(<\/span>)/, `$1v${pkg.version}$3`);
    fs.writeFileSync(indexPath, html);
    console.log('✅ website/index.html version updated.');
  }
} catch (error) {
  console.error('❌ Failed to update website version:', error.message);
}

console.log('\n🎉 Automation Complete! Your website now has the latest builds!\n');
