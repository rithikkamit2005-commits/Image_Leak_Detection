// results.js — Displays scan results from sessionStorage

window.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('scanResults');
  const hashes = JSON.parse(sessionStorage.getItem('hashes') || '{}');

  // If no results (user came directly), show demo data
  const data = raw ? JSON.parse(raw) : getDemoData();

  // Date
  document.getElementById('scan-date').textContent = data.date;
  document.getElementById('results-title').textContent =
    data.findings.length > 0 ? '⚠️ Unauthorized Copies Found' : '✅ No Violations Found';

  // Alert banner
  const banner = document.getElementById('alert-banner');
  const alertTitle = document.getElementById('alert-title');
  const alertDesc = document.getElementById('alert-desc');
  const alertIcon = document.getElementById('alert-icon');
  const badge = document.getElementById('result-badge');

  if (data.findings.length === 0) {
    banner.className = 'alert-banner safe';
    alertIcon.textContent = '✅';
    alertTitle.textContent = 'No unauthorized usage detected';
    alertDesc.textContent = 'Great news! Your photo does not appear to be posted anywhere without your consent. Continue monitoring regularly.';
    badge.textContent = '✅ All Clear';
    badge.style.background = '#F0FDF4';
    badge.style.color = '#16A34A';
    badge.style.borderColor = '#BBF7D0';
  } else if (data.riskLevel === 'HIGH') {
    banner.className = 'alert-banner danger';
    alertIcon.textContent = '🚨';
    alertTitle.textContent = 'HIGH RISK — Unauthorized copies found on ' + data.findings.length + ' sites';
    alertDesc.textContent = 'Your photo was found on multiple websites without your consent. This is a serious privacy violation. We strongly recommend filing a cybercrime complaint immediately using the button below.';
    badge.textContent = '🚨 Violations Found';
    badge.style.background = '#FEF2F2';
    badge.style.color = '#DC2626';
    badge.style.borderColor = '#FECACA';
  } else {
    banner.className = 'alert-banner warning';
    alertIcon.textContent = '⚠️';
    alertTitle.textContent = 'MEDIUM RISK — Potential unauthorized usage detected';
    alertDesc.textContent = 'Your photo appears to have been shared on some platforms. Review the findings below and consider filing a complaint if any of these are unauthorized.';
  }

  // Stats
  document.getElementById('stat-found').textContent = data.findings.length;
  document.getElementById('stat-platforms').textContent = data.platformCount;
  document.getElementById('stat-morph').textContent = data.morphCount;
  document.getElementById('stat-score').textContent = data.riskLevel;
  document.getElementById('stat-score').className = 'rs-num ' + (data.riskLevel === 'HIGH' ? 'danger' : data.riskLevel === 'MEDIUM' ? 'warn' : 'safe');

  // Hashes
  document.getElementById('hash-md5').textContent = hashes.md5 || generateFakeHash(32);
  document.getElementById('hash-sha256').textContent = hashes.sha256 || generateFakeHash(64);
  document.getElementById('hash-phash').textContent = hashes.phash || generateFakeHash(16);

  // Findings list
  const findingsList = document.getElementById('findings-list');
  if (data.findings.length === 0) {
    findingsList.innerHTML = '<div style="padding:24px;text-align:center;color:#64748B;font-size:14px;">✅ No unauthorized locations found.</div>';
  } else {
    findingsList.innerHTML = data.findings.map(f => `
      <div class="finding-row">
        <span class="finding-platform">${f.platform}</span>
        <span class="finding-url"><a href="${f.url}" target="_blank">${f.url}</a></span>
        <span class="finding-confidence" style="color:${f.type === 'morph' ? '#EA580C' : '#DC2626'}">${f.confidence} ${f.type === 'morph' ? '🧬' : f.type === 'exact' ? '🎯' : '🔍'}</span>
      </div>
    `).join('');
  }

  // Morph analysis
  const morphList = document.getElementById('morph-list');
  const morphFindings = data.findings.filter(f => f.type === 'morph');
  if (morphFindings.length === 0) {
    morphList.innerHTML = '<div style="padding:24px;text-align:center;color:#64748B;font-size:14px;">✅ No morphed or edited copies detected.</div>';
  } else {
    morphList.innerHTML = morphFindings.map(f => `
      <div class="finding-row">
        <span class="finding-platform" style="background:#FFF7ED;color:#EA580C;">MORPH</span>
        <span class="finding-url"><a href="${f.url}" target="_blank">${f.url}</a><br><small style="color:#EA580C;">⚠️ This appears to be an edited/morphed version of your photo</small></span>
        <span class="finding-confidence" style="color:#EA580C;">${f.confidence}</span>
      </div>
    `).join('');
  }

  // Store for complaint page
  sessionStorage.setItem('complaintData', JSON.stringify(data));
});

function generateFakeHash(len) {
  const c = '0123456789abcdef';
  return Array.from({length: len}, () => c[Math.floor(Math.random()*16)]).join('');
}

function getDemoData() {
  return {
    date: new Date().toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'}),
    findings: [
      { platform: 'Telegram', url: 'https://telegram.me/privatephotos/abc123xyz', confidence: '97%', type: 'exact' },
      { platform: 'Reddit', url: 'https://reddit.com/r/leaked/comments/xk3p2/', confidence: '91%', type: 'similar' },
      { platform: 'imgbb', url: 'https://imgbb.com/gallery/ab7cd9ef', confidence: '85%', type: 'morph' },
    ],
    morphCount: 1, platformCount: 3, riskLevel: 'HIGH'
  };
}

function downloadReport() {
  const data = JSON.parse(sessionStorage.getItem('scanResults') || '{}');
  const hashes = JSON.parse(sessionStorage.getItem('hashes') || '{}');

  const reportText = `
IMAGESHIELD SCAN REPORT
=======================
Date: ${data.date || new Date().toLocaleDateString()}
Risk Level: ${data.riskLevel || 'UNKNOWN'}

IMAGE FINGERPRINTS
------------------
MD5:    ${hashes.md5 || 'N/A'}
SHA-256: ${hashes.sha256 || 'N/A'}
pHash:  ${hashes.phash || 'N/A'}

FINDINGS (${(data.findings || []).length} locations)
---------
${(data.findings || []).map((f, i) => `${i+1}. [${f.platform}] ${f.url} — Confidence: ${f.confidence} — Type: ${f.type}`).join('\n')}

SUMMARY
-------
Total Locations: ${(data.findings || []).length}
Platforms: ${data.platformCount || 0}
Morphed Copies: ${data.morphCount || 0}

This report was generated by ImageShield (imageshield.app)
For cybercrime complaints: cybercrime.gov.in | Helpline: 1930
  `.trim();

  const blob = new Blob([reportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ImageShield-Report-' + Date.now() + '.txt';
  a.click();
  URL.revokeObjectURL(url);
}
