import React from 'react';
import { Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom';
import AllIngredients from '../components/ingredients/AllIngredients';
import AddIngredient from '../components/ingredients/AddIngredient';
import IngredientSubmissions from '../components/ingredients/IngredientSubmissions';
import IngredientPrices from '../components/ingredients/IngredientPrices';
import '../styles/ingredients.css';

const IngredientsPage = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="ingredients-container">
      <div className="ingredients-nav">
        <NavLink 
          to="/ingredients"
          end
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          All Ingredients
        </NavLink>
        <NavLink 
          to="/ingredients/add"
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          Add Ingredients
        </NavLink>
        <NavLink 
          to="/ingredients/submissions"
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          Submissions
        </NavLink>
        <NavLink 
          to="/ingredients/prices"
          className={({ isActive }) => isActive ? 'active' : ''}
        >
          Ingredient Prices
        </NavLink>
      </div>
      
      <div className="ingredients-content">
        <Routes>
          <Route index element={<AllIngredients />} />
          <Route path="add" element={<AddIngredient />} />
          <Route path="submissions" element={<IngredientSubmissions />} />
          <Route path="prices" element={<IngredientPrices />} />
        </Routes>
      </div>
    </div>
  );
};

export default IngredientsPage;