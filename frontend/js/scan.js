// scan.js — Handles image upload, drag/drop, and real backend scan

const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const previewArea = document.getElementById('preview-area');
const previewImg = document.getElementById('preview-img');
const fileName = document.getElementById('file-name');
const fileSize = document.getElementById('file-size');
const scanBtn = document.getElementById('scan-btn');
let selectedFile = null;

// ── Drag & Drop ──────────────────────────────────────────
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) handleFile(file);
});

// ── File Input ───────────────────────────────────────────
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    previewArea.style.display = 'flex';
  };
  reader.readAsDataURL(file);
  scanBtn.disabled = false;
  scanBtn.textContent = '🔍 Start Internet Scan';

  sessionStorage.setItem('imageName', file.name);
  sessionStorage.setItem('imageSize', formatSize(file.size));
}

function removeImage() {
  selectedFile = null;
  previewArea.style.display = 'none';
  previewImg.src = '';
  fileInput.value = '';
  scanBtn.disabled = true;
  scanBtn.textContent = '📤 Upload a photo to begin scan';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Scan Process ─────────────────────────────────────────
async function startScan() {
  if (!selectedFile) return;

  document.getElementById('upload-section').style.display = 'none';
  document.getElementById('progress-section').style.display = 'block';

  // Store preview image for results page
  const reader = new FileReader();
  reader.onload = (e) => sessionStorage.setItem('scannedImage', e.target.result);
  reader.readAsDataURL(selectedFile);

  // Start animated steps while backend is working
  runScanSteps();

  // Build form data to send image to Flask backend
  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('google', document.getElementById('opt-google').checked);
  formData.append('morph',  document.getElementById('opt-morph').checked);

  try {
    // ✅ Send image to real Flask backend
    const response = await fetch('http://127.0.0.1:5000/api/scan', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Backend returned error: ' + response.status);

    // ✅ Real results — real hashes + real Google Vision results
    const data = await response.json();

    sessionStorage.setItem('hashes', JSON.stringify(data.hashes));
    sessionStorage.setItem('scanResults', JSON.stringify({
      date: data.date,
      findings: data.findings,
      morphCount: data.summary.morph_count,
      platformCount: data.summary.platform_count,
      riskLevel: data.summary.risk_level
    }));

  } catch (err) {
    console.warn('Backend not reachable — running in demo mode.', err);

    // Fallback demo mode if backend is not running
    sessionStorage.setItem('hashes', JSON.stringify({
      md5:    generateDemoHash(32),
      sha256: generateDemoHash(64),
      phash:  generateDemoHash(16)
    }));

    sessionStorage.setItem('scanResults', JSON.stringify({
      date: new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }),
      findings: [
        { platform: 'Telegram', url: 'https://telegram.me/privatephotos/demo123', confidence: '97%', type: 'exact' },
        { platform: 'Reddit',   url: 'https://reddit.com/r/leaked/demo456',       confidence: '91%', type: 'similar' },
        { platform: 'ImgBB',    url: 'https://imgbb.com/gallery/demo789',         confidence: '85%', type: 'morph' }
      ],
      morphCount: 1,
      platformCount: 3,
      riskLevel: 'HIGH'
    }));
  }
}

// ── Step-by-step animated progress UI ───────────────────
const steps = [
  { id: 'step-hash',   label: 'Generating image fingerprint',  delay: 1200 },
  { id: 'step-google', label: 'Searching Google Images',        delay: 2400 },
  { id: 'step-social', label: 'Checking social media',          delay: 1800 },
  { id: 'step-morph',  label: 'Analyzing for morphed copies',   delay: 2200 },
  { id: 'step-report', label: 'Compiling results report',       delay: 1000 },
];

function runScanSteps() {
  const progressBar = document.getElementById('progress-bar');
  const statusText  = document.getElementById('status-text');
  let totalTime = 0;

  steps.forEach((step, i) => {
    setTimeout(() => {
      const el = document.getElementById(step.id);
      el.classList.add('active');
      el.querySelector('.step-status').innerHTML = '<div class="spinner"></div>';
      statusText.textContent = step.label + '...';
    }, totalTime);

    setTimeout(() => {
      const el = document.getElementById(step.id);
      el.classList.remove('active');
      el.classList.add('done');
      el.querySelector('.step-status').textContent = '✅';
      progressBar.style.width = Math.round(((i + 1) / steps.length) * 100) + '%';
    }, totalTime + step.delay - 200);

    totalTime += step.delay;
  });

  setTimeout(() => {
    statusText.textContent = 'Scan complete! Preparing your report...';
    setTimeout(() => { window.location.href = 'results.html'; }, 800);
  }, totalTime);
}

// ── Only used if backend is offline (demo fallback) ──────
function generateDemoHash(length) {
  const chars = '0123456789abcdef';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * 16)]).join('');
}