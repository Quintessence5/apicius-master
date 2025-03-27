const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5010;

// Cookie Parser 
app.use(cookieParser());

// Import routes
const userRoutes = require('./routes/userRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');
const unitsRoutes = require('./routes/unitsRoutes');
const countryRoutes = require('./routes/countryRoutes');
const seasonalityRoutes = require('./routes/seasonalityRoutes');

// Middleware setup
app.use(cors({
    origin: 'http://localhost:3000',  
    credentials: true,  
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Authorization, Content-Type',
    exposedHeaders: ['Content-Disposition']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.json()); 

app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    console.log(`Request body:`, req.body);
    next();
});

// Route setup
app.use('/api/users', userRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/country', countryRoutes);
app.use('/seasons', seasonalityRoutes);

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test route
app.get('/', (req, res) => {
    res.send('Apicius Backend is Running');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
