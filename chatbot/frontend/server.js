/**
 * Express.js server for the chatbot frontend.
 */
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Configure multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Proxy API requests to the backend
app.post('/api/chat', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/chat`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying request to backend:', error.message);
    res.status(500).json({
      error: 'Failed to communicate with the backend service',
      details: error.message
    });
  }
});

app.post('/api/reset', async (req, res) => {
  try {
    const response = await axios.post(`${BACKEND_URL}/api/reset`);
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying reset request to backend:', error.message);
    res.status(500).json({
      error: 'Failed to communicate with the backend service',
      details: error.message
    });
  }
});

// Proxy streaming API requests to the backend
app.post('/api/stream', async (req, res) => {
  try {
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Make request to backend
    const response = await axios({
      method: 'post',
      url: `${BACKEND_URL}/api/stream`,
      data: req.body,
      responseType: 'stream'
    });

    // Pipe the response from the backend to the client
    response.data.pipe(res);

    // Handle errors
    response.data.on('error', (error) => {
      console.error('Error in stream:', error);
      res.end(JSON.stringify({ type: 'error', text: 'Stream error occurred' }));
    });
  } catch (error) {
    console.error('Error proxying streaming request to backend:', error.message);
    res.write(JSON.stringify({
      type: 'error',
      text: `Failed to communicate with the backend service: ${error.message}`
    }));
    res.end();
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Forward the file to the backend
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), req.file.originalname);

    const response = await axios.post(`${BACKEND_URL}/api/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
    });

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
        ...response.data
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).json({
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve specific HTML pages
app.get('/enhanced', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'enhanced.html'));
});

app.get('/basic', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the direct.html page as the default for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'direct.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
});
