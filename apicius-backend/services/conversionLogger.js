const pool = require('../config/db');

// __________-------------Improved Logging with Detailed Error Tracking-------------__________
const logConversion = async (data) => {
    try {
        const {
            user_id = null,
            source_type,
            source_url = null,
            video_title = null,
            video_duration = null,
            video_thumbnail_url = null,
            transcript_text = null,
            transcript_language = 'en',
            transcript_confidence = null,
            recipe_json = null,
            recipe_status = 'pending',
            status,
            error_message = null,
            groq_api_response = null,
            processing_time_ms = null,
            api_cost_estimate = null,
        } = data;

        console.log(`📝 Logging conversion: ${source_type} - ${status}`);

        const result = await pool.query(
            `INSERT INTO transcript_conversions 
            (user_id, source_type, source_url, video_title, video_duration, video_thumbnail_url, 
             transcript_text, transcript_language, transcript_confidence, recipe_json, recipe_status,
             status, error_message, groq_api_response, processing_time_ms, api_cost_estimate, 
             created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id`,
            [
                user_id,
                source_type,
                source_url,
                video_title,
                video_duration,
                video_thumbnail_url,
                transcript_text,
                transcript_language,
                transcript_confidence,
                recipe_json ? JSON.stringify(recipe_json) : null,
                recipe_status,
                status,
                error_message,
                groq_api_response ? JSON.stringify(groq_api_response) : null,
                processing_time_ms,
                api_cost_estimate
            ]
        );

        const conversionId = result.rows[0].id;
        console.log(`✅ Conversion logged with ID: ${conversionId}`);

        return conversionId;

    } catch (error) {
        console.error("❌ Error logging conversion:", error);
        throw error;
    }
};

// __________-------------Log Specific Errors for Debugging-------------__________
const logConversionError = async (conversionId, errorType, errorMessage, step) => {
    try {
        await pool.query(
            `INSERT INTO conversion_errors (conversion_id, error_type, error_message, step, retry_count, created_at)
             VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)`,
            [conversionId, errorType, errorMessage, step]
        );

        console.log(`📍 Error logged for conversion ${conversionId}: ${errorType} in ${step}`);
    } catch (error) {
        console.error("❌ Error logging conversion error:", error);
    }
};

// __________-------------Get Conversion Statistics-------------__________
const getConversionStats = async (userId = null, daysBack = 7) => {
    try {
        const query = userId
            ? `SELECT status, COUNT(*) as count FROM transcript_conversions 
               WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${daysBack} days'
               GROUP BY status`
            : `SELECT status, COUNT(*) as count FROM transcript_conversions 
               WHERE created_at > NOW() - INTERVAL '${daysBack} days'
               GROUP BY status`;

        const params = userId ? [userId] : [];
        const result = await pool.query(query, params);

        return result.rows.reduce((acc, row) => ({
            ...acc,
            [row.status]: parseInt(row.count)
        }), {});
    } catch (error) {
        console.error("❌ Error getting conversion stats:", error);
        throw error;
    }
};

// __________-------------Get Conversion History with Advanced Filtering-------------__________
const getConversionHistory = async (req, res) => {
    try {
        const { userId, limit = 20, offset = 0, status, source_type, dateFrom, dateTo } = req.query;

        let query = `SELECT * FROM transcript_conversions WHERE 1=1`;
        const values = [];
        let paramIndex = 1;

        // User filter
        if (userId) {
            query += ` AND user_id = $${paramIndex}`;
            values.push(parseInt(userId));
            paramIndex++;
        }

        // Status filter
        if (status) {
            query += ` AND status = $${paramIndex}`;
            values.push(status);
            paramIndex++;
        }

        // Source type filter
        if (source_type) {
            query += ` AND source_type = $${paramIndex}`;
            values.push(source_type);
            paramIndex++;
        }

        // Date range filter
        if (dateFrom) {
            query += ` AND created_at >= $${paramIndex}`;
            values.push(new Date(dateFrom));
            paramIndex++;
        }

        if (dateTo) {
            query += ` AND created_at <= $${paramIndex}`;
            values.push(new Date(dateTo));
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        values.push(parseInt(limit), parseInt(offset));

        const result = await pool.query(query, values);

        res.json({
            success: true,
            conversions: result.rows,
            count: result.rows.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error("❌ Error fetching conversion history:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error fetching history",
            error: error.message 
        });
    }
};

// __________-------------Get Conversion Details by ID-------------__________
const getConversionDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({ 
                success: false,
                message: "Valid conversion ID is required" 
            });
        }

        const result = await pool.query(
            `SELECT * FROM transcript_conversions WHERE id = $1`,
            [parseInt(id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false,
                message: "Conversion not found" 
            });
        }

        res.json({
            success: true,
            conversion: result.rows[0]
        });

    } catch (error) {
        console.error("❌ Error fetching conversion details:", error);
        res.status(500).json({ 
            success: false,
            message: "Server error",
            error: error.message 
        });
    }
};

module.exports = {
    logConversion,
    logConversionError,
    getConversionStats,
    getConversionHistory,
    getConversionDetails
};