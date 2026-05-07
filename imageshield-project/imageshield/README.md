# 🛡️ ImageShield — Cybercrime Image Protection Tool

A free, privacy-first web tool to detect unauthorized use of your photos online
and automatically file cybercrime complaints.

---

## 📁 Project Structure

```
imageshield/
├── frontend/                  ← Open index.html in browser
│   ├── index.html             ← Home page
│   ├── css/style.css          ← All styling
│   ├── js/
│   │   ├── scan.js            ← Upload & scan logic
│   │   ├── results.js         ← Display results
│   │   └── complaint.js       ← Complaint form logic
│   └── pages/
│       ├── scan.html          ← Image upload page
│       ├── results.html       ← Scan results page
│       ├── complaint.html     ← Complaint form page
│       └── about.html         ← About & references
└── backend/                   ← Python Flask API
    ├── app.py                 ← Main server
    ├── config.py              ← Your API keys (KEEP PRIVATE)
    └── requirements.txt       ← Python packages
```

---

## 🚀 HOW TO RUN (Step by Step)

### STEP 1 — Open the Frontend (Works Immediately!)

1. Go into the `frontend` folder
2. Double-click `index.html` to open in your browser
3. The website works immediately — you can upload photos, see the scan animation, and use the complaint form

> ✅ The frontend works 100% without the backend (in demo mode)

---

### STEP 2 — Set Up the Backend (For Real Scanning)

**Install Python first:** https://python.org (get version 3.11+)

Open a terminal / command prompt in the `backend` folder and run:

```bash
# Install all required libraries
pip install -r requirements.txt

# Run the backend server
python app.py
```

You should see:
```
🛡️  ImageShield Backend running!
📡  API at: http://localhost:5000
```

---

### STEP 3 — Add Your API Keys (For Real Internet Search)

Edit `backend/config.py` and add:

#### A. Google Vision API (FREE — 1000 requests/month)
1. Go to: https://console.cloud.google.com
2. Create a new project → Enable "Cloud Vision API"
3. Go to "Credentials" → Create API Key
4. Paste into `GOOGLE_API_KEY`

#### B. SerpAPI (FREE — 100 searches/month)
1. Go to: https://serpapi.com
2. Sign up free → Copy your API key
3. Paste into `SERPAPI_KEY`

#### C. Gmail for Sending Emails
1. Go to: https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Search "App Passwords" → Create one for "Mail"
4. Paste your Gmail address into `SMTP_EMAIL`
5. Paste the 16-character app password into `SMTP_PASSWORD`

---

### STEP 4 — Deploy Online (Free)

#### Frontend → Netlify (Free)
1. Go to https://netlify.com → Sign up free
2. Drag and drop your `frontend` folder onto Netlify
3. Your website gets a free URL like `imageshield.netlify.app`

#### Backend → Render.com (Free)
1. Go to https://render.com → Sign up free
2. Connect your GitHub repository
3. Create a "Web Service" → select your `backend` folder
4. Set environment variables (your API keys) in Render's dashboard
5. Render gives you a URL like `imageshield-api.onrender.com`

#### Connect Frontend to Backend
In `js/complaint.js`, change:
```javascript
fetch('http://localhost:5000/api/send-complaint', ...
```
to:
```javascript
fetch('https://YOUR-APP.onrender.com/api/send-complaint', ...
```

---

## 🔒 Security Notes

- NEVER upload `config.py` to GitHub — it has your passwords
- Add `config.py` to `.gitignore`
- Your images are deleted immediately after scanning
- No user data is stored

---

## ⚖️ Legal Information (India)

This tool references:
- **Section 66E ITA 2000** — Privacy violation
- **Section 67/67A ITA 2000** — Obscene material online
- **Section 354C IPC** — Voyeurism
- **Section 509 IPC** — Insulting a woman's modesty
- **POCSO Act 2012** — If victim is a minor

**Cybercrime Helpline:** 1930
**Online Portal:** https://cybercrime.gov.in

---

## 📚 Research References

1. A Survey on Reverse Image Search — https://ieeexplore.ieee.org/document/8480993
2. Image-Based Sexual Abuse: A Global Overview — https://researchgate.net/publication/337360191
3. Image Detection Using CNN — https://ieeexplore.ieee.org/document/8597204
4. Detection of AI-Created Images — https://pmc.ncbi.nlm.nih.gov/articles/PMC10674908/
