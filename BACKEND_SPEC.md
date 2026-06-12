# Selfie Station — Backend Specification

## Overview
A Node.js/Express API that manages temporary sessions for the Selfie Station kiosk. Each session lasts 5 minutes, stores one photo + multiple signatures, and auto-deletes after expiry.

## Stack (Recommended)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Redis (for fast in-memory session storage + auto-expiry) OR PostgreSQL + node-cron (for TTL)
- **QR Generation**: `qrcode` npm package
- **File Storage**: Multer (in-memory or disk)
- **CORS**: `cors` package

## Environment Variables
```
PORT=3000
NODE_ENV=production
SESSION_TTL=300  # seconds (5 min)
MAX_PHOTO_SIZE=10485760  # 10MB
MAX_SIGNATURES_PER_SESSION=50
FRONTEND_URL=https://yourbranding.com  # for CORS
```

## Database Schema

### Sessions Table (Redis) or PostgreSQL
```javascript
{
  id: "ABC123XYZ",              // unique session ID
  createdAt: 1718036400,        // unix timestamp
  expiresAt: 1718036700,        // createdAt + 300s
  photo: {
    data: "<base64 or blob>",   // uploaded photo
    mimeType: "image/jpeg"
  },
  signatures: [
    {
      id: "sig_001",
      d: "M 10 40 Q 30 10...",  // SVG path string
      width: 160,
      height: 60,
      handle: null,             // null if customer didn't provide name (now removed)
      createdAt: 1718036420
    },
    // ... more signatures
  ],
  status: "active" | "expired"
}
```

## API Endpoints

### 1. POST /api/session/start
**Creates a new session.**

Request:
```json
{}
```

Response (200 OK):
```json
{
  "sessionId": "ABC123XYZ",
  "expiresIn": 300,
  "qrCode": "data:image/png;base64,iVBORw0KGgo..."
}
```

The `qrCode` should encode: `https://yourbranding.com/guest?session=ABC123XYZ`

---

### 2. POST /api/session/:sessionId/upload
**Uploads the customer's photo to the session.**

Request:
```
Content-Type: multipart/form-data
{
  photo: <binary image file>
}
```

Response (200 OK):
```json
{
  "sessionId": "ABC123XYZ",
  "photoReceived": true,
  "expiresIn": 295
}
```

Error (404 / 400):
```json
{
  "error": "Session not found or expired"
}
```

---

### 3. POST /api/session/:sessionId/signature
**Adds a signature to the session.**

Request:
```json
{
  "d": "M 10 40 Q 30 10 50 35 T 110 30 Q 130 20 150 40",
  "width": 160,
  "height": 60,
  "handle": null
}
```

Response (200 OK):
```json
{
  "sessionId": "ABC123XYZ",
  "signatureId": "sig_001",
  "totalSignatures": 3,
  "expiresIn": 290
}
```

---

### 4. GET /api/session/:sessionId
**Retrieves current session state (photo + all signatures). Used by big screen for polling.**

Request:
```
GET /api/session/ABC123XYZ
```

Response (200 OK):
```json
{
  "sessionId": "ABC123XYZ",
  "status": "active",
  "expiresIn": 285,
  "photo": {
    "data": "data:image/jpeg;base64,/9j/4AAQSkZJ...",
    "mimeType": "image/jpeg"
  },
  "signatures": [
    {
      "id": "sig_001",
      "d": "M 10 40 Q 30 10...",
      "width": 160,
      "height": 60,
      "handle": null,
      "createdAt": 1718036420
    },
    ...
  ]
}
```

Error (404):
```json
{
  "error": "Session not found or expired"
}
```

---

### 5. DELETE /api/session/:sessionId
**Manually end a session (used by admin page). Auto-runs after 5 min.**

Request:
```
DELETE /api/session/ABC123XYZ
```

Response (200 OK):
```json
{
  "sessionId": "ABC123XYZ",
  "deleted": true
}
```

---

## Implementation Notes

### Session ID Generation
```javascript
const sessionId = Math.random().toString(36).slice(2, 11).toUpperCase();
// e.g., "ABC123XYZ"
```

### Photo Storage
- Store as base64 data URI in response (`data:image/jpeg;base64,...`)
- OR store on disk/S3 and return a signed URL
- Clear after 5 minutes

### Signature Storage
- Store SVG path string (`d` attribute) + dimensions
- No raster rendering needed
- Clear after 5 minutes

### Auto-Expiry
**Redis approach (simplest):**
```javascript
redisClient.setex(`session:${sessionId}`, 300, JSON.stringify(sessionData));
```

**PostgreSQL approach:**
```javascript
// On app startup:
cron.schedule('*/1 * * * *', async () => {
  await db.sessions.deleteWhere({ expiresAt: { $lt: Date.now() } });
});
```

### CORS
Allow requests from your frontend domain(s):
```javascript
app.use(cors({
  origin: [
    'https://yourbranding.com',
    'http://localhost:3000' // dev
  ],
  credentials: true
}));
```

### Rate Limiting (Optional)
Prevent abuse:
```javascript
const rateLimit = require('express-rate-limit');
app.use(rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 min
  max: 100  // 100 requests per min per IP
}));
```

## Deployment

### Heroku (Easiest)
1. Install Heroku CLI
2. `heroku create selfie-station-api`
3. `heroku addons:create heroku-redis:premium-0`
4. `git push heroku main`

### DigitalOcean / AWS / VPS
1. Deploy Node app to server
2. Set up Redis or PostgreSQL
3. Configure environment variables
4. Use PM2 or systemd to keep the app running
5. Set up nginx reverse proxy

## Testing
```bash
# Start session
curl -X POST http://localhost:3000/api/session/start

# Upload photo (use a real image)
curl -X POST -F "photo=@photo.jpg" \
  http://localhost:3000/api/session/ABC123XYZ/upload

# Add signature
curl -X POST http://localhost:3000/api/session/ABC123XYZ/signature \
  -H "Content-Type: application/json" \
  -d '{"d":"M 10 40 Q 30 10 50 35","width":100,"height":50,"handle":null}'

# Poll session state
curl http://localhost:3000/api/session/ABC123XYZ

# End session
curl -X DELETE http://localhost:3000/api/session/ABC123XYZ
```

## Error Handling
- **400**: Bad request (missing fields, invalid file type)
- **404**: Session not found or expired
- **413**: File too large
- **500**: Server error

All errors return:
```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```
