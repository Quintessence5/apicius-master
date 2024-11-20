const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5010;

// Import routes
const userRoutes = require('./routes/userRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');
const unitsRoutes = require('./routes/unitsRoutes');
const countryRoutes = require('./routes/countryRoutes');

// Middleware setup
app.use(cors({
    origin: 'http://localhost:3000', // Replace with your frontend URL
    credentials: true, // Enable cookies and other credentials
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Authorization, Content-Type'
}));

app.use(bodyParser.json());
app.use(express.json()); // Parses JSON request bodies

// Route setup
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/country', countryRoutes);

// Test route
app.get('/', (req, res) => {
    res.send('Apicius Backend is Running');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
