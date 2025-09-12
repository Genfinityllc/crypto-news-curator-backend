# Crypto News Curator Frontend

A React frontend for the Crypto News Curator backend, featuring ultra-fast news aggregation with intelligent caching.

## Features

- **Three News Views**: All News, Client News, Breaking News
- **Ultra-Fast Performance**: Uses `/api/fast-news` endpoint with 4-day caching
- **Real-time Updates**: Live news aggregation from 47+ crypto networks
- **Client-Specific Filtering**: Dedicated view for your client networks
- **Responsive Design**: Modern, mobile-friendly interface

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   Create `.env.local` file:
   ```
   REACT_APP_API_URL=http://localhost:3001
   REACT_APP_DEBUG=true
   REACT_APP_CACHE_REFRESH_INTERVAL=300000
   ```

3. **Start Development Server**
   ```bash
   npm start
   ```

## Vercel Deployment

1. **Connect to Vercel**
   - Import your GitHub repository to Vercel
   - Set build command: `npm run build`
   - Set output directory: `build`

2. **Set Environment Variables in Vercel**
   ```
   REACT_APP_API_URL=https://your-backend-url.railway.app
   REACT_APP_DEBUG=false
   REACT_APP_CACHE_REFRESH_INTERVAL=300000
   ```

3. **Deploy**
   - Vercel will automatically build and deploy
   - Your app will be available at `https://your-app.vercel.app`

## API Endpoints Used

- `/api/fast-news` - Main news endpoint with caching
- `/api/fast-news?network=clients` - Client-specific news
- `/api/fast-news?breaking=true` - Breaking news only
- `/api/fast-news/cache/stats` - Cache statistics

## Troubleshooting

### Build Failures
- Ensure all dependencies are installed: `npm install`
- Check environment variables are set correctly
- Verify backend API is accessible from frontend

### API Connection Issues
- Verify `REACT_APP_API_URL` points to your deployed backend
- Check CORS settings on backend
- Ensure backend is running and accessible

### Performance Issues
- The app uses cached data for ultra-fast loading
- Cache refreshes every 4 days automatically
- Use browser dev tools to monitor API calls

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Support

For issues or questions, check the backend logs and ensure all services are running properly.
