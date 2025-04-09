import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import AllIngredients from '../components/ingredients/AllIngredients';
import AddIngredient from '../components/ingredients/AddIngredient';
import IngredientSubmissions from '../components/ingredients/IngredientSubmissions';
import IngredientPrices from '../components/ingredients/IngredientPrices';
import IngredientImage from '../components/ingredients/IngredientImage';
import '../styles/ingredients.css';

const IngredientsPage = () => {
  return (
    <div className="ingredients-container">
        
      <div className="ingredients-nav">
        <NavLink to="/ingredients" end className={({ isActive }) => isActive ? 'active' : ''} >
          All Ingredients </NavLink>
        <NavLink to="/ingredients/add" className={({ isActive }) => isActive ? 'active' : ''} >
          Add Ingredients </NavLink>
        <NavLink to="/ingredients/prices" className={({ isActive }) => isActive ? 'active' : ''} >
          Ingredient Prices </NavLink>
        <NavLink to="/ingredients/images" className={({ isActive }) => isActive ? 'active' : ''}>
          Ingredient Images </NavLink>
        <NavLink to="/ingredients/submissions" className={({ isActive }) => isActive ? 'active' : ''} >
          Submissions </NavLink>
      </div>
      
      <div className="ingredients-content">
        <Routes>
          <Route index element={<AllIngredients />} />
          <Route path="add" element={<AddIngredient />} />
          <Route path="prices" element={<IngredientPrices />} />
          <Route path="images" element={<IngredientImage />} />
          <Route path="submissions" element={<IngredientSubmissions />} />
        </Routes>
      </div>
    </div>
  );
};

export default IngredientsPage;