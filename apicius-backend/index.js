const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5010;
const userRoutes = require('./routes/userRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');

// Middleware setup
app.use(cors());
app.use(bodyParser.json());

// Route setup
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes); // New route for recipes
app.use('/api/ingredients', ingredientRoutes);

app.get('/', (req, res) => {
    res.send('Apicius Backend is Running');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
