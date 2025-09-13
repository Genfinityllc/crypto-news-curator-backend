import React, { useState, useEffect } from 'react';
import NewsService from '../../services/newsService';
import NewsCard from './NewsCard';
import LoadingSpinner from '../common/LoadingSpinner';
import ClientNetworkButtons from './ClientNetworkButtons';
import './ClientNetworkButtons.css';

const NewsTabs = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [cacheInfo, setCacheInfo] = useState(null);

  // Fetch news based on active tab
  const fetchNews = async (tab, page = 1) => {
    setLoading(true);
    setError(null);

    try {
      let response;
      const options = { page, limit: 20 };

      switch (tab) {
        case 'clients':
          response = await NewsService.getClientNews(options);
          break;
        case 'breaking':
          response = await NewsService.getBreakingNews(options);
          break;
        case 'all':
        default:
          response = await NewsService.getAllNews(options);
          break;
      }

      if (response.success) {
        setNews(response.data);
        setPagination(response.pagination);
        setCacheInfo({
          cached: response.cached,
          timestamp: response.timestamp
        });
      } else {
        setError('Failed to fetch news');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching news:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cache stats
  const fetchCacheStats = async () => {
    try {
      const stats = await NewsService.getCacheStats();
      console.log('Cache Stats:', stats.data);
    } catch (err) {
      console.error('Error fetching cache stats:', err);
    }
  };

  // Load initial news and cache stats
  useEffect(() => {
    fetchNews(activeTab);
    fetchCacheStats();
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Scroll to top when changing tabs on mobile
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (newPage) => {
    fetchNews(activeTab, newPage);
    // Scroll to top when changing pages on mobile
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNetworkSelect = (network) => {
    console.log('Selected network:', network);
    // Scroll to news grid when selecting network on mobile
    if (window.innerWidth <= 768) {
      const newsGrid = document.querySelector('.news-grid');
      if (newsGrid) {
        newsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const getTabLabel = (tab) => {
    switch (tab) {
      case 'clients':
        return 'Client News';
      case 'breaking':
        return 'Breaking News';
      case 'all':
      default:
        return 'All News';
    }
  };

  const getTabDescription = (tab) => {
    switch (tab) {
      case 'clients':
        return 'News from your specific client networks (Hedera, XDC, Algorand, Constellation, etc.)';
      case 'breaking':
        return 'Breaking crypto news from all networks';
      case 'all':
      default:
        return 'Latest crypto news from all networks';
    }
  };

  return (
    <div className="news-tabs">
      {/* Tab Navigation */}
      <nav className="tab-navigation" role="tablist" aria-label="News categories">
        <button
          className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
          role="tab"
          aria-selected={activeTab === 'all'}
          aria-controls="all-news-panel"
          id="all-news-tab"
        >
          All News
        </button>
        <button
          className={`tab-button ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => handleTabChange('clients')}
          role="tab"
          aria-selected={activeTab === 'clients'}
          aria-controls="client-news-panel"
          id="client-news-tab"
        >
          Client News
        </button>
        <button
          className={`tab-button ${activeTab === 'breaking' ? 'active' : ''}`}
          onClick={() => handleTabChange('breaking')}
          role="tab"
          aria-selected={activeTab === 'breaking'}
          aria-controls="breaking-news-panel"
          id="breaking-news-tab"
        >
          Breaking News
        </button>
      </nav>

      {/* Tab Description */}
      <div className="tab-description">
        <p>{getTabDescription(activeTab)}</p>
        {cacheInfo && (
          <div className="cache-info">
            <span className={`cache-status ${cacheInfo.cached ? 'cached' : 'fresh'}`}>
              {cacheInfo.cached ? '⚡ Cached' : '🔄 Fresh'}
            </span>
            <span className="cache-timestamp">
              {new Date(cacheInfo.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Client Network Buttons - Show only when on Client News tab */}
      {activeTab === 'clients' && (
        <ClientNetworkButtons onNetworkSelect={handleNetworkSelect} />
      )}

      {/* Loading State */}
      {loading && <LoadingSpinner />}

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={() => fetchNews(activeTab)}>Retry</button>
        </div>
      )}

      {/* News Grid */}
      {!loading && !error && (
        <div 
          className="news-grid" 
          role="tabpanel" 
          id={`${activeTab}-news-panel`}
          aria-labelledby={`${activeTab}-news-tab`}
          aria-live="polite"
        >
          {news.length === 0 ? (
            <div className="no-articles">
              <p>No articles found for this category.</p>
            </div>
          ) : (
            news.map((article, index) => (
              <NewsCard key={`${article.id || article.url}-${index}`} article={article} />
            ))
          )}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total > 1 && (
        <div className="pagination">
          <button
            disabled={!pagination.hasPrev}
            onClick={() => handlePageChange(pagination.current - 1)}
          >
            Previous
          </button>
          <span>
            Page {pagination.current} of {pagination.total}
          </span>
          <button
            disabled={!pagination.hasNext}
            onClick={() => handlePageChange(pagination.current + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Performance Info */}
      <div className="performance-info">
        <p>
          Total Articles: {pagination.totalCount || 0} | 
          Cached: {cacheInfo?.cached ? 'Yes' : 'No'} | 
          Endpoint: /api/fast-news
        </p>
      </div>
    </div>
  );
};

export default NewsTabs;
