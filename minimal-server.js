const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Backend is running!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic news endpoint with static data
app.get('/api/news', (req, res) => {
  res.json({
    success: true,
    articles: [
      {
        id: '1',
        title: 'Test Article - Backend Deployed Successfully',
        summary: 'This is a test article to verify the backend is working.',
        network: 'Bitcoin',
        publishedAt: new Date().toISOString(),
        imageUrl: 'https://via.placeholder.com/400x225/f7931a/ffffff?text=Bitcoin+News'
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});