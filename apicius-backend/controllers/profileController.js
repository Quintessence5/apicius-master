const pool = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Profile Page
exports.getProfile = async (req, res) => {
    try {
        const userId = req.userId; // Assuming `verifyToken` middleware adds `userId`
        
        // Fetch data from both user_profile and users tables using a JOIN
        const query = `
            SELECT 
                up.username, 
                up.first_name, 
                up.last_name, 
                up.birthdate, 
                up.origin_country, 
                up.language,
                up.bio,
                up.phone, 
                up.newsletter,
                u.email, 
                u.password,
                u.role 
            FROM user_profile AS up
            INNER JOIN users AS u ON up.user_id = u.id
            WHERE up.user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        // Check if any result was returned
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Extract user data
        const { 
            username, 
            first_name, 
            last_name, 
            birthdate, 
            origin_country, 
            language,
            bio, 
            phone, 
            newsletter,
            email, 
            password,
            role 
        } = result.rows[0];

        // Check if the profile is complete
        const isProfileComplete = !!username;

        // Respond with user profile data
    const userData = result.rows[0];
    console.log("Database Response:", userData);
        res.status(200).json({
            username,
            first_name,
            last_name,
            birthdate,
            origin_country,
            language,
            bio,
            phone,
            newsletter,
            email,
            password,
            user_id: userId,
            role,
            isProfileComplete,
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getUserPreferences = async (req, res) => {
    try {
        const userId = req.userId; 
        
        const query = `
            SELECT user_id, allergy, intolerance, diets
            FROM user_restrictions
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Preferences not found' });
        }

        const { user_id, allergy, intolerance, diets } = result.rows[0];
        res.status(200).json({ user_id, allergy, intolerance, diets });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.updateUserProfile = async (req, res) => {
    const {
        user_id,
        username,
        first_name,
        last_name,
        birthdate,
        origin_country,
        language,
        phone_code,
        phone_number,
        newsletter,
        email,
        newPassword,
        bio,
    } = req.body;

    if (!user_id) {
        console.log("Missing user_id"); 
        return res.status(400).json({ message: "User ID is required" });
    }

    try {
        // Combine phone code and number with a space
        const phone = phone_code && phone_number ? `${phone_code} ${phone_number}` : null;

        // 1. Update `user_profile` table
        const profileFieldsToUpdate = [];
        const profileValues = [];
        let profileIndex = 1;

        if (bio) {
            profileFieldsToUpdate.push(`bio = $${profileIndex++}`);
            profileValues.push(bio);
        }
        if (username) {
            profileFieldsToUpdate.push(`username = $${profileIndex++}`);
            profileValues.push(username);
        }
        if (first_name) {
            profileFieldsToUpdate.push(`first_name = $${profileIndex++}`);
            profileValues.push(first_name);
        }
        if (last_name) {
            profileFieldsToUpdate.push(`last_name = $${profileIndex++}`);
            profileValues.push(last_name);
        }
        if (birthdate) {
            profileFieldsToUpdate.push(`birthdate = $${profileIndex++}`);
            profileValues.push(birthdate);
        }
        if (origin_country) {
            profileFieldsToUpdate.push(`origin_country = $${profileIndex++}`);
            profileValues.push(origin_country);
        }
        if (language) {
            profileFieldsToUpdate.push(`language = $${profileIndex++}`);
            profileValues.push(language);
        }
        if (phone) {
            profileFieldsToUpdate.push(`phone = $${profileIndex++}`);
            profileValues.push(phone);
        }
        if (newsletter !== undefined) {
            profileFieldsToUpdate.push(`newsletter = $${profileIndex++}`);
            profileValues.push(newsletter);
        }

        if (profileFieldsToUpdate.length > 0) {
            profileValues.push(user_id);
            const profileQuery = `
                UPDATE user_profile
                SET ${profileFieldsToUpdate.join(", ")}
                WHERE user_id = $${profileIndex}
            `;
        
            const profileResult = await pool.query(profileQuery, profileValues);
            console.log("Profile Update Result:", profileResult);
        }

        // 2. Update `users` table (email and password)
        const userFieldsToUpdate = [];
        const userValues = [];
        let userIndex = 1;

        if (email) {
            userFieldsToUpdate.push(`email = $${userIndex++}`);
            userValues.push(email);
        }

        if (newPassword) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            userFieldsToUpdate.push(`password = $${userIndex++}`);
            userValues.push(hashedPassword);
        }

        if (userFieldsToUpdate.length > 0) {
            userValues.push(user_id);
            const userQuery = `
                UPDATE users
                SET ${userFieldsToUpdate.join(", ")}
                WHERE id = $${userIndex}
            `;

            const userResult = await pool.query(userQuery, userValues);

            // Handle case where no user rows were updated
            if (userResult.rowCount === 0) {
                console.log("No changes made to users table");
                return res.status(404).json({ message: "User not found or no changes made" });
            }
        }

        // 3. Respond with success if any updates were made
        if (profileFieldsToUpdate.length > 0 || userFieldsToUpdate.length > 0) {
            return res.status(200).json({ message: "Profile updated successfully" });
        }

        console.log("No fields to update"); // Log no fields case
        res.status(400).json({ message: "No fields to update" });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};

// Get food control tags grouped by category
exports.getControlTags = async (req, res) => {
    try {
        const query = `SELECT name, category
            FROM food_control`;
        const result = await pool.query(query);

        // Group tags by categories
        const tags = {
            allergy: [],
            intolerance: [],
            diets: [],
        };

        result.rows.forEach((tag) => {
            if (tag.category === 'Allergy') {
                tags.allergy.push(tag.name);
            } else if (tag.category === 'Intolerance') {
                tags.intolerance.push(tag.name);
            } else if (tag.category.startsWith('Diet')) {
                tags.diets.push(tag.name);
            }
        });

        res.status(200).json(tags);
    } catch (error) {
        console.error('Error fetching food control tags:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getUserPreferences = async (req, res) => {
    try {
        const userId = req.userId; // Assuming middleware adds userId

        const query = `
            SELECT user_id, allergy, intolerance, diets
            FROM user_restrictions
            WHERE user_id = $1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Preferences not found' });
        }

        const { user_id, allergy, intolerance, diets } = result.rows[0];
        res.status(200).json({ user_id, allergy, intolerance, diets });
    } catch (error) {
        console.error('Error fetching preferences:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.saveUserProfile = async (req, res) => {
    try {
        const { 
            user_id, 
            username, 
            first_name, 
            last_name, 
            bio, 
            phone_code,
            phone_number,
            newsletter,
            birthdate,
            origin_country,
            language,
            terms_condition
        } = req.body;

        // Ensure `user_id` is provided
        if (!user_id) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const phone = phone_code && phone_number ? `${phone_code} ${phone_number}` : null;

        // Insert or update user profile data
        const query = `
            INSERT INTO user_profile (
                user_id, 
                username, 
                first_name, 
                last_name, 
                bio, 
                phone, 
                newsletter,
                birthdate,
                origin_country,
                language,
                terms_condition
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                username = $2,
                first_name = $3,
                last_name = $4,
                bio = $5,
                phone = $6,
                newsletter = $7,
                birthdate = $8,
                origin_country = $9,
                language = $10,
                terms_condition = $11
        `;
        const values = [
            user_id, 
            username, 
            first_name, 
            last_name, 
            bio, 
            phone, 
            newsletter,
            birthdate,
            origin_country,
            language,
            terms_condition
        ];

        await pool.query(query, values);

        res.status(200).json({ message: "Profile saved successfully" });
    } catch (error) {
        console.error("Error saving user profile:", error);
        res.status(500).json({ message: "Failed to save profile" });
    }
};

exports.saveUserPreferences = async (req, res) => {
    const { user_id, allergy, intolerance, diets } = req.body;

    if (!user_id) {
        return res.status(400).json({ message: "User ID is required" });
    }

    try {
        const query = `
            INSERT INTO user_restrictions (user_id, allergy, intolerance, diets)
            VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                allergy = $2::jsonb,
                intolerance = $3::jsonb,
                diets = $4::jsonb
        `;
        const values = [user_id, JSON.stringify(allergy || []), JSON.stringify(intolerance || []), JSON.stringify(diets || [])];

        await pool.query(query, values);

        res.status(200).json({ message: "Preferences saved successfully" });
    } catch (error) {
        console.error("Error saving preferences:", error);
        res.status(500).json({ message: "Failed to save preferences" });
    }
};