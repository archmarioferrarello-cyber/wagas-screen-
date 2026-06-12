# Selfie Station — Production Package

Complete, production-ready system for a self-service photo + signature kiosk.

## Contents

```
production/
├── backend/
│   ├── server.js          (Express API server)
│   ├── package.json       (Node dependencies)
│   └── .env.example       (Environment template)
├── frontend/
│   ├── admin.html         (Control panel)
│   ├── guest.html         (Phone interface)
│   └── display.html       (Big screen — 9:16 vertical)
├── BACKEND_SPEC.md        (Full API specification)
└── SETUP_GUIDE.md         (Deployment & configuration)
```

## Quick Start

1. **Backend**: `cd backend && npm install && npm run dev`
2. **Frontend**: Update `API_BASE` in each HTML file to point to your backend
3. **Host**: Deploy backend to a server, frontend files to a web host
4. **QR**: Admin page auto-generates scannable QR codes per session
5. **Display**: Point a TV/screen to `display.html?session=XYZ` and it auto-syncs

## Key Features

✓ Real QR code generation (guest scans → phone page)  
✓ Photo upload via phone camera or gallery  
✓ Signature capture with finger/stylus  
✓ Live sync: signatures appear on big screen in real-time (500ms polling)  
✓ Drifting signature animation (matches original design)  
✓ Auto-expiry: sessions & photos deleted after 5 minutes  
✓ Zero data storage: everything in-memory (Redis) with TTL  
✓ Admin control panel: start/end sessions, view QR codes  
✓ Vertical display support (1080×1920)  

## Next Steps

1. Read `SETUP_GUIDE.md` for deployment instructions
2. Review `BACKEND_SPEC.md` for API details
3. Deploy backend (Heroku, AWS, DigitalOcean, etc.)
4. Host frontend pages on a domain (Netlify, Vercel, your own server)
5. Set up physical hardware (TV + device running display page)
6. Customize API_BASE URLs in frontend files for production

## Support

All code is self-contained and ready to run. No external services required beyond Redis (or PostgreSQL for persistence).
