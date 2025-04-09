const pool = require('../config/db');
const { isValidDate } = require('../utils/validators');
const XLSX = require('xlsx');

exports.getSeasonalToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { rows } = await pool.query(`
      SELECT 
        sp.id,
        i.id AS ingredient_id,
        i.name,
        i.category,
        i.image_path,
        sr.country,  
        sp.season_start,
        sp.season_end,
        sp.produce_image_url
      FROM season_period sp
      JOIN ingredients i ON sp.ingredient_id = i.id
      JOIN seasonal_region sr ON sp.region_id = sr.region_id
      WHERE $1 BETWEEN sp.season_start AND sp.season_end
      ORDER BY i.name
    `, [today]);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching seasonal produce:', error);
    res.status(500).json({ message: 'Failed to get seasonal data' });
  }
};

exports.getSeasonalCalendar = async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { rows } = await pool.query(`
      SELECT 
        calendar_date::date AS date,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'name', i.name,
              'image path', i.image_path,
              'country', sr.country
            ) 
          ) FILTER (WHERE i.category = 'Fruit'),
          '[]'::json
        ) AS fruits,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'name', i.name,
              'image path', i.image_path,
              'country', sr.country
            ) 
          ) FILTER (WHERE i.category = 'Vegetable'),
          '[]'::json
        ) AS vegetables
      FROM generate_series($1::date, $2::date, '1 day'::interval) AS calendar_date
      LEFT JOIN season_period sp 
        ON calendar_date BETWEEN sp.season_start AND sp.season_end
      LEFT JOIN ingredients i ON sp.ingredient_id = i.id
      LEFT JOIN seasonal_region sr ON sp.region_id = sr.region_id
      GROUP BY calendar_date
      ORDER BY calendar_date
    `, [startDate, endDate]);
    const transformedRows = rows.map(row => ({
      ...row,
      date: new Date(row.date).toISOString().split('T')[0]
    }));    

    res.status(200).json(rows);
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ 
      message: 'Failed to load calendar data',
      error: error.message 
    });
  }
};

exports.getSeasonalManagement = async (req, res) => {
  console.log('Entering getSeasonalManagement');
  try {
    console.log('Executing management query');
    const { rows } = await pool.query(`
      SELECT 
        sp.id,
        sp.ingredient_id,
        i.name AS ingredient_name,
        i.image_path,
        sp.region_id,
        sr.region_name,
        sp.season_start,
        sp.season_end,
        sp.notes,
        sp.produce_image_url
      FROM season_period sp
      JOIN ingredients i ON sp.ingredient_id = i.id
      JOIN seasonal_region sr ON sp.region_id = sr.region_id
      ORDER BY sp.season_start
    `);

    console.log('Query results:', rows.length, 'entries found');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Management fetch error:', {
      message: error.message,
      query: error.query,
      stack: error.stack
    });
    res.status(500).json({ message: 'Failed to get seasonality data' });
  }
};

exports.createSeasonalEntry = async (req, res) => {
  const { ingredient_id, region_id, season_start, season_end, ...optionalFields } = req.body;
  
  try {
    // Validation
    if (!ingredient_id || !region_id || !season_start || !season_end) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (!isValidDate(season_start) || !isValidDate(season_end)) {
      return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const { rows } = await pool.query(
      `INSERT INTO season_period (
        ingredient_id, region_id, season_start, season_end, 
        notes, produce_image_url
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        ingredient_id,
        region_id,
        season_start,
        season_end,
        optionalFields.notes || null,
        optionalFields.produce_image_url || null
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create error:', error);
    res.status(500).json({ 
      message: 'Failed to create entry',
      error: error.message 
    });
  }
};

exports.updateSeasonalEntry = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // Validate dates
    if ((updates.season_start && !isValidDate(updates.season_start)) ||
        (updates.season_end && !isValidDate(updates.season_end))) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');

    const query = {
      text: `UPDATE season_period SET ${setClause} WHERE id = $${Object.keys(updates).length + 1} RETURNING *`,
      values: [...Object.values(updates), id]
    };

    const { rows } = await pool.query(query);
    
    if (!rows.length) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ message: 'Failed to update entry' });
  }
};

exports.deleteSeasonalEntry = async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query('DELETE FROM season_period WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Failed to delete entry' });
  }
};

exports.getRegions = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        region_id,
        region_name,
        country,
        climate_type,
        created_at,
        updated_at
      FROM seasonal_region
      ORDER BY region_name
    `);
    
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({ 
      message: 'Failed to get regions',
      error: error.message
    });
  }
};

// Generate Seasonality Template
exports.generateSeasonalityTemplate = (req, res) => {
  try {
    console.log('Template generation started'); 
    
    const headers = [
      ['Ingredient ID*', 'Region ID*', 'Season Start* (YYYY-MM-DD)', 'Season End* (YYYY-MM-DD)', 'Notes', 'Produce Image URL']
    ];
    

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    console.log('Buffer length:', buffer.length);  
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=seasonality_template.xlsx');
    res.send(buffer);

  } catch (error) {
    console.error('Template error:', error.stack);  
    res.status(500).json({ 
      message: 'Failed to generate template',
      error: error.message 
    });
  }
};

// Handle Seasonality Excel Upload
exports.uploadSeasonality = async (req, res) => {
  try {
    if (!req.file) throw new Error('No file uploaded');
    
    const workbook = XLSX.read(req.file.buffer, { 
      type: 'buffer',
      cellDates: true // Parse dates as JS Date objects
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const errors = [];
    const validData = [];

    for (const [index, row] of data.entries()) {
      const entryErrors = [];
      const rowNumber = index + 2;

      // Required fields check
      if (!row['Ingredient ID*']) entryErrors.push('Missing Ingredient ID');
      if (!row['Region ID*']) entryErrors.push('Missing Region ID');
      if (!row['Season Start* (YYYY-MM-DD)']) entryErrors.push('Missing Season Start');
      if (!row['Season End* (YYYY-MM-DD)']) entryErrors.push('Missing Season End');

      // Convert Excel dates to ISO format
      const convertDate = (excelDate) => {
        if (excelDate instanceof Date) {
          return excelDate.toISOString().split('T')[0];
        }
        return excelDate;
      };

      const rawStartDate = row['Season Start* (YYYY-MM-DD)'];
      const rawEndDate = row['Season End* (YYYY-MM-DD)'];
      
      const startDate = convertDate(rawStartDate);
      const endDate = convertDate(rawEndDate);

      // Validate IDs exist
      const [ingredientExists, regionExists] = await Promise.all([
        pool.query('SELECT id FROM ingredients WHERE id = $1', [row['Ingredient ID*']]),
        pool.query('SELECT region_id FROM seasonal_region WHERE region_id = $1', [row['Region ID*']])
      ]);

      if (ingredientExists.rows.length === 0) entryErrors.push('Invalid Ingredient ID');
      if (regionExists.rows.length === 0) entryErrors.push('Invalid Region ID');

      // Date validation
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate)) entryErrors.push('Invalid Start Date format (use YYYY-MM-DD)');
      if (!dateRegex.test(endDate)) entryErrors.push('Invalid End Date format (use YYYY-MM-DD)');
      
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime())) entryErrors.push('Invalid Start Date');
      if (isNaN(endDateObj.getTime())) entryErrors.push('Invalid End Date');
      if (startDateObj > endDateObj) entryErrors.push('End date must be after start date');

      if (entryErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: entryErrors,
          data: row
        });
        continue;
      }

      validData.push({
        ingredient_id: row['Ingredient ID*'],
        region_id: row['Region ID*'],
        season_start: startDate,
        season_end: endDate,
        notes: row['Notes'] || null,
        produce_image_url: row['Produce Image URL'] || null
      });
    }

    // Insert valid entries
    const inserted = [];
    for (const entry of validData) {
      try {
        const result = await pool.query(
          `INSERT INTO season_period (
            ingredient_id, region_id, season_start, season_end, notes, produce_image_url
          ) VALUES ($1, $2, $3::date, $4::date, $5, $6) RETURNING *`,
          [
            entry.ingredient_id,
            entry.region_id,
            entry.season_start,
            entry.season_end,
            entry.notes,
            entry.produce_image_url
          ]
        );
        inserted.push(result.rows[0]);
      } catch (error) {
        errors.push({
          row: 'Unknown',
          errors: [error.message],
          data: entry
        });
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({
        success: inserted.length > 0,
        message: `Processed with ${errors.length} error(s). ${inserted.length} entries added successfully.`,
        inserted: inserted.length,
        errors
      });
    }

    res.json({
      success: true,
      message: `${inserted.length} seasonality entries added successfully`,
      inserted
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};