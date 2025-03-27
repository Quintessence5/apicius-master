import React, { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';

const SeasonalToday = () => {
  const [seasonalProduce, setSeasonalProduce] = useState({ fruits: [], vegetables: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSeasonalToday = async () => {
      try {
        const response = await apiClient.get('/seasonality/today');
        const categorized = {
          fruits: response.data.filter(item => item.category === 'Fruit'),
          vegetables: response.data.filter(item => item.category === 'Vegetable')
        };
        setSeasonalProduce(categorized);
      } catch (err) {
        setError('Failed to load seasonal data');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasonalToday();
  }, []);

  if (loading) return <div>Loading seasonal data...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="seasonal-today">
      <h2>Seasonal Produce for Today</h2>
      <div className="seasonal-grid">
        <div className="seasonal-category">
          <h3>Fruits</h3>
          <ul className="seasonal-list">
            {seasonalProduce.fruits.map(item => (
              <li key={item.ingredient_id} className="seasonal-item">
                <span>{item.name}</span>
                <span className="region-tag">{item.region_name}</span>
              </li>
            ))}
            {seasonalProduce.fruits.length === 0 && <li>No seasonal fruits today</li>}
          </ul>
        </div>

        <div className="seasonal-category">
          <h3>Vegetables</h3>
          <ul className="seasonal-list">
            {seasonalProduce.vegetables.map(item => (
              <li key={item.ingredient_id} className="seasonal-item">
                <span>{item.name}</span>
                <span className="region-tag">{item.region_name}</span>
              </li>
            ))}
            {seasonalProduce.vegetables.length === 0 && <li>No seasonal vegetables today</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SeasonalToday;