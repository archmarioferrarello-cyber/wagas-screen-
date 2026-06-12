# Selfie Station — Production Setup Guide

## Quick Start

This package contains everything you need to run a fully-functional Selfie Station kiosk system:
- **Backend API** — Node.js/Express server managing sessions
- **Guest Page** — Phone interface (upload photo + sign)
- **Display Page** — Big screen (vertical 9:16, polls for updates)
- **Admin Page** — Control panel (start/end sessions, view QR)

---

## 1. Backend Setup

### Prerequisites
- Node.js 18+ installed
- Redis or PostgreSQL (Redis is simpler for this use case)

### Install Dependencies
```bash
cd backend
npm install
```

### Environment Variables
Create a `.env` file:
```
PORT=3000
NODE_ENV=production
SESSION_TTL=300
MAX_PHOTO_SIZE=10485760
FRONTEND_URL=https://yourbranding.com
REDIS_URL=redis://localhost:6379
```

### Run Backend Locally
```bash
npm run dev
```

API will be available at `http://localhost:3000`.

### Run in Production
```bash
npm start
# or use PM2:
pm2 start server.js --name "selfie-station-api"
```

---

## 2. Frontend Setup

All three frontend pages (guest.html, display.html, admin.html) run as static HTML files.

### Configuration
Before deploying, update the `API_BASE` in each file:

**guest.html** (line ~65):
```javascript
const API_BASE = 'https://api.yourbranding.com'; // your backend URL
```

**display.html** (line ~64):
```javascript
const API_BASE = 'https://api.yourbranding.com';
```

**admin.html** (line ~43):
```javascript
const API_BASE = 'https://api.yourbranding.com';
```

### Host on Your Domain
```
https://yourbranding.com/
├── admin.html          (control panel)
├── guest.html          (phone interface)
└── display.html        (big screen)
```

---

## 3. QR Code Setup

The backend auto-generates QR codes pointing to the guest page:

**Current behavior:**
- QR encodes: `https://yourbranding.com/guest.html?session=ABC123XYZ`
- Guest scans → redirected to phone page with session ID in URL

If you want to print static QR codes for a demo:
```bash
# Install qrcode-terminal
npm install qrcode-terminal

# Generate QR:
node -e "
const qrcode = require('qrcode');
qrcode.toFile('qr.png', 'https://yourbranding.com/guest.html?session=DEMO001', {
  width: 300
}, (err) => { if (err) throw err; console.log('QR saved'); });
"
```

---

## 4. Deployment

### Option A: Heroku (Free tier available)
```bash
# Install Heroku CLI
# Login: heroku login

# Create app
heroku create selfie-station-api

# Add Redis
heroku addons:create heroku-redis:premium-0

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://yourbranding.com

# Deploy
git push heroku main
```

### Option B: DigitalOcean / AWS / VPS
1. SSH into server
2. Install Node.js, Redis
3. Clone repo / copy files
4. `npm install && npm start`
5. Set up nginx reverse proxy (port 3000 → domain)
6. Use PM2 to keep app running:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "selfie-station-api"
   pm2 startup
   pm2 save
   ```

### Option C: Docker
Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build & run:
```bash
docker build -t selfie-station .
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  selfie-station
```

---

## 5. Hardware Setup (TV/Display)

### Equipment Needed
- Vertical display (1080×1920 recommended)
- Device to run the display page (Raspberry Pi, laptop, etc.)
- Network connection (WiFi or ethernet)

### Install Display Page
1. Point a browser (kiosk mode) to: `https://yourbranding.com/admin.html`
2. Click "Start new session"
3. Use the admin panel to see live QR code and guest activity
4. Display page auto-refreshes every 500ms with new signatures

Alternatively, run display page standalone:
```html
<!-- In a browser on your TV: -->
https://yourbranding.com/display.html?session=ABC123XYZ
```

---

## 6. Testing

### Test the full flow:
1. Start backend: `npm run dev`
2. Open admin page: `http://localhost:3000/admin.html`
3. Click "Start new session"
4. On your phone, open the guest URL from the admin page
5. Upload a photo, draw a signature
6. Watch it appear in real-time on the display page

### Test endpoints with curl:
```bash
# Start session
curl -X POST http://localhost:3000/api/session/start

# Upload photo
curl -X POST -F "photo=@myimage.jpg" \
  http://localhost:3000/api/session/ABC123XYZ/upload

# Add signature
curl -X POST http://localhost:3000/api/session/ABC123XYZ/signature \
  -H "Content-Type: application/json" \
  -d '{"d":"M 10 40 Q 30 10 50 35","width":100,"height":50,"handle":null}'

# Poll session
curl http://localhost:3000/api/session/ABC123XYZ
```

---

## 7. Troubleshooting

### "Session not found"
- Session expired (5-min TTL)
- Backend not running
- Wrong session ID

### Photos not uploading
- Check file size (max 10MB)
- Check CORS headers on backend
- Check network connection

### Signatures not appearing on big screen
- Check display page is polling (should see requests every 500ms)
- Check backend is returning signature data
- Check signature SVG path is valid

### Backend won't start
- Check Redis is running: `redis-cli ping`
- Check port 3000 is available
- Check environment variables are set

---

## 8. Next Steps

- Deploy backend to production server
- Point frontend pages to production API URL
- Set up DNS/domain (yourbranding.com)
- Test on mobile + big screen
- Install on physical kiosk hardware

---

## Support

If you encounter issues:
1. Check backend logs: `pm2 logs selfie-station-api`
2. Check browser console (F12) for client-side errors
3. Test API endpoints directly with curl
4. Verify CORS is enabled on backend
5. Ensure Redis is running and accessible
