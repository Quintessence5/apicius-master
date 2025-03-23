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
  
  // Handle Excel upload
  exports.uploadIngredients = async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
  
    try {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);
  
      // Validate and insert data
      for (const row of data) {
        await pool.query(
          `INSERT INTO ingredients(
            name, category, calories_per_100g, protein, lipids, carbohydrates
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.name, row.category, row.calories, row.protein, row.lipids, row.carbs]
        );
      }
  
      res.status(200).json({ message: `${data.length} ingredients added` });
    } catch (error) {
      console.error('Excel upload error:', error);
      res.status(500).json({ message: 'Failed to process file' });
    }
  };
  
  // Generate Excel template
  exports.generateTemplate = (req, res) => {
    const headers = ['name', 'category', 'calories', 'protein', 'lipids', 'carbs'];
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([headers]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');
    
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=ingredient_template.xlsx'
    );
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }).then((data) => {
      res.send(data);
    });
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