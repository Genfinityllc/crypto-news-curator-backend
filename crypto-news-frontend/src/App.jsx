import React, { useState, useEffect } from 'react';
import NewsTabs from './components/news/NewsTabs';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Prevent zoom on double tap (mobile)
  useEffect(() => {
    let lastTouchEnd = 0;
    const preventZoom = (e) => {
      const now = (new Date()).getTime();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    if (isMobile) {
      document.addEventListener('touchend', preventZoom, false);
    }

    return () => {
      if (isMobile) {
        document.removeEventListener('touchend', preventZoom, false);
      }
    };
  }, [isMobile]);

  return (
    <div className="App">
      {/* Online/Offline Indicator */}
      {!isOnline && (
        <div className="offline-indicator" role="alert" aria-live="assertive">
          <span>📡 You're offline. Content may be limited.</span>
        </div>
      )}

      <header className="App-header">
        <h1>🚀 Crypto News Curator</h1>
        <p>Real-time crypto news aggregation with 4-day caching for ultra-fast performance</p>
        {isMobile && (
          <div className="mobile-indicator">
            <span>📱 Mobile Optimized</span>
          </div>
        )}
      </header>
      
      <main className="App-main" role="main">
        <NewsTabs />
      </main>
      
      <footer className="App-footer">
        <p>Powered by Fast-News API with intelligent caching</p>
        <p className="tech-info">
          {isMobile ? '📱 Mobile View' : '💻 Desktop View'} | 
          {isOnline ? '🟢 Online' : '🔴 Offline'}
        </p>
      </footer>
      
      {/* Vercel Speed Insights */}
      <SpeedInsights />
    </div>
  );
}

export default App;
