const pool = require('../config/db');
const xlsx = require('xlsx');

exports.getAllIngredients = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM ingredients');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error retrieving ingredients:', error);
        res.status(500).json({ message: 'Failed to retrieve ingredients' });
    }
};

// Get single ingredient
exports.getIngredientById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Invalid ingredient ID format' });
      }
      const result = await pool.query('SELECT * FROM ingredients WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Ingredient not found' });
      }
      
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching ingredient:', error);
      res.status(500).json({ message: 'Server error' });
    }
  };
  
  // Create ingredient
  exports.createIngredient = async (req, res) => {
    try {
      const { body } = req;
      const result = await pool.query(
        `INSERT INTO ingredients(
          name, average_weight, category, calories_per_100g, protein, lipids, 
          carbohydrates, allergies, dietary_restrictions, form, saturated_fat, 
          trans_fat, cholesterol, sodium, fibers, sugars, added_sugars, intolerance
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          body.name,
        Number(body.average_weight) || null,
        body.category,
        Number(body.calories_per_100g) || null,
        Number(body.protein) || null,
        Number(body.lipids) || null,
        Number(body.carbohydrates) || null,
        body.allergies,
        body.dietary_restrictions,
        body.form,
        Number(body.saturated_fat) || null,
        Number(body.trans_fat) || null,
        Number(body.cholesterol) || null,
        Number(body.sodium) || null,
        Number(body.fibers) || null,
        Number(body.sugars) || null,
        Number(body.added_sugars) || null,
        body.intolerance
        ]
      );
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating ingredient:', error);
      res.status(500).json({ message: 'Failed to create ingredient' });
    }
  };
  
exports.updateIngredient = async (req, res) => {
    const { id } = req.params;
    try {
      const updates = req.body;
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
  
      const query = {
        text: `UPDATE ingredients SET ${setClause} WHERE id = $${Object.keys(updates).length + 1} RETURNING *`,
        values: [...Object.values(updates), id]
      };
  
      const result = await pool.query(query);
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({ message: 'Failed to update ingredient' });
    }
  };
  
  exports.deleteIngredient = async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM ingredients WHERE id = $1', [id]);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      res.status(500).json({ message: 'Failed to delete ingredient' });
    }
  };

  // GET submissions
exports.getSubmissions = async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM ingredient_submissions');
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      res.status(500).json({ message: 'Failed to get submissions' });
    }
  };
  
  // Approve submission
  exports.approveSubmission = async (req, res) => {
    const { id } = req.params;
    try {
      // 1. Get submission
      const submission = await pool.query(
        'SELECT * FROM ingredient_submissions WHERE id = $1',
        [id]
      );
      
      // 2. Insert into ingredients
      const ingredient = await pool.query(
        `INSERT INTO ingredients(name, category, calories_per_100g)
         VALUES($1, $2, $3) RETURNING *`,
        [submission.rows[0].name, submission.rows[0].category, submission.rows[0].calories]
      );
  
      // 3. Delete submission
      await pool.query('DELETE FROM ingredient_submissions WHERE id = $1', [id]);
  
      res.status(200).json(ingredient.rows[0]);
    } catch (error) {
      console.error('Error approving submission:', error);
      res.status(500).json({ message: 'Approval failed' });
    }
  };
  
  // Price endpoints
  exports.getPrices = async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT p.*, i.name as ingredient_name 
        FROM ingredient_prices p
        JOIN ingredients i ON p.ingredient_id = i.id
      `);
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching prices:', error);
      res.status(500).json({ message: 'Failed to get prices' });
    }
  };
  
  exports.updatePrice = async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `UPDATE ingredient_prices
         SET price_fr = $1, price_uk = $2, price_us = $3
         WHERE id = $4 RETURNING *`,
        [req.body.price_fr, req.body.price_uk, req.body.price_us, id]
      );
      res.status(200).json(result.rows[0]);
    } catch (error) {
      console.error('Error updating price:', error);
      res.status(500).json({ message: 'Update failed' });
    }
  };

  const XLSX = require('xlsx');

// Generate Excel template
exports.generateTemplate = (req, res) => {
  try {
    const headers = [
      'Name*',
      'Average Weight (g)*',
      'Category*',
      'Calories per 100g*',
      'Protein (g)',
      'Lipids (g)',
      'Carbohydrates (g)',
      'Allergies',
      'Dietary Restrictions',
      'Form',
      'Saturated Fat (g)',
      'Trans Fat (g)',
      'Cholesterol (g)',
      'Sodium (g)',
      'Fibers (g)',
      'Sugars (g)',
      'Added Sugars (g)',
      'Intolerance'
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ingredient_template.xlsx');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.end(buffer);
    
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({ message: 'Failed to generate template' });
  }
};

// Handle Excel upload
exports.uploadIngredients = async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Validate data
    const errors = [];
    const names = new Set();
    
    const validData = data.map((row, index) => {
      // Required fields check
      if (!row['Name*'] || !row['Average Weight (g)*'] || !row['Category*'] || !row['Calories per 100g*']) {
        errors.push(`Row ${index + 2}: Missing required fields`);
        return null;
      }

      // Unique name check
      if (names.has(row['Name*'])) {
        errors.push(`Row ${index + 2}: Duplicate ingredient name`);
        return null;
      }
      names.add(row['Name*']);

      return {
        name: row['Name*'],
        average_weight: row['Average Weight (g)*'],
        category: row['Category*'],
        calories_per_100g: row['Calories per 100g*'],
        protein: row['Protein (g)'] || null,
        lipids: row['Lipids (g)'] || null,
        carbohydrates: row['Carbohydrates (g)'] || null,
        allergies: row['Allergies'] || null,
        dietary_restrictions: row['Dietary Restrictions'] || null,
        form: row['Form'] || null,
        saturated_fat: row['Saturated Fat (g)'] || null,
        trans_fat: row['Trans Fat (g)'] || null,
        cholesterol: row['Cholesterol (mg)'] || null,
        sodium: row['Sodium (g)'] || null,
        fibers: row['Fibers (g)'] || null,
        sugars: row['Sugars (g)'] || null,
        added_sugars: row['Added Sugars (g)'] || null,
        intolerance: row['Intolerance'] || null
      };
    }).filter(Boolean);

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation errors',
        errors
      });
    }

    // Insert into database
    const inserted = [];
    for (const ingredient of validData) {
      try {
        const result = await pool.query(
          `INSERT INTO ingredients (
            ${Object.keys(ingredient).join(', ')}
          ) VALUES (
            ${Object.keys(ingredient).map((_, i) => `$${i + 1}`).join(', ')}
          ) RETURNING *`,
          Object.values(ingredient)
        );
        inserted.push(result.rows[0]);
      } catch (error) {
        errors.push(`Error inserting ${ingredient.name}: ${error.message}`);
      }
    }
    console.log('Processing Excel file...');
    
    // Add this to see parsed data
    console.log('Valid data:', validData);
    
    // Add this before database insertion
    console.log('Inserting ingredients...');
    
    if (errors.length > 0) {
      return res.status(207).json({ // 207 Multi-Status
        success: true,
        message: 'Partial success',
        inserted: inserted.length,
        errors
      });
    }

    res.json({ 
      success: true,
      message: `${inserted.length} ingredients added successfully`,
      inserted
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};