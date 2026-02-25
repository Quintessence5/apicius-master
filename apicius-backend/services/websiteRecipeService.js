// services/websiteRecipeService.js
const axios = require('axios');
const cheerio = require('cheerio');
const { extractIngredientsFromText } = require('./videoToRecipeService');
const { generateRecipeWithLLM } = require('./videoToRecipeService');


//Extract recipe data from a website URL
const extractRecipeFromWebsite = async (url) => {
    try {
        console.log(`🌐 Fetching website: ${url}`);

        // ----- Fetch HTML -----
        const html = await fetchHTML(url);
        const $ = cheerio.load(html);

        // ----- Extract page title and description -----
        const pageTitle = $('title').text().trim() || 'Untitled Recipe';
        const metaDesc = $('meta[name="description"]').attr('content') || '';

        // ----- Extract main content text (paragraphs, list items, etc.) -----
        const contentText = extractPageText($);

        // Combine all text for LLM
        const fullText = `
Title: ${pageTitle}
Description: ${metaDesc}

${contentText}
        `.trim();

        // ----- Pre‑extract ingredients using existing function -----
        console.log('🌐 Pre‑extracting ingredients from page text...');
        const extractedIngredients = extractIngredientsFromText(fullText);
        console.log(`   Found ${extractedIngredients.length} potential ingredients.`);

        // ----- Extract recipe image -----
        const imageUrl = extractImage($, url);
        console.log(`   Image: ${imageUrl || 'none'}`);

        // ----- Use LLM to generate structured recipe -----
        console.log('🌐 Calling LLM to structure recipe...');
        const recipe = await generateRecipeWithLLM(
            fullText,                // description (page text)
            pageTitle,               // videoTitle (recipe title)
            'Website',               // channelTitle (source)
            extractedIngredients,    // pre‑extracted ingredients
            ''                       // no comments
        );

        return { recipe, imageUrl };
    } catch (error) {
        console.error('❌ Website extraction error:', error);
        throw new Error(`Failed to extract recipe: ${error.message}`);
    }
};

// ---------- Fetch HTML ----------
const fetchHTML = async (url) => {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RecipeBot/1.0)',
            'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        },
        timeout: 15000,
    });
    return response.data;
};

// ---------- Extract readable text from the page ----------
const extractPageText = ($) => {
    const selectors = [
        'article', '.recipe-content', '.entry-content', '.post-content',
        'p', 'li', '.ingredients', '.instructions', '.directions'
    ];
    let text = '';
    selectors.forEach(selector => {
        $(selector).each((i, el) => {
            const t = $(el).text().trim();
            if (t.length > 20) text += t + '\n';
        });
    });
    return text.slice(0, 6000); // limit length for LLM
};

// ---------- Extract recipe image from meta tags or first image ----------
const extractImage = ($, baseUrl) => {
    // Try Open Graph image
    let image = $('meta[property="og:image"]').attr('content');
    if (image) return image;

    // Try Twitter image
    image = $('meta[name="twitter:image"]').attr('content');
    if (image) return image;

    // Try first image inside common recipe containers
    const img = $('article img, .recipe-content img, .entry-content img').first();
    if (img.length) {
        let src = img.attr('src');
        if (src) {
            if (!src.startsWith('http')) {
                try {
                    src = new URL(src, baseUrl).href;
                } catch (e) {
                    // ignore
                }
            }
            return src;
        }
    }

    return null;
};

module.exports = { extractRecipeFromWebsite };