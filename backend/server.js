const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const redis = require('redis');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TTL = parseInt(process.env.SESSION_TTL) || 300;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect().catch(console.error);

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_PHOTO_SIZE) || 10 * 1024 * 1024 }
});

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../frontend')));
// Root route - serve display.html
app.get('/', (req, res) => {
res.sendFile(path.resolve(__dirname, '../frontend/display.html')));

// ===== HELPERS =====

const getSession = async (sessionId) => {
  const data = await redisClient.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
};

const saveSession = async (sessionId, sessionData) => {
  await redisClient.setEx(
    `session:${sessionId}`,
    SESSION_TTL,
    JSON.stringify(sessionData)
  );
};

const deleteSession = async (sessionId) => {
  await redisClient.del(`session:${sessionId}`);
};

// ===== API ENDPOINTS =====

// POST /api/session/start
app.post('/api/session/start', async (req, res) => {
  try {
    const sessionId = uuidv4().slice(0, 8).toUpperCase();
    const guestUrl = `${FRONTEND_URL}/guest.html?session=${sessionId}`;
    const qrCode = await QRCode.toDataURL(guestUrl);

    const sessionData = {
      id: sessionId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL * 1000,
      photo: null,
      signatures: [],
      status: 'active'
    };

    await saveSession(sessionId, sessionData);

    res.json({
      sessionId,
      expiresIn: SESSION_TTL,
      qrCode
    });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// POST /api/session/:sessionId/upload
app.post('/api/session/:sessionId/upload', upload.single('photo'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No photo provided' });

    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired' });

    const photoData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    session.photo = {
      data: photoData,
      mimeType: req.file.mimetype
    };

    const expiresIn = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
    await saveSession(sessionId, session);

    res.json({
      sessionId,
      photoReceived: true,
      expiresIn
    });
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /api/session/:sessionId/signature
app.post('/api/session/:sessionId/signature', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { d, width, height, handle } = req.body;

    if (!d || !width || !height) {
      return res.status(400).json({ error: 'Missing signature data' });
    }

    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired' });

    const signature = {
      id: `sig_${uuidv4().slice(0, 8)}`,
      d,
      width,
      height,
      handle: handle || null,
      createdAt: Date.now()
    };

    session.signatures.push(signature);
    const expiresIn = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000));
    await saveSession(sessionId, session);

    res.json({
      sessionId,
      signatureId: signature.id,
      totalSignatures: session.signatures.length,
      expiresIn
    });
  } catch (err) {
    console.error('Error adding signature:', err);
    res.status(500).json({ error: 'Failed to add signature' });
  }
});

// GET /api/session/:sessionId
app.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    const expiresIn = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));

    res.json({
      sessionId,
      status: expiresIn > 0 ? 'active' : 'expired',
      expiresIn,
      photo: session.photo,
      signatures: session.signatures
    });
  } catch (err) {
    console.error('Error retrieving session:', err);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

// DELETE /api/session/:sessionId
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await deleteSession(sessionId);
    res.json({ sessionId, deleted: true });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Selfie Station API running on http://localhost:${PORT}`);
  console.log(`✓ Frontend URL: ${FRONTEND_URL}`);
  console.log(`✓ Session TTL: ${SESSION_TTL}s`);
});
