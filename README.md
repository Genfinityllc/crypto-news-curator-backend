# 🚀 Crypto News Curator Backend

A high-performance cryptocurrency news aggregation system with intelligent filtering and real-time RSS processing.

## 📊 System Status

- **Database**: 4,875+ articles with automatic purging (4-day retention)
- **API Performance**: Fast response with optimized caching
- **Sources**: 20+ RSS feeds + Google News integration
- **Filtering**: Advanced WSJ blocking and crypto content validation

## 🗂️ Project Structure

```
/
├── src/                    # Core application code
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic
│   ├── config/             # Configuration files
│   ├── middleware/         # Express middleware
│   └── utils/              # Utility functions
├── utils/                  # Development utilities
│   ├── debug/              # Debug and test scripts
│   └── migrations/         # Database migrations
├── docs/                   # Documentation
└── package.json            # Dependencies
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start
```

## 🔧 Environment Variables

Create a `.env` file with:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
NODE_ENV=production
PORT=3001
```

## 📊 API Endpoints

### Main Endpoints
- `GET /api/fast-news` - Fast cached news with pagination
- `GET /api/fast-news?network=clients` - Client-specific news
- `GET /api/fast-news?category=breaking` - Breaking news

### Admin Endpoints  
- `POST /api/cron-manual/*` - Manual cleanup operations
- `GET /api/fast-news/cache/stats` - Cache statistics

## 🛡️ Features

### Content Filtering
- **WSJ Blocking**: Comprehensive Wall Street Journal article filtering
- **Crypto Validation**: Multi-layer crypto content validation
- **Source Resolution**: Google News URL resolution to original sources

### Performance
- **Smart Caching**: 4-layer caching system
- **Image Optimization**: Automatic image resizing and optimization
- **Database Purging**: Automatic old article cleanup

### Networks Supported
- Hedera (HBAR)
- XDC Network
- Algorand
- Constellation (DAG)
- HashPack
- All major cryptocurrencies

## 🔄 Automated Processes

- **RSS Fetching**: Continuous RSS feed monitoring
- **Article Purging**: 4-day retention with 500-article limit
- **Image Enhancement**: Automatic cover image generation
- **Cache Management**: Smart cache invalidation

## 📈 Monitoring

- Health check: `GET /health`
- Cache stats: `GET /api/fast-news/cache/stats`
- Database counts: `utils/debug/check-db-count.js`

## 🛠️ Development

### Debug Tools (in utils/debug/)
- `check-db-count.js` - Database article count
- `debug-get-articles.js` - Test article retrieval
- `test-rss-filtering.js` - Test RSS filtering logic

### Migration Tools (in utils/migrations/)
- Database migration scripts
- SQL schema files

## 📚 Documentation

See `/docs` folder for detailed guides:
- Card image generation guide
- Firebase setup instructions
- Frontend integration guide
- Google News enhancement summary

## 🚨 Troubleshooting

### Common Issues
1. **API Timeout**: Check image enhancement process
2. **No Articles**: Verify RSS feeds and database connection
3. **Cache Issues**: Clear cache via `/api/fast-news/cache/clear`

### Performance Tips
- Use cached endpoints when possible
- Monitor database article count
- Check RSS feed health regularly

## 📞 Support

For issues or questions, check the troubleshooting guide in `/docs` or review the system cleanup report.