import React from 'react';

const NewsCard = ({ article }) => {
  const {
    title,
    content,
    url,
    published_at,
    publishedAt,
    network,
    category,
    cover_image,
    image_url,
    is_breaking,
    viral_score,
    source
  } = article;

  const publishedDate = published_at || publishedAt;
  const imageUrl = cover_image || image_url;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getNetworkColor = (network) => {
    const colors = {
      'Bitcoin': '#F7931A',
      'Ethereum': '#627EEA',
      'Solana': '#9945FF',
      'Cardano': '#0033AD',
      'Hedera': '#0088CC',
      'XDC Network': '#1E88E5',
      'Algorand': '#000000',
      'Constellation': '#6B46C1',
      'Polygon': '#8247E5',
      'Avalanche': '#E84142',
      'XRP': '#23292F',
      'Dogecoin': '#C2A633',
      'BNB Chain': '#F3BA2F',
      'Uniswap': '#FF007A',
      'Chainlink': '#375BD2'
    };
    return colors[network] || '#6B7280';
  };

  const truncateText = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  return (
    <article className={`news-card ${is_breaking ? 'breaking' : ''}`} role="article">
      {/* Breaking Badge */}
      {is_breaking && (
        <div className="breaking-badge" role="status" aria-label="Breaking news">
          🔥 BREAKING
        </div>
      )}

      {/* Network Badge */}
      {network && (
        <div 
          className="network-badge"
          style={{ backgroundColor: getNetworkColor(network) }}
          role="img"
          aria-label={`${network} network`}
        >
          {network}
        </div>
      )}

      {/* Article Image */}
      {imageUrl && (
        <div className="news-image">
          <img 
            src={imageUrl} 
            alt={title}
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Article Content */}
      <div className="news-content">
        <header>
          <h3 className="news-title">
            <a 
              href={url} 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label={`Read full article: ${title}`}
            >
              {title}
            </a>
          </h3>
        </header>

        {content && (
          <p className="news-summary">
            {truncateText(content, 150)}
          </p>
        )}

        {/* Article Metadata */}
        <div className="news-meta" role="group" aria-label="Article metadata">
          {publishedDate && (
            <span className="publish-date" title="Publication date">
              📅 {formatDate(publishedDate)}
            </span>
          )}
          
          {source && (
            <span className="source" title="News source">
              📰 {source.length > 20 ? truncateText(source, 20) : source}
            </span>
          )}
          
          {category && category !== 'general' && (
            <span className="category" title="Article category">
              🏷️ {category}
            </span>
          )}

          {viral_score && (
            <span className="viral-score" title="Viral score">
              📈 Score: {viral_score}
            </span>
          )}
        </div>

        {/* Read More Link */}
        <footer className="news-footer">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="read-more"
            aria-label={`Read full article: ${title}`}
          >
            Read Full Article →
          </a>
        </footer>
      </div>
    </article>
  );
};

export default NewsCard;
