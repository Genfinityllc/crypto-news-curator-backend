# Crypto News Curator Backend

A comprehensive backend service for curating, aggregating, and managing cryptocurrency news from official sources and web searches. Built with Node.js, Express, and MongoDB.

## Features

- **News Scraping**: Automated scraping from official crypto network sources
- **AI Integration**: Article rewriting and SEO optimization using AI
- **Press Release Management**: Dedicated handling of official press releases
- **Breaking News Detection**: Real-time identification of high-impact news
- **Market Data Integration**: Cryptocurrency market information and trends
- **Automated Updates**: Cron jobs for regular content updates and maintenance
- **Image Generation**: AI-powered cover image creation for articles
- **User Management**: Authentication and user preferences
- **API Endpoints**: RESTful API for frontend integration

## Prerequisites

- Node.js 18.0.0 or higher
- MongoDB 4.4 or higher
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-news-curator-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/crypto-news-curator
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   
   # API Keys (add your actual keys)
   COINMARKETCAP_API_KEY=your-coinmarketcap-api-key
   CRYPTOPANIC_API_KEY=your-cryptopanic-api-key
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   
   # Logging
   LOG_LEVEL=info
   LOG_FILE_PATH=logs/app.log
   
   # News Sources
   NEWS_UPDATE_INTERVAL_MINUTES=30
   MAX_NEWS_ARTICLES_PER_SOURCE=50
   ```

4. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   
   # Or use MongoDB Atlas (cloud)
   # Update MONGODB_URI in .env
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### News Management

#### Get All News
```http
GET /api/news?page=1&limit=20&network=all&category=all&sortBy=publishedAt&search=bitcoin&breaking=false
```

#### Get Breaking News
```http
GET /api/news/breaking
```

#### Get Press Releases
```http
GET /api/news/press-releases
```

#### Scrape News from Sources
```http
POST /api/news/scrape
Content-Type: application/json

{
  "network": "Hedera HBAR",
  "source": "https://hedera.com/blog"
}
```

#### Web Search
```http
POST /api/news/web-search
Content-Type: application/json

{
  "query": "Bitcoin ETF approval",
  "network": "Bitcoin"
}
```

#### AI Article Rewrite
```http
POST /api/news/rewrite/:id
Authorization: Bearer <jwt-token>
```

#### SEO Optimization
```http
POST /api/news/seo-optimize/:id
Authorization: Bearer <jwt-token>
```

#### Generate Cover Image
```http
POST /api/news/generate-cover/:id
Authorization: Bearer <jwt-token>
```

#### Get Top Networks
```http
GET /api/news/top-networks
```

### Cryptocurrency Data

#### Market Data
```http
GET /api/crypto/market-data?limit=100&currency=USD
```

#### Network Information
```http
GET /api/crypto/network/:symbol
```

#### Top Networks
```http
GET /api/crypto/top-networks?metric=marketCap&limit=25
```

#### Price History
```http
GET /api/crypto/network/:symbol/price-history?days=30&currency=USD
```

#### Social Metrics
```http
GET /api/crypto/network/:symbol/social
```

#### Trending Networks
```http
GET /api/crypto/trending?timeframe=24h
```

#### Network Sentiment
```http
GET /api/crypto/network/:symbol/sentiment?days=7
```

#### Compare Networks
```http
POST /api/crypto/compare
Content-Type: application/json

{
  "networks": ["BTC", "ETH", "SOL"]
}
```

#### Global Market Overview
```http
GET /api/crypto/overview
```

### User Management

#### User Profile
```http
GET /api/users/profile
Authorization: Bearer <jwt-token>
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "username": "newusername",
  "email": "newemail@example.com",
  "preferences": {
    "favoriteNetworks": ["Bitcoin", "Ethereum"],
    "newsCategories": ["defi", "regulation"]
  }
}
```

#### Curated Articles
```http
GET /api/users/curated?page=1&limit=20
Authorization: Bearer <jwt-token>
```

#### Reading History
```http
GET /api/users/history?page=1&limit=20
Authorization: Bearer <jwt-token>
```

#### Add to Reading History
```http
POST /api/users/history/:articleId
Authorization: Bearer <jwt-token>
```

### Authentication

#### User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "username",
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

## Cron Jobs

The system runs several automated tasks:

- **News Score Updates**: Every hour
- **News Scraping**: Every 4 hours
- **Market Data Updates**: Every 15 minutes during market hours (9 AM - 5 PM, Mon-Fri)
- **Article Cleanup**: Weekly (Sundays at 2 AM)
- **Breaking News Checks**: Every 30 minutes
- **Trending Networks Update**: Daily at midnight

## Services

### News Service (`src/services/newsService.js`)
- Scrapes news from official network sources
- Performs web searches
- Manages press releases
- Identifies breaking news

### AI Service (`src/services/aiService.js`)
- Article rewriting using AI
- SEO optimization
- Sentiment analysis
- Tag generation

### Image Service (`src/services/imageService.js`)
- Cover image generation
- Social media optimized images
- Canvas-based image creation

### Crypto Service (`src/services/cryptoService.js`)
- Market data integration
- Network information
- Price history
- Social metrics

### Cron Service (`src/services/cronService.js`)
- Automated task scheduling
- Content updates
- System maintenance

## Database Models

### News Model
- Articles, press releases, and breaking news
- SEO metrics and engagement data
- Curation and moderation status
- AI-generated content

### User Model
- Authentication and profile information
- Reading history and preferences
- Curated content tracking

## Configuration

### Environment Variables
- `PORT`: Server port (default: 3000)
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT signing secret
- `COINMARKETCAP_API_KEY`: CoinMarketCap API key
- `CRYPTOPANIC_API_KEY`: CryptoPanic API key

### Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Configurable via environment variables

### Logging
- Winston-based logging
- Configurable log levels
- File and console output

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Production Deployment

1. **Set environment variables**
   ```bash
   NODE_ENV=production
   PORT=3000
   MONGODB_URI=your-production-mongodb-uri
   JWT_SECRET=your-production-jwt-secret
   ```

2. **Build the application**
   ```bash
   npm run build
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Use a process manager** (recommended)
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start dist/server.js --name "crypto-news-curator"
   ```

## API Integration Examples

### Frontend Integration
```javascript
// Fetch breaking news
const response = await fetch('/api/news/breaking');
const breakingNews = await response.json();

// Perform web search
const searchResponse = await fetch('/api/news/web-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'Bitcoin ETF' })
});
const searchResults = await searchResponse.json();

// Get market data
const marketResponse = await fetch('/api/crypto/market-data?limit=25');
const marketData = await marketResponse.json();
```

### Webhook Integration
```javascript
// Example webhook for breaking news
app.post('/webhooks/breaking-news', (req, res) => {
  const { title, network, content } = req.body;
  
  // Process breaking news
  console.log(`BREAKING: ${title} - ${network}`);
  
  // Send notifications, update dashboards, etc.
  
  res.status(200).json({ received: true });
});
```

## Monitoring and Health Checks

### Health Check Endpoint
```http
GET /health
```

Returns server status, uptime, and environment information.

### Cron Job Status
```javascript
const { getCronJobStatus } = require('./services/cronService');
const status = getCronJobStatus();
console.log(status);
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Verify MongoDB is running
   - Check connection string in `.env`
   - Ensure network access

2. **Rate Limiting**
   - Check rate limit configuration
   - Monitor request frequency
   - Adjust limits if needed

3. **Scraping Errors**
   - Verify source URLs are accessible
   - Check network connectivity
   - Review error logs

4. **AI Service Errors**
   - Verify API keys are set
   - Check service availability
   - Review error logs

### Logs
- Application logs: `logs/app.log`
- Error logs: Check console output
- MongoDB logs: Check MongoDB server logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

## Roadmap

- [ ] Real-time WebSocket updates
- [ ] Advanced AI content generation
- [ ] Social media integration
- [ ] Email newsletter system
- [ ] Mobile app API
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Content recommendation engine
