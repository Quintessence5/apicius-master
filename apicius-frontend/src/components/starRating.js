import { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/interactions.css';

const StarRating = ({ recipeId }) => {
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);

  useEffect(() => {
    const fetchRating = async () => {
      try {
        const response = await axios.get(`/api/interactions/ratings/${recipeId}`);
        setAverageRating(Number(response.data.average) || 0);
        setTotalRatings(response.data.total || 0);
      } catch (error) {
        console.error('Error fetching rating:', error);
      }
    };
    fetchRating();
  }, [recipeId]);

  const handleRating = async (rating) => {
    const token = localStorage.getItem('accessToken'); 
    
    if (!token) {
      alert('Please log in to rate this recipe.');
      return;
    }
  
    try {
      await axios.post(`/api/interactions/ratings/${recipeId}`, { rating }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Re-fetch updated data
      const response = await axios.get(`/api/interactions/ratings/${recipeId}`);
      setAverageRating(Number(response.data.average) || 0);
      setTotalRatings(Number(response.data.total) || 0);
      setUserRating(rating);
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert(error.response?.data?.message || 'Failed to submit rating');
    }
  };

  return (
    <div className="rating-container">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`star ${star <= (userRating || averageRating) ? 'active' : ''}`}
            onClick={() => handleRating(star)}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>
        <div className="rating-info">
        ({(Number(averageRating)).toFixed(1)}/5 from {totalRatings} ratings)
        </div>
    </div>
  );
};

export default StarRating;