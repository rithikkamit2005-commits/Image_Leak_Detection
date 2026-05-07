"""
ImageShield Backend — Flask API
Handles: image hashing, reverse image search, complaint email sending
Run: python app.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import hashlib
import os
import base64
import json
import uuid
from datetime import datetime
from io import BytesIO

# Image processing
from PIL import Image
import imagehash

# Email
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Search APIs (optional — set in config.py)
try:
    from config import GOOGLE_API_KEY, SERPAPI_KEY, SMTP_EMAIL, SMTP_PASSWORD
except ImportError:
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')
    SERPAPI_KEY    = os.environ.get('SERPAPI_KEY', '')
    SMTP_EMAIL     = os.environ.get('SMTP_EMAIL', '')
    SMTP_PASSWORD  = os.environ.get('SMTP_PASSWORD', '')

import requests

app = Flask(__name__)
CORS(app)  # Allow frontend to call backend from different port

UPLOAD_FOLDER = 'temp_uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ──────────────────────────────────────────────────────────
# ROUTE: Health check
# ──────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'ImageShield API'})


# ──────────────────────────────────────────────────────────
# ROUTE: Scan image
# ──────────────────────────────────────────────────────────
@app.route('/api/scan', methods=['POST'])
def scan_image():
    """
    Accepts: multipart/form-data with 'image' file
    Returns: JSON with hash values and search results
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Save temporarily
    temp_path = os.path.join(UPLOAD_FOLDER, str(uuid.uuid4()) + '_' + file.filename)
    file.save(temp_path)

    try:
        # 1. Generate image hashes
        hashes = generate_hashes(temp_path)

        # 2. Search options from form
        do_google = request.form.get('google', 'true') == 'true'
        do_morph  = request.form.get('morph', 'true') == 'true'

        findings = []

        # 3. Google Reverse Image Search
        if do_google and GOOGLE_API_KEY:
            google_results = search_google_vision(temp_path)
            findings.extend(google_results)

        # 4. SerpAPI (Google Images)
        if do_google and SERPAPI_KEY:
            serp_results = search_serpapi(temp_path)
            findings.extend(serp_results)

        # 5. Morph detection (compare pHash with found images)
        morph_findings = []
        if do_morph:
            morph_findings = detect_morphs(temp_path, hashes['phash'])

        # Build response
        response = {
            'success': True,
            'scan_id': str(uuid.uuid4()),
            'date': datetime.now().strftime('%d %B %Y'),
            'hashes': hashes,
            'findings': findings,
            'morph_findings': morph_findings,
            'summary': {
                'total_found': len(findings),
                'morph_count': len(morph_findings),
                'platform_count': len(set(f.get('platform','') for f in findings)),
                'risk_level': 'HIGH' if len(findings) > 3 else ('MEDIUM' if findings else 'LOW')
            }
        }

        return jsonify(response)

    finally:
        # Always delete the uploaded image — privacy first!
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ──────────────────────────────────────────────────────────
# ROUTE: Send complaint email
# ──────────────────────────────────────────────────────────
@app.route('/api/send-complaint', methods=['POST'])
def send_complaint():
    """
    Accepts: JSON with victim details, crime details, authorities, evidence
    Returns: JSON with reference number
    """
    data = request.json
    reference = 'IS-' + datetime.now().strftime('%Y') + '-' + uuid.uuid4().hex[:8].upper()

    victim = data.get('victim', {})
    crime  = data.get('crime', {})
    authorities = data.get('authorities', [])
    evidence = data.get('evidence', {})
    hashes = data.get('hashes', {})

    # Generate PDF complaint
    pdf_path = generate_complaint_pdf(reference, victim, crime, evidence, hashes)

    # Send emails to authorities
    emails_sent = []
    for authority_email in authorities:
        try:
            success = send_email(
                to_email=authority_email,
                victim_email=victim.get('email', ''),
                victim_name=victim.get('name', 'Victim'),
                reference=reference,
                crime_type=crime.get('type', ''),
                description=crime.get('description', ''),
                pdf_path=pdf_path
            )
            if success:
                emails_sent.append(authority_email)
        except Exception as e:
            print(f"Failed to send to {authority_email}: {e}")

    # Also send copy to victim
    if victim.get('email'):
        try:
            send_copy_to_victim(victim, reference, pdf_path)
        except Exception as e:
            print(f"Failed to send copy to victim: {e}")

    # Cleanup PDF
    if os.path.exists(pdf_path):
        os.remove(pdf_path)

    return jsonify({
        'success': True,
        'reference': reference,
        'emails_sent': emails_sent,
        'message': f'Complaint sent to {len(emails_sent)} authorities'
    })


# ──────────────────────────────────────────────────────────
# HELPER: Generate image hashes
# ──────────────────────────────────────────────────────────
def generate_hashes(image_path):
    """Generate MD5, SHA-256, and perceptual hash for an image"""
    # Cryptographic hashes (exact match detection)
    with open(image_path, 'rb') as f:
        data = f.read()
        md5 = hashlib.md5(data).hexdigest()
        sha256 = hashlib.sha256(data).hexdigest()

    # Perceptual hash (detects visually similar/morphed images)
    with Image.open(image_path) as img:
        phash = str(imagehash.phash(img))
        dhash = str(imagehash.dhash(img))
        ahash = str(imagehash.average_hash(img))

    return {
        'md5': md5,
        'sha256': sha256,
        'phash': phash,
        'dhash': dhash,
        'ahash': ahash
    }


# ──────────────────────────────────────────────────────────
# HELPER: Google Vision API search
# ──────────────────────────────────────────────────────────
def search_google_vision(image_path):
    """Use Google Cloud Vision API to find web matches"""
    if not GOOGLE_API_KEY:
        return []

    with open(image_path, 'rb') as f:
        image_data = base64.b64encode(f.read()).decode('utf-8')

    url = f'https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_API_KEY}'
    payload = {
        "requests": [{
            "image": {"content": image_data},
            "features": [{"type": "WEB_DETECTION", "maxResults": 20}]
        }]
    }

    try:
        response = requests.post(url, json=payload, timeout=15)
        result = response.json()
        web = result['responses'][0].get('webDetection', {})

        findings = []
        for page in web.get('pagesWithMatchingImages', []):
            url_str = page.get('url', '')
            findings.append({
                'platform': extract_platform(url_str),
                'url': url_str,
                'confidence': '90%+',
                'type': 'exact',
                'source': 'Google Vision'
            })
        return findings
    except Exception as e:
        print(f"Google Vision error: {e}")
        return []


# ──────────────────────────────────────────────────────────
# HELPER: SerpAPI (Google Images)
# ──────────────────────────────────────────────────────────
def search_serpapi(image_path):
    """Use SerpAPI to do a Google reverse image search"""
    if not SERPAPI_KEY:
        return []

    # SerpAPI needs a URL, so this requires hosting the image temporarily
    # For now, return empty — implement with image hosting service
    return []


# ──────────────────────────────────────────────────────────
# HELPER: Morph detection
# ──────────────────────────────────────────────────────────
def detect_morphs(image_path, original_phash_str):
    """
    Detect morphed/edited versions by comparing pHash values.
    Hamming distance < 15 = likely a morphed copy.
    """
    # In a full implementation, you'd compare against found images
    # For now, this is a placeholder that returns empty
    return []


# ──────────────────────────────────────────────────────────
# HELPER: Extract platform name from URL
# ──────────────────────────────────────────────────────────
def extract_platform(url):
    platform_map = {
        'instagram': 'Instagram', 'facebook': 'Facebook', 'fb.com': 'Facebook',
        'twitter': 'Twitter/X', 'x.com': 'Twitter/X', 'reddit': 'Reddit',
        'telegram': 'Telegram', 't.me': 'Telegram', 'tiktok': 'TikTok',
        'youtube': 'YouTube', 'imgur': 'Imgur', 'imgbb': 'ImgBB',
        'pinterest': 'Pinterest', 'tumblr': 'Tumblr', 'whatsapp': 'WhatsApp'
    }
    url_lower = url.lower()
    for key, name in platform_map.items():
        if key in url_lower:
            return name
    # Extract domain if no match
    try:
        domain = url.split('/')[2].replace('www.', '')
        return domain[:20]
    except:
        return 'Unknown'


# ──────────────────────────────────────────────────────────
# HELPER: Generate PDF complaint
# ──────────────────────────────────────────────────────────
def generate_complaint_pdf(reference, victim, crime, evidence, hashes):
    pdf_path = os.path.join(UPLOAD_FOLDER, reference + '.pdf')
    doc = SimpleDocTemplate(pdf_path, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle('Title', parent=styles['Heading1'],
        fontSize=18, textColor=colors.HexColor('#1D4ED8'),
        spaceAfter=6, alignment=TA_CENTER)
    story.append(Paragraph('🛡️ IMAGESHIELD — CYBERCRIME COMPLAINT', title_style))
    story.append(Paragraph(f'Reference: {reference}', ParagraphStyle('ref',
        parent=styles['Normal'], fontSize=10, textColor=colors.grey,
        alignment=TA_CENTER, spaceAfter=20)))
    story.append(Spacer(1, 0.3*cm))

    # Complainant Details
    story.append(Paragraph('COMPLAINANT DETAILS', styles['Heading2']))
    details = [
        ['Name', victim.get('name', 'N/A')],
        ['Email', victim.get('email', 'N/A')],
        ['Phone', victim.get('phone', 'N/A')],
        ['Address', victim.get('address', 'N/A')],
        ['Date Filed', datetime.now().strftime('%d %B %Y')],
    ]
    t = Table(details, colWidths=[5*cm, 12*cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#EFF6FF')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.5*cm))

    # Crime Details
    story.append(Paragraph('CRIME DETAILS', styles['Heading2']))
    story.append(Paragraph(f'<b>Type:</b> {crime.get("type", "N/A")}', styles['Normal']))
    story.append(Spacer(1, 0.2*cm))

    # Description
    story.append(Paragraph('INCIDENT DESCRIPTION', styles['Heading2']))
    desc = crime.get('description', '').replace('\n', '<br/>')
    story.append(Paragraph(desc, styles['Normal']))
    story.append(Spacer(1, 0.5*cm))

    # Evidence
    story.append(Paragraph('DIGITAL EVIDENCE — IMAGE FINGERPRINTS', styles['Heading2']))
    hash_data = [
        ['Hash Type', 'Value'],
        ['MD5', hashes.get('md5', 'N/A')],
        ['SHA-256', hashes.get('sha256', 'N/A')],
        ['Perceptual Hash', hashes.get('phash', 'N/A')],
    ]
    ht = Table(hash_data, colWidths=[4*cm, 13*cm])
    ht.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Courier'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(ht)
    story.append(Spacer(1, 0.5*cm))

    # URLs found
    findings = evidence.get('findings', [])
    if findings:
        story.append(Paragraph(f'UNAUTHORIZED LOCATIONS ({len(findings)} found)', styles['Heading2']))
        url_data = [['#', 'Platform', 'URL', 'Confidence', 'Type']]
        for i, f in enumerate(findings, 1):
            url_data.append([str(i), f.get('platform',''), f.get('url','')[:60], f.get('confidence',''), f.get('type','')])
        ut = Table(url_data, colWidths=[0.8*cm, 3*cm, 9*cm, 2*cm, 2*cm])
        ut.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#FEF2F2')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(ut)

    story.append(Spacer(1, 0.5*cm))

    # Legal sections
    story.append(Paragraph('APPLICABLE LEGAL PROVISIONS', styles['Heading2']))
    laws = [
        'Section 66E ITA 2000 — Violation of privacy',
        'Section 67 / 67A ITA 2000 — Publishing obscene material electronically',
        'Section 354C IPC — Voyeurism',
        'Section 509 IPC — Insulting modesty of a woman',
    ]
    for law in laws:
        story.append(Paragraph(f'• {law}', styles['Normal']))

    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph('DECLARATION', styles['Heading2']))
    story.append(Paragraph(
        'I hereby declare that the information provided in this complaint is true and correct to the best of my knowledge.',
        styles['Normal']
    ))
    story.append(Spacer(1, 1.5*cm))
    story.append(Paragraph('Signature: ___________________          Date: ' + datetime.now().strftime('%d/%m/%Y'), styles['Normal']))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph('Generated by ImageShield | cybercrime.gov.in | Helpline: 1930',
        ParagraphStyle('footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=TA_CENTER)))

    doc.build(story)
    return pdf_path


# ──────────────────────────────────────────────────────────
# HELPER: Send email to authority
# ──────────────────────────────────────────────────────────
def send_email(to_email, victim_email, victim_name, reference, crime_type, description, pdf_path):
    """Send complaint email with PDF attachment to authority"""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"SMTP not configured. Would send to: {to_email}")
        return False

    msg = MIMEMultipart()
    msg['From'] = SMTP_EMAIL
    msg['To'] = to_email
    msg['Subject'] = f'Cybercrime Complaint — {crime_type} — Ref: {reference}'

    body = f"""
Dear Cybercrime Cell,

Please find attached a formal cybercrime complaint filed via ImageShield.

Complaint Reference: {reference}
Complainant: {victim_name}
Contact Email: {victim_email}
Type of Crime: {crime_type}
Filed on: {datetime.now().strftime('%d %B %Y at %H:%M IST')}

Summary:
{description[:500]}...

The full complaint with digital evidence and image fingerprints is attached as a PDF.

Please acknowledge receipt and take necessary action as per the IT Act 2000.

Generated automatically by ImageShield (imageshield.app)
National Cybercrime Helpline: 1930
    """.strip()

    msg.attach(MIMEText(body, 'plain'))

    # Attach PDF
    if os.path.exists(pdf_path):
        with open(pdf_path, 'rb') as f:
            attachment = MIMEBase('application', 'octet-stream')
            attachment.set_payload(f.read())
            encoders.encode_base64(attachment)
            attachment.add_header('Content-Disposition', f'attachment; filename="{reference}.pdf"')
            msg.attach(attachment)

    # Send via Gmail SMTP
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)

    print(f"Email sent to: {to_email}")
    return True


def send_copy_to_victim(victim, reference, pdf_path):
    """Send a copy of the complaint to the victim"""
    return send_email(
        to_email=victim.get('email'),
        victim_email=victim.get('email'),
        victim_name=victim.get('name'),
        reference=reference,
        crime_type='Your complaint copy',
        description='This is your copy of the cybercrime complaint submitted on your behalf.',
        pdf_path=pdf_path
    )


# ──────────────────────────────────────────────────────────
# RUN
# ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("\n🛡️  ImageShield Backend running!")
    print("📡  API at: http://localhost:5000")
    print("🔍  Scan: POST http://localhost:5000/api/scan")
    print("📨  Complaint: POST http://localhost:5000/api/send-complaint\n")
    app.run(debug=True, port=5000)
