import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient'; // Add this import
import '../styles/cart.css';

const Cart = () => {
  const [cartData, setCartData] = useState({ grouped: [], merged: [] });
  const [viewMode, setViewMode] = useState('grouped');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await apiClient.get('/cart'); // Use apiClient instead of fetch
        setCartData(response.data);
      } catch (error) {
        console.error('Cart fetch error:', error);
        if (error.response?.status === 401) {
          navigate('/login');
        }
      }
    };
    
    fetchCart();
  }, [navigate]);

  const handleClearCart = async () => {
    try {
      await apiClient.post('/cart/clear');
      setCartData({ grouped: [], merged: [] });
      navigate('/');
    } catch (error) {
      console.error('Clear cart error:', error);
    }
  };

  const handleToggleAcquired = async (ingredientId, recipeId) => {
    try {
      await apiClient.patch('/cart/acquired', {
        ingredientId,
        recipeId,
        acquired: !cartData.merged.find(i => i.ingredient_id === ingredientId)?.acquired
      });
      
      setCartData(prev => ({
        ...prev,
        merged: prev.merged.map(item => 
          item.ingredient_id === ingredientId 
            ? { ...item, acquired: !item.acquired } 
            : item
        )
      }));
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const handleRemoveIngredient = async (ingredientId, recipeId) => {
    try {
      await apiClient.delete(`/cart/ingredients/${ingredientId}`, {
        data: { recipeId }
      });
      
      setCartData(prev => ({
        ...prev,
        merged: prev.merged.filter(item => item.ingredient_id !== ingredientId)
      }));
    } catch (error) {
      console.error('Remove error:', error);
    }
  };

  // Sort merged ingredients with acquired at bottom
  const sortedMerged = [...cartData.merged].sort((a, b) => 
    a.acquired === b.acquired ? 0 : a.acquired ? 1 : -1
  );


  return (
    <div className="cart-container">
      <div className="cart-header">
        <h2>Shopping Cart</h2>
        <div className="view-toggle">
          <button
            onClick={() => setViewMode('grouped')}
            className={viewMode === 'grouped' ? 'active' : ''}
          >
            Group by Recipe
          </button>
          <button
            onClick={() => setViewMode('merged')}
            className={viewMode === 'merged' ? 'active' : ''}
          >
            Merge Ingredients
          </button>
        </div>
      </div>

      {viewMode === 'grouped' ? (
        <div className="grouped-view">
          {cartData.grouped.map(recipe => (
            <div key={recipe.recipe_id} className="recipe-group">
              <h3 className="recipe-title">{recipe.recipe_title}</h3>
              <ul className="ingredient-list">
                {recipe.ingredients.map(ingredient => (
                  <li 
                    key={`${recipe.recipe_id}-${ingredient.ingredient_id}`}
                    className={`ingredient-item ${ingredient.acquired ? 'acquired' : ''}`}
                  >
                    <div className="ingredient-content">
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
                          className="checkbox-input"
                          checked={ingredient.acquired || false}
                          onChange={() => handleToggleAcquired(ingredient.ingredient_id, recipe.recipe_id)}
                        />
                      </label>
                      <span className="quantity-unit">
                        {ingredient.quantity}{ingredient.unit}
                      </span>
                      <span className="ingredient-name">{ingredient.name}</span>
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveIngredient(ingredient.ingredient_id, recipe.recipe_id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="merged-view">
          <ul className="ingredient-list">
            {sortedMerged.map(ingredient => (
              <li 
                key={ingredient.ingredient_id}
                className={`ingredient-item ${ingredient.acquired ? 'acquired' : ''}`}
              >
                <div className="ingredient-content">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      className="checkbox-input"
                      checked={ingredient.acquired || false}
                      onChange={() => handleToggleAcquired(ingredient.ingredient_id, null)}
                    />
                  </label>
                  <div className="ingredient-details">
                    <span className="quantity-unit">
                      {ingredient.total_quantity}{ingredient.unit}
                    </span>
                    <span className="ingredient-name">{ingredient.ingredient_name}</span>
                  </div>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveIngredient(ingredient.ingredient_id, null)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cart-actions">
        <button onClick={handleClearCart} className="clear-cart-btn">
          Clear Cart
        </button>
      </div>
    </div>
  );
};

export default Cart;