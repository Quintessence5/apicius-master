const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5010;

// Cookie Parser 
app.use(cookieParser());

// Routes
const userRoutes = require('./routes/userRoutes');
const recipeRoutes = require('./routes/recipeRoutes');
const ingredientRoutes = require('./routes/ingredientRoutes');
const unitsRoutes = require('./routes/unitsRoutes');
const countryRoutes = require('./routes/countryRoutes');
const seasonalityRoutes = require('./routes/seasonalityRoutes');
const userInteractionRoutes = require('./routes/userInteractionRoutes');

// Middleware setup
app.use(cors({
    origin: 'http://localhost:3000',  
    credentials: true,  
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition']
}));
 
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

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
app.use('/api/seasonality', seasonalityRoutes);
app.use('/api/interactions', userInteractionRoutes);

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

app.get('/debug-routes', (req, res) => {
    const routes = [
      { path: '/seasonality/manage', methods: ['GET', 'POST'] },
      { path: '/seasonality/regions', methods: ['GET'] },
      { path: '/ingredients/all', methods: ['GET'] }
    ];
    res.json(routes);
  });