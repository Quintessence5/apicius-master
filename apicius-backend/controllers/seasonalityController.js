const pool = require('../config/db');
const { isValidDate } = require('../utils/validators');

exports.getSeasonalToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { rows } = await pool.query(`
      SELECT 
        sp.id,
        i.id AS ingredient_id,
        i.name,
        i.category,
        sr.region_name,
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
        generate_series(
          GREATEST(sp.season_start, $1::date),
          LEAST(sp.season_end, $2::date),
          '1 day'::interval
        )::date AS date,
        json_agg(DISTINCT i.*) FILTER (WHERE i.category = 'Fruit') AS fruits,
        json_agg(DISTINCT i.*) FILTER (WHERE i.category = 'Vegetable') AS vegetables
      FROM season_period sp
      JOIN ingredients i ON sp.ingredient_id = i.id
      WHERE sp.season_start <= $2 AND sp.season_end >= $1
      GROUP BY date
      ORDER BY date
    `, [startDate, endDate]);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ message: 'Failed to load calendar data' });
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