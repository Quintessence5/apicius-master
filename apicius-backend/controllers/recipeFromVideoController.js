const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// __________-------------Save Recipe from Video Conversion-------------__________
const saveRecipeFromVideo = async (req, res) => {
    console.log("DEBUG: saveRecipeFromVideo function is running...");
    try {
        const { generatedRecipe, conversionId, userId = null } = req.body;

        if (!generatedRecipe || !generatedRecipe.title) {
            return res.status(400).json({ 
                success: false,
                message: "Valid generated recipe data is required" 
            });
        }

        console.log("Incoming generated recipe:", generatedRecipe);

        // Extract recipe data
        const { 
            title, 
            steps, 
            notes, 
            prep_time, 
            cook_time, 
            difficulty, 
            ingredients, 
            course_type, 
            meal_type, 
            cuisine_type, 
            servings,
            source 
        } = generatedRecipe;

        // Validate required fields
        if (!title || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid recipe data. Title and steps are required." 
            });
        }

        // Calculate total time
        const prep = parseInt(prep_time) || 0;
        const cook = parseInt(cook_time) || 0;
        const total_time = prep + cook;

        // Insert recipe
        const recipeResult = await pool.query(
            `INSERT INTO recipes (title, steps, notes, prep_time, cook_time, total_time, difficulty, 
            course_type, meal_type, cuisine_type, public, source, portions, image_path)
            VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
            RETURNING id`,
            [
                title, 
                JSON.stringify(steps), 
                notes || null, 
                prep || null, 
                cook || null, 
                total_time || null, 
                difficulty || 'Medium', 
                course_type || 'Main Course', 
                meal_type || 'Dinner', 
                cuisine_type || null, 
                false, // public = false by default
                source || 'video_conversion', 
                servings || null, 
                null // no image path for now
            ]
        );

        const recipeId = recipeResult.rows[0].id;
        console.log("✅ Recipe inserted with ID:", recipeId);

        // Insert ingredients
        if (ingredients && ingredients.length > 0) {
            console.log(`🔄 Inserting ${ingredients.length} ingredients...`);
            
            for (const ingredient of ingredients) {
                // Skip empty ingredients
                if (!ingredient.name || ingredient.name.trim().length === 0) continue;

                let ingredientId;

                // Check if ingredient exists in database
                const existingResult = await pool.query(
                    `SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1)`,
                    [ingredient.name]
                );

                if (existingResult.rows.length > 0) {
                    // Use existing ingredient
                    ingredientId = existingResult.rows[0].id;
                    console.log(`✅ Using existing ingredient: ${ingredient.name} (ID: ${ingredientId})`);
                } else {
                    // Create new ingredient
                    const newIngredientResult = await pool.query(
                        `INSERT INTO ingredients (name) VALUES ($1) RETURNING id`,
                        [ingredient.name]
                    );
                    ingredientId = newIngredientResult.rows[0].id;
                    console.log(`✅ Created new ingredient: ${ingredient.name} (ID: ${ingredientId})`);
                }

                // Insert recipe-ingredient link
                if (ingredientId) {
                    await pool.query(
                        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                        VALUES ($1, $2, $3, $4)`,
                        [
                            recipeId, 
                            ingredientId, 
                            ingredient.quantity || null, 
                            ingredient.unit || null
                        ]
                    );
                    console.log(`✅ Linked ingredient "${ingredient.name}" to recipe`);
                }
            }
        }

        // Update conversion status in transcript_conversions table
        if (conversionId) {
            await pool.query(
                `UPDATE transcript_conversions 
                SET recipe_status = 'saved', recipe_json = $1, updated_at = CURRENT_TIMESTAMP 
                WHERE id = $2`,
                [JSON.stringify(generatedRecipe), conversionId]
            );
            console.log(`✅ Updated conversion ${conversionId} status to 'saved'`);
        }

        res.status(201).json({ 
            success: true,
            message: "✅ Recipe saved successfully from video!",
            recipeId,
            conversionId,
            recipe: {
                id: recipeId,
                title,
                ingredientCount: ingredients ? ingredients.length : 0,
                stepCount: steps.length
            }
        });

    } catch (error) {
        console.error("❌ Error in saveRecipeFromVideo:", error);
        res.status(500).json({ 
            success: false,
            message: "Error saving recipe from video",
            error: error.message 
        });
    }
};

module.exports = {
    saveRecipeFromVideo
};