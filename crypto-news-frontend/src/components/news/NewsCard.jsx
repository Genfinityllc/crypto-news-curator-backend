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
    viral_score
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
      'BNB Chain': '#F3BA2F'
    };
    return colors[network] || '#6B7280';
  };

  return (
    <div className={`news-card ${is_breaking ? 'breaking' : ''}`}>
      {/* Breaking Badge */}
      {is_breaking && (
        <div className="breaking-badge">
          🔥 BREAKING
        </div>
      )}

      {/* Network Badge */}
      {network && (
        <div 
          className="network-badge"
          style={{ backgroundColor: getNetworkColor(network) }}
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
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Article Content */}
      <div className="news-content">
        <h3 className="news-title">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
        </h3>

        {content && (
          <p className="news-summary">
            {content.length > 200 ? `${content.substring(0, 200)}...` : content}
          </p>
        )}

        {/* Article Metadata */}
        <div className="news-meta">
          {publishedDate && (
            <span className="publish-date">
              📅 {formatDate(publishedDate)}
            </span>
          )}
          
          {category && category !== 'general' && (
            <span className="category">
              🏷️ {category}
            </span>
          )}

          {viral_score && (
            <span className="viral-score">
              📈 Score: {viral_score}
            </span>
          )}
        </div>

        {/* Read More Link */}
        <div className="news-footer">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="read-more"
          >
            Read Full Article →
          </a>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
