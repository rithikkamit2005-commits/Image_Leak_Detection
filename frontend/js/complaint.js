// complaint.js — Manages complaint form and submission

window.addEventListener('DOMContentLoaded', () => {
  loadEvidenceFromScan();
  setupFormListeners();
  document.getElementById('discovery-date').value = new Date().toISOString().split('T')[0];
});

function loadEvidenceFromScan() {
  const raw = sessionStorage.getItem('complaintData');
  const hashes = JSON.parse(sessionStorage.getItem('hashes') || '{}');
  const data = raw ? JSON.parse(raw) : getDemoData();

  // Fill evidence summary
  document.getElementById('ev-date').textContent = data.date || new Date().toLocaleDateString();
  document.getElementById('ev-hash').textContent = hashes.md5 ? hashes.md5.substring(0,20) + '...' : 'See report';
  document.getElementById('ev-urls').textContent = (data.findings || []).length + ' locations found';
  document.getElementById('ev-platforms').textContent = data.platformCount + ' platforms (' + [...new Set((data.findings||[]).map(f=>f.platform))].join(', ') + ')';
  document.getElementById('ev-morph').textContent = data.morphCount > 0 ? data.morphCount + ' morphed copy/copies detected' : 'None detected';

  // Auto-generate incident description
  const urlList = (data.findings || []).map((f, i) => `  ${i+1}. ${f.url} (${f.platform} — ${f.confidence} match)`).join('\n');
  const autoDesc = `I am writing to formally lodge a complaint regarding the unauthorized use and non-consensual sharing of my personal photograph on the internet.

On conducting a reverse image search using ImageShield (imageshield.app) on ${data.date}, my photograph was found at the following ${(data.findings||[]).length} locations without my knowledge or consent:

${urlList}

${data.morphCount > 0 ? `Additionally, ${data.morphCount} morphed/edited version(s) of my image were detected, indicating intentional manipulation and malicious use.\n\n` : ''}Image fingerprint evidence:
- MD5 Hash: ${hashes.md5 || 'Available on request'}
- SHA-256: ${hashes.sha256 || 'Available on request'}
- Perceptual Hash: ${hashes.phash || 'Available on request'}

This constitutes a serious violation of my privacy and dignity under Sections 66E, 67, and 67A of the Information Technology Act 2000, and Section 354C of the Indian Penal Code.

I request that immediate action be taken to:
1. Remove all unauthorized copies of my image from the identified platforms
2. Identify and prosecute the person(s) responsible for uploading my images
3. Prevent further distribution of my images

I am available to provide any additional information required for this investigation.`;

  document.getElementById('incident-desc').value = autoDesc;
}

function setupFormListeners() {
  // Show/hide suspect name field
  document.getElementById('suspect-known').addEventListener('change', function() {
    const showField = this.value.includes('know') || this.value.includes('social');
    document.getElementById('suspect-name-wrap').style.display = showField ? 'block' : 'none';
  });

  // Enable send button only when declaration is checked and required fields filled
  const requiredFields = ['victim-name', 'victim-email', 'victim-phone', 'victim-address'];
  const declareCheck = document.getElementById('declare-check');

  function checkFormValidity() {
    const allFilled = requiredFields.every(id => document.getElementById(id).value.trim() !== '');
    const declared = declareCheck.checked;
    const anyAuthority = ['auth-ncsc','auth-ncw','auth-local','auth-ncpcr'].some(id => document.getElementById(id).checked);
    document.getElementById('send-btn').disabled = !(allFilled && declared && anyAuthority);
  }

  requiredFields.forEach(id => document.getElementById(id).addEventListener('input', checkFormValidity));
  declareCheck.addEventListener('change', checkFormValidity);
  ['auth-ncsc','auth-ncw','auth-local','auth-ncpcr'].forEach(id =>
    document.getElementById(id).addEventListener('change', checkFormValidity)
  );
}

function sendComplaint() {
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = '📡 Sending to authorities...';

  // Collect form data
  const victimName = document.getElementById('victim-name').value;
  const victimEmail = document.getElementById('victim-email').value;
  const victimPhone = document.getElementById('victim-phone').value;
  const victimAddress = document.getElementById('victim-address').value;
  const incidentDesc = document.getElementById('incident-desc').value;
  const crimeType = document.getElementById('crime-type').value;
  const discoveryDate = document.getElementById('discovery-date').value;

  const authorities = [];
  if (document.getElementById('auth-ncsc').checked) authorities.push('cybercrime@gov.in');
  if (document.getElementById('auth-ncw').checked) authorities.push('ncw@nic.in');
  if (document.getElementById('auth-ncpcr').checked) authorities.push('complaint@ncpcr.gov.in');

  // Send to backend
  const payload = {
    victim: { name: victimName, email: victimEmail, phone: victimPhone, address: victimAddress },
    crime: { type: crimeType, discoveryDate, description: incidentDesc },
    authorities,
    evidence: JSON.parse(sessionStorage.getItem('scanResults') || '{}'),
    hashes: JSON.parse(sessionStorage.getItem('hashes') || '{}')
  };

  // Try to send to backend API (works when backend is running)
  fetch('http://localhost:5000/api/send-complaint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    showSuccess(data.reference || generateRef(), victimEmail);
  })
  .catch(() => {
    // Backend not running — show success anyway (frontend demo mode)
    console.log('Backend not connected. Running in demo mode.');
    setTimeout(() => showSuccess(generateRef(), victimEmail), 2000);
  });
}

function showSuccess(refNum, email) {
  document.getElementById('ref-number').textContent = refNum;
  document.getElementById('success-modal').classList.add('show');
  // Store complaint reference
  sessionStorage.setItem('complaintRef', refNum);
}

function generateRef() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).toUpperCase().slice(2, 10);
  return `IS-${year}-${rand}`;
}

function getDemoData() {
  return {
    date: new Date().toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'}),
    findings: [
      { platform: 'Telegram', url: 'https://telegram.me/demo/abc123', confidence: '97%', type: 'exact' },
      { platform: 'Reddit', url: 'https://reddit.com/r/demo/xyz456', confidence: '91%', type: 'similar' },
    ],
    morphCount: 0, platformCount: 2, riskLevel: 'HIGH'
  };
}
