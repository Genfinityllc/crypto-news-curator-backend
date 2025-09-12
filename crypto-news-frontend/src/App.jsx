import React from 'react';
import NewsTabs from './components/news/NewsTabs';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';

function App() {
  // Force redeploy - build fix applied
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Crypto News Curator</h1>
        <p>Real-time crypto news aggregation with 4-day caching for ultra-fast performance</p>
      </header>
      
      <main className="App-main">
        <NewsTabs />
      </main>
      
      <footer className="App-footer">
        <p>Powered by Fast-News API with intelligent caching</p>
      </footer>
      
      {/* Vercel Speed Insights */}
      <SpeedInsights />
    </div>
  );
}

export default App;
