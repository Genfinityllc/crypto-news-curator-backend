# 🚀 Crypto News Curator Backend - Complete Setup Guide

## ✅ **Current Status: READY FOR PRODUCTION**

Your backend is now fully functional with:
- ✅ Real RSS feed integration (40+ articles from top crypto news sources)
- ✅ Live CoinGecko market data
- ✅ Supabase database integration
- ✅ AI-powered content enhancement
- ✅ Automated cron jobs
- ✅ Comprehensive API endpoints

## 🛠 **Step-by-Step Setup**

### **1. Environment Configuration**

Create your `.env` file:
```bash
cp env.example .env
```

Edit `.env` with your credentials:
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Supabase Configuration (REQUIRED)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Optional API Keys (for enhanced features)
COINMARKETCAP_API_KEY=your-coinmarketcap-api-key
CRYPTOPANIC_API_KEY=your-cryptopanic-api-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=logs/app.log
```

### **2. Supabase Setup**

1. **Create Supabase Project:**
   - Visit [supabase.com](https://supabase.com)
   - Create new project
   - Note your project URL and anon key

2. **Run Database Schema:**
   - Copy the SQL from `supabase-schema.sql`
   - Paste in Supabase SQL Editor
   - Execute the schema

3. **Test Connection:**
   ```bash
   node test-integration.js
   ```

### **3. Install Dependencies**

```bash
npm install
```

### **4. Start the Application**

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

**Using Startup Script:**
```bash
./start.sh
```

## 🧪 **Testing Your Setup**

### **Run Integration Tests:**
```bash
node test-integration.js
```

### **Test API Endpoints:**

1. **Fetch Real News:**
   ```bash
   curl -X POST http://localhost:3000/api/news/fetch-real-news \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **Get Market Data:**
   ```bash
   curl "http://localhost:3000/api/crypto/market-data?limit=10"
   ```

3. **Get Breaking News:**
   ```bash
   curl "http://localhost:3000/api/news/breaking"
   ```

4. **Get Press Releases:**
   ```bash
   curl "http://localhost:3000/api/news/press-releases"
   ```

## 🔗 **Frontend Integration**

Your React frontend can now connect to these endpoints:

```javascript
// Fetch breaking news
const breakingNews = await fetch('/api/news/breaking').then(r => r.json());

// Get market data
const marketData = await fetch('/api/crypto/market-data?limit=25').then(r => r.json());

// Perform web search
const searchResults = await fetch('/api/news/web-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'Bitcoin ETF' })
}).then(r => r.json());

// Fetch real news from RSS feeds
const realNews = await fetch('/api/news/fetch-real-news', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({})
}).then(r => r.json());
```

## 📊 **Available Data Sources**

### **RSS Feeds (Real-time):**
- CoinDesk
- Cointelegraph
- Decrypt
- CryptoSlate
- Bitcoin Magazine

### **Market Data (Live):**
- CoinGecko API (real-time prices)
- Top 250+ cryptocurrencies
- Market cap, volume, price changes

### **AI Features:**
- Article rewriting
- SEO optimization
- Sentiment analysis
- Tag generation
- Cover image generation

## 🔄 **Automated Features**

### **Cron Jobs:**
- **News Scraping**: Every 4 hours
- **Score Updates**: Every hour
- **Market Data**: Every 15 minutes (market hours)
- **Breaking News**: Every 30 minutes
- **Cleanup**: Weekly

### **Real-time Updates:**
- RSS feed monitoring
- Market data streaming
- Breaking news detection
- Engagement tracking

## 🚀 **Production Deployment**

### **1. Environment Setup:**
```bash
NODE_ENV=production
PORT=3000
SUPABASE_URL=your-production-supabase-url
SUPABASE_ANON_KEY=your-production-supabase-key
```

### **2. Process Management:**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/server.js --name "crypto-news-curator"

# Monitor
pm2 monit

# Logs
pm2 logs crypto-news-curator
```

### **3. Reverse Proxy (Nginx):**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📈 **Monitoring & Analytics**

### **Health Check:**
```bash
curl http://localhost:3000/health
```

### **API Status:**
```bash
curl http://localhost:3000/api/news
```

### **Logs:**
```bash
tail -f logs/app.log
```

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **Supabase Connection Failed:**
   - Verify credentials in `.env`
   - Check Supabase project status
   - Ensure schema is deployed

2. **RSS Feeds Not Working:**
   - Check internet connectivity
   - Verify feed URLs are accessible
   - Review error logs

3. **Market Data Errors:**
   - CoinGecko API rate limits
   - Network connectivity issues
   - Fallback to mock data

4. **Server Won't Start:**
   - Check port availability
   - Verify Node.js version (18+)
   - Review error logs

### **Debug Mode:**
```bash
LOG_LEVEL=debug npm run dev
```

## 📚 **API Documentation**

### **News Endpoints:**
- `GET /api/news` - Get all articles
- `GET /api/news/breaking` - Breaking news
- `GET /api/news/press-releases` - Press releases
- `POST /api/news/fetch-real-news` - Fetch RSS feeds
- `POST /api/news/web-search` - Web search
- `POST /api/news/rewrite/:id` - AI rewrite
- `POST /api/news/seo-optimize/:id` - SEO optimization

### **Crypto Endpoints:**
- `GET /api/crypto/market-data` - Market data
- `GET /api/crypto/network/:symbol` - Network info
- `GET /api/crypto/top-networks` - Top networks
- `GET /api/crypto/top-cryptos-dropdown` - Top 50 cryptocurrencies for dropdown (NEW!)
- `GET /api/crypto/trending` - Trending networks

### **User Endpoints:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users/profile` - User profile
- `PUT /api/users/profile` - Update profile

## 🎯 **Next Steps**

1. **Set up Supabase** with your credentials
2. **Test all endpoints** with the integration script
3. **Connect your frontend** to the API
4. **Deploy to production** using PM2 or similar
5. **Monitor performance** and logs
6. **Set up alerts** for breaking news

## 📞 **Support**

- Check logs: `tail -f logs/app.log`
- Run tests: `node test-integration.js`
- Review API responses for error details
- Monitor Supabase dashboard for database issues

---

**🎉 Your Crypto News Curator Backend is ready to power your application!**
