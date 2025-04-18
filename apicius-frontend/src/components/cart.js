import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import '../styles/cart.css';

const Cart = () => {
  const [cartData, setCartData] = useState({ grouped: [], merged: [] });
  const [viewMode, setViewMode] = useState('grouped');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const response = await apiClient.get('/cart');
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
    } catch (error) {
      console.error('Clear cart error:', error);
    }
  };

  const handleToggleAcquired = async (ingredientId, recipeId) => {
    try {
      // Determine current state based on view mode
      const currentAcquired = viewMode === 'grouped'
        ? cartData.grouped
            .find(r => r.recipe_id === recipeId)
            ?.ingredients?.find(i => i.ingredient_id === ingredientId)?.acquired
        : cartData.merged
            .find(i => i.ingredient_id === ingredientId)?.acquired;
  
      // Send proper recipeId (null for merged view)
      await apiClient.patch('/cart/acquired', {
        ingredientId,
        recipeId: viewMode === 'merged' ? null : recipeId,
        acquired: !currentAcquired
      });
  
      // Force complete refresh from server
      const response = await apiClient.get('/cart');
      setCartData({
        grouped: response.data.grouped,
        merged: response.data.merged.map(ing => ({
          ...ing,
          // Ensure proper boolean type
          acquired: !!ing.acquired
        }))
      });
  
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const handleRemoveIngredient = async (ingredientId, recipeId) => {
    try {
      // Send recipeId as query parameter
      await apiClient.delete(`/cart/ingredients/${ingredientId}`, {
        params: { recipeId } // Changed from data to params
      });
  
      // Optimistic update
      setCartData(prev => ({
        grouped: prev.grouped.map(recipe => ({
          ...recipe,
          ingredients: recipe.ingredients.filter(ing => 
            !(ing.ingredient_id === ingredientId && 
            (recipeId === undefined || recipe.recipe_id === recipeId))
          )
        })).filter(recipe => recipe.ingredients.length > 0),
        merged: prev.merged.filter(ing => 
          !(ing.ingredient_id === ingredientId && recipeId === undefined)
        )
      }));
  
      // Server sync
      const response = await apiClient.get('/cart');
      setCartData(response.data);
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
          <button className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')}>
            Group by Recipe
          </button>
          <button className={viewMode === 'merged' ? 'active' : ''} onClick={() => setViewMode('merged')}>
            Merge Ingredients
          </button>
        </div>
      </div>

      {cartData.grouped.length === 0 ? (
        <div className="empty-cart-message">
          <h3>Your cart is empty</h3>
          <p>Add recipes from your collection to get started!</p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="grouped-view">
          {cartData.grouped.map(recipe => (
            <div key={recipe.recipe_id} className="recipe-group">
              <h3 className="recipe-title">{recipe.recipe_title}</h3>
              <ul className="ingredient-list">
              {recipe.ingredients.sort((a, b) => a.acquired - b.acquired).map(ingredient => (
                <li 
                  key={`${recipe.recipe_id}-${ingredient.ingredient_id}`}
                  className={`ingredient-item ${ingredient.acquired ? 'acquired' : ''}`}>
                    <div className="ingredient-content">
                      <label className="checkbox-container">
                        <input
                          type="checkbox"
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
                      onClick={() => handleRemoveIngredient(ingredient.ingredient_id, recipe.recipe_id)}>
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
              <li key={ingredient.ingredient_id} 
                  className={`ingredient-item ${ingredient.acquired ? 'acquired' : ''}`}>
                <div className="ingredient-content">
                  <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={ingredient.acquired || false}
                    onChange={() => handleToggleAcquired(ingredient.ingredient_id, null)}
                  />
                  </label>
                  <div className="ingredient-details">
                  <span className="quantity-unit">
                    {ingredient.acquired ? 0 : ingredient.total_quantity}{ingredient.unit}
                  </span>
                    <span className="ingredient-name">{ingredient.ingredient_name}</span>
                  </div>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveIngredient(ingredient.ingredient_id, null)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cartData.grouped.length > 0 && (
        <div className="cart-actions">
          <button onClick={handleClearCart} className="clear-cart-btn">
            Clear Cart
          </button>
        </div>
      )}
    </div>
  );
};

export default Cart;