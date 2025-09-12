// Frontend service for crypto news aggregation
// Updated to use the fast-news endpoint for better performance

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

class NewsService {
  /**
   * Fetch all news (mixed crypto networks)
   */
  async getAllNews(options = {}) {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      sortBy = 'publishedAt',
      search = null
    } = options;

    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      category,
      sortBy
    });

    if (search) {
      params.append('search', search);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/fast-news?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching all news:', error);
      throw error;
    }
  }

  /**
   * Fetch client-specific news (your specific clients only)
   */
  async getClientNews(options = {}) {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      sortBy = 'publishedAt',
      search = null
    } = options;

    const params = new URLSearchParams({
      network: 'clients', // Special filter for client networks
      page: page.toString(),
      limit: limit.toString(),
      category,
      sortBy
    });

    if (search) {
      params.append('search', search);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/fast-news?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching client news:', error);
      throw error;
    }
  }

  /**
   * Fetch breaking news from all networks
   */
  async getBreakingNews(options = {}) {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      sortBy = 'publishedAt',
      search = null
    } = options;

    const params = new URLSearchParams({
      breaking: 'true',
      page: page.toString(),
      limit: limit.toString(),
      category,
      sortBy
    });

    if (search) {
      params.append('search', search);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/fast-news?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching breaking news:', error);
      throw error;
    }
  }

  /**
   * Fetch news by specific network
   */
  async getNewsByNetwork(network, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      sortBy = 'publishedAt',
      search = null
    } = options;

    const params = new URLSearchParams({
      network,
      page: page.toString(),
      limit: limit.toString(),
      category,
      sortBy
    });

    if (search) {
      params.append('search', search);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/fast-news?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${network} news:`, error);
      throw error;
    }
  }

  /**
   * Get cache statistics (for monitoring)
   */
  async getCacheStats() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/fast-news/cache/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      throw error;
    }
  }
}

export default new NewsService();
