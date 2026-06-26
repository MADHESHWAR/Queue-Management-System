const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');

// Connect to Database
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/tokens', require('./routes/tokenRoutes'));

// Fallback route for frontend single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error details: ${err.message}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your web browser`);
});
