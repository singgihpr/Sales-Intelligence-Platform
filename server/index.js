import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { handler as coreHandler } from '../netlify/functions/lib/core.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS for all origins (same as Netlify function behavior)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API route — handle both JSON and multipart
app.use('/api', express.text({ type: 'application/json', limit: '1mb' }));
app.use('/api', express.raw({ type: 'multipart/form-data', limit: '10mb' }));

app.all('/api', async (req, res) => {
  const normalizedEvent = {
    method: req.method,
    query: req.query,
    headers: req.headers,
    body: req.body,
    isBase64Encoded: false
  };

  try {
    const result = await coreHandler(normalizedEvent);
    res.status(result.statusCode);
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }
    res.send(result.body);
  } catch (err) {
    console.error('API error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
