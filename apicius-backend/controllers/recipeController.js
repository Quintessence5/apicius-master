const pool = require('../config/db'); // Ensure this points to your database connection file

// Add a new recipe
exports.addRecipe = async (req, res) => {
    const client = await pool.connect(); // Open a new client connection for the transaction
    try {
        const { name, instructions, ingredients } = req.body;

        // Validate required fields
        if (!name || !instructions || !ingredients || !Array.isArray(ingredients)) {
            return res.status(400).json({ message: 'Please provide name, instructions, and a list of ingredients' });
        }

        await client.query('BEGIN'); // Start a transaction

        // Insert the new recipe into the recipes table
        const recipeResult = await client.query(
            'INSERT INTO recipes (name, instructions) VALUES ($1, $2) RETURNING *',
            [name, instructions]
        );
        const recipeId = recipeResult.rows[0].id;

        // Insert each ingredient into recipe_ingredients, linking to the recipe
        for (const ingredient of ingredients) {
            const { id, quantity } = ingredient;

            // Ensure ingredient fields are present
            if (!id || !quantity) {
                throw new Error('Each ingredient must have an id and a quantity');
            }

            await client.query(
                'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES ($1, $2, $3)',
                [recipeId, id, quantity]
            );
        }

        await client.query('COMMIT'); // Commit the transaction if all goes well
        res.status(201).json({ message: 'Recipe added successfully', recipe: recipeResult.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback changes if an error occurs
        console.error('Error adding recipe:', error.message);
        res.status(500).json({ message: 'Failed to add recipe', error: error.message });
    } finally {
        client.release(); // Release the client connection
    }
};

// Retrieve all recipes with their ingredients
exports.getAllRecipes = async (req, res) => {
    try {
        // Fetch all recipes from the recipes table
        const recipeResult = await pool.query('SELECT * FROM recipes');
        const recipes = recipeResult.rows;

        // For each recipe, fetch the associated ingredients
        for (let recipe of recipes) {
            const ingredientResult = await pool.query(
                'SELECT i.id, i.name, ri.quantity FROM ingredients i JOIN recipe_ingredients ri ON i.id = ri.ingredient_id WHERE ri.recipe_id = $1',
                [recipe.id]
            );
            recipe.ingredients = ingredientResult.rows; // Add ingredients to each recipe
        }

        res.status(200).json(recipes); // Return recipes with ingredients
    } catch (error) {
        console.error('Error retrieving recipes:', error.message);
        res.status(500).json({ message: 'Failed to retrieve recipes', error: error.message });
    }
};
