import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import '../styles/cart.css';

const Cart = () => {
  const [cartData, setCartData] = useState({ grouped: [], merged: [] });
  const [viewMode, setViewMode] = useState('merged');
  const [showDeleted, setShowDeleted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCart = async () => {
        try {
          const response = await apiClient.get('/cart', {
            params: { _: new Date().getTime() }
          });
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
      await apiClient.delete(`/cart/ingredients/${ingredientId}`, {
        params: { recipeId } 
      });
  
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
  
      const response = await apiClient.get('/cart');
      setCartData(response.data);
    } catch (error) {
      console.error('Remove error:', error);
    }
  };

  const handleRestoreIngredient = async (ingredientId) => {
    try {
      await apiClient.patch(`/cart/ingredients/${ingredientId}/restore`);
      
      // Refresh cart data
      const response = await apiClient.get('/cart');
      setCartData(response.data);
    } catch (error) {
      console.error('Restore error:', error);
    }
  };

  const sortedMerged = [...cartData.merged].sort((a, b) => 
    a.acquired === b.acquired ? 0 : a.acquired ? 1 : -1
  );


  return (
    <div className="cart-container">
      <div className="cart-header">
        <h2>Shopping Cart</h2>
        <div className="view-toggle">
        <button className={viewMode === 'merged' ? 'active' : ''} onClick={() => setViewMode('merged')}>
            Merge Ingredients
          </button>
          <button className={viewMode === 'grouped' ? 'active' : ''} onClick={() => setViewMode('grouped')}>
            Group by Recipe
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
          {sortedMerged
      .filter(ing => !ing.deleted)
      .map(ingredient => (
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
                    {ingredient.total_quantity > 0 ? `${ingredient.total_quantity}${ingredient.unit}` : ' '}
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
            {showDeleted && sortedMerged
      .filter(ing => ing.deleted)
      .map(ingredient => (
        <li key={`deleted-${ingredient.ingredient_id}`} 
            className="ingredient-item deleted">
          <div className="ingredient-content">
            <span className="quantity-unit">
              {ingredient.total_quantity}{ingredient.unit}
            </span>
            <span className="ingredient-name">{ingredient.ingredient_name}</span>
          </div>
          <button
            className="restore-btn"
            onClick={() => handleRestoreIngredient(ingredient.ingredient_id)}>
            ✔️
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
          <button 
              className={`show-deleted-btn ${showDeleted ? 'active' : ''}`}
              onClick={() => setShowDeleted(!showDeleted)}
            >
              Show Deleted
            </button>
        </div>
      )}
    </div>
  );
};

export default Cart;