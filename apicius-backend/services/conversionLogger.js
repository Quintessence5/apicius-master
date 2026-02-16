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

module.exports = {
    logConversion,
    logConversionError,
    getConversionStats
};