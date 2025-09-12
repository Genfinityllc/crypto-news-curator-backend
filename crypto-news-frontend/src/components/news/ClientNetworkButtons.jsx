import React, { useState, useEffect } from 'react';
import NewsService from '../../services/newsService';

const ClientNetworkButtons = ({ onNetworkSelect }) => {
  const [clientCounts, setClientCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClientCounts = async () => {
      try {
        setLoading(true);
        const response = await NewsService.getClientNetworkCounts();
        if (response.success) {
          setClientCounts(response.data);
        } else {
          setError('Failed to fetch client counts');
        }
      } catch (err) {
        console.error('Error fetching client counts:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchClientCounts();
  }, []);

  const clientNetworks = [
    { name: 'All Clients', key: 'clients' },
    { name: 'Hedera', key: 'Hedera' },
    { name: 'XDC Network', key: 'XDC Network' },
    { name: 'Algorand', key: 'Algorand' },
    { name: 'Constellation', key: 'Constellation' },
    { name: 'HashPack', key: 'HashPack' },
    { name: 'SWAP', key: 'SWAP' }
  ];

  if (loading) {
    return (
      <div className="client-network-buttons">
        <p>Loading client network counts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="client-network-buttons">
        <p>Error loading counts: {error}</p>
      </div>
    );
  }

  return (
    <div className="client-network-buttons">
      <h3>Filter by Client Network:</h3>
      <div className="network-buttons-grid">
        {clientNetworks.map((network) => (
          <button
            key={network.key}
            className="network-button"
            onClick={() => onNetworkSelect && onNetworkSelect(network.key)}
          >
            {network.name}
            {network.key !== 'clients' && (
              <span className="count-badge">
                ({clientCounts[network.key] || 0})
              </span>
            )}
            {network.key === 'clients' && (
              <span className="count-badge">
                ({Object.values(clientCounts).reduce((sum, count) => sum + count, 0)})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ClientNetworkButtons;
