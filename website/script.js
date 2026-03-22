// Device detection and download logic
const userAgent = navigator.userAgent.toLowerCase();
const isAndroid = /android/.test(userAgent);
const isWindows = /windows/.test(userAgent);

const autoDownload = document.getElementById('auto-download');
const androidBtn = document.getElementById('android-btn');
const windowsBtn = document.getElementById('windows-btn');
const feedback = document.getElementById('download-feedback');

function setFeedback(msg) {
  feedback.textContent = msg;
  feedback.style.opacity = 1;
  setTimeout(() => { feedback.style.opacity = 0; }, 2000);
}

const GITHUB_REPO = 'paras2l/the-paxion';
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

async function updateDownloadLinks() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch release info');
    const data = await response.json();
    const assets = data.assets;
    const version = data.tag_name;

    // Update version display
    const versionEl = document.getElementById('version');
    if (versionEl) versionEl.textContent = version;

    // Map assets
    const apk = assets.find(a => a.name.endsWith('.apk'))?.browser_download_url;
    const zip = assets.find(a => a.name.endsWith('.zip'))?.browser_download_url;
    const exe = assets.find(a => a.name.startsWith('The.Raizen.Setup') && a.name.endsWith('.exe'))?.browser_download_url;

    const startDownload = (url, btn) => {
      if (!url) {
        setFeedback('Release not found yet. Try again later.');
        return;
      }
      btn.classList.add('selected');
      setFeedback('Redirecting to GitHub...');
      setTimeout(() => {
        window.location.href = url;
        btn.classList.remove('selected');
      }, 500);
    };

    if (isAndroid) {
      autoDownload.innerHTML = '<button class="download-btn primary selected">📱 Download for Android</button>';
      autoDownload.onclick = () => startDownload(apk, autoDownload.firstElementChild);
    } else if (isWindows) {
      autoDownload.innerHTML = '<button class="download-btn primary selected">🖥️ Download for Windows</button>';
      autoDownload.onclick = () => startDownload(exe || zip, autoDownload.firstElementChild);
    }

    androidBtn.onclick = () => startDownload(apk, androidBtn);
    windowsBtn.onclick = () => startDownload(zip, windowsBtn);
    if (windowsSetupBtn) {
      windowsSetupBtn.onclick = () => startDownload(exe, windowsSetupBtn);
    }
  } catch (err) {
    console.error('Error updating links:', err);
    setFeedback('Using local fallback links.');
    // Keep original fallbacks if API fails
  }
}

updateDownloadLinks();

document.getElementById('check-updates').onclick = () => {
  setFeedback('Checking latest version...');
  updateDownloadLinks();
};

// Simple particles background
const particles = document.getElementById('particles');
const PARTICLE_COUNT = 36;
const particleEls = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.style.left = Math.random() * 100 + 'vw';
  p.style.top = Math.random() * 100 + 'vh';
  p.style.width = p.style.height = (Math.random() * 2.5 + 1.5) + 'px';
  p.style.background = 'linear-gradient(90deg, #0ff, #7f7fff)';
  p.style.opacity = Math.random() * 0.5 + 0.3;
  p.style.position = 'absolute';
  p.style.borderRadius = '50%';
  p.style.filter = 'blur(0.5px)';
  particles.appendChild(p);
  particleEls.push(p);
}
function animateParticles() {
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = particleEls[i];
    let x = parseFloat(p.style.left);
    let y = parseFloat(p.style.top);
    x += Math.sin(Date.now() / 1200 + i) * 0.04;
    y += Math.cos(Date.now() / 900 + i) * 0.03;
    if (x > 100) x = 0; if (x < 0) x = 100;
    if (y > 100) y = 0; if (y < 0) y = 100;
    p.style.left = x + 'vw';
    p.style.top = y + 'vh';
  }
  requestAnimationFrame(animateParticles);
}
animateParticles();
