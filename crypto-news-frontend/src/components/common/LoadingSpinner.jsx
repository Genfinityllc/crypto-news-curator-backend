import React from 'react';

const LoadingSpinner = ({ size = 'medium', text = 'Loading...', fullScreen = false }) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  const containerClass = fullScreen ? 'loading-spinner loading-spinner-fullscreen' : 'loading-spinner';

  return (
    <div className={containerClass} role="status" aria-label={text}>
      <div className={`spinner ${sizeClasses[size]}`} aria-hidden="true"></div>
      <p className="loading-text" aria-live="polite">{text}</p>
      <span className="sr-only">{text}</span>
    </div>
  );
};

export default LoadingSpinner;
