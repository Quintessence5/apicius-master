const pool = require('../config/db');

// __________-------------Log Conversion Attempt (for debugging)-------------__________
const logConversion = async (data) => {
    try {
        const {
            source_type,
            source_url = null,
            transcript_text = null,
            recipe_json = null,
            status,
            error_message = null,
            groq_api_response = null,
        } = data;

        console.log(`📝 Logging conversion: ${source_type} - ${status}`);

        await pool.query(
            `INSERT INTO transcript_conversions 
            (source_type, source_url, transcript_text, recipe_json, status, error_message, groq_api_response, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                source_type,
                source_url,
                transcript_text,
                recipe_json ? JSON.stringify(recipe_json) : null,
                status,
                error_message,
                groq_api_response ? JSON.stringify(groq_api_response) : null
            ]
        );

        console.log(`✅ Conversion logged successfully`);
    } catch (error) {
        console.error("❌ Error logging conversion:", error.message);
        // Don't throw - logging failures shouldn't break the main flow
    }
};

module.exports = {
    logConversion
};