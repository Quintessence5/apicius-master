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

        
        // ----- Extract ingredient sections if available -----
        console.log('🌐 Detecting ingredient sections...');
        const ingredientSections = extractIngredientSections($);
        
        let extractedIngredients = [];
        let fullText;

        if (ingredientSections.length > 0) {
            console.log(`   Found ${ingredientSections.length} ingredient sections.`);
            
            // Process each section: parse ingredient lines and assign section
            ingredientSections.forEach(section => {
                section.lines.forEach(line => {
                    const parsed = extractIngredientsFromText(line);
                    parsed.forEach(ing => {
                        ing.section = section.section; // assign section name
                        extractedIngredients.push(ing);
                    });
                });
            });

            // Also build a full text with section markers for LLM context
            fullText = `Title: ${pageTitle}\nDescription: ${metaDesc}\n\n`;
            ingredientSections.forEach(section => {
                fullText += `\n--- ${section.section} ---\n`;
                section.lines.forEach(line => fullText += line + '\n');
            });

            // Append any other page content (optional, for additional context)
            fullText += '\n' + extractPageText($);
        } else {
            // No sections found – fall back to full-page text extraction
            console.log('   No ingredient sections detected, using full page text.');
            const contentText = extractPageText($);
            fullText = `
Title: ${pageTitle}
Description: ${metaDesc}

${contentText}
            `.trim();
            extractedIngredients = extractIngredientsFromText(fullText);
        }

        console.log(`   Pre‑extracted ${extractedIngredients.length} potential ingredients.`);

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

// ---------- Extract ingredient sections from HTML ----------
const extractIngredientSections = ($) => {
    const sections = [];
    
    // Known selectors for section headings (add more as needed)
    const headingSelectors = [
        'h3.recipe-ingredients-subtitle',          // 750g
        '.structured-ingredients__list-heading',  // Serious Eats
        '.ingredients__section-heading',
        '.recipe-ingredients__heading',
        'h2.ingredients-section-title',
        'h3.ingredients-section-title',
        'h4.ingredients-section-title'
    ];

    headingSelectors.forEach(selector => {
        $(selector).each((i, el) => {
            const sectionName = $(el).text().trim();
            if (!sectionName) return;

            // Try to find the associated list – could be next sibling or inside parent
            let list = $(el).next('ul, ol');
            if (list.length === 0) {
                // Maybe inside a container like div
                list = $(el).closest('div').find('ul, ol').first();
            }
            if (list.length === 0) {
                // Fallback: look for any list within the same section container
                const container = $(el).closest('section, div');
                list = container.find('ul, ol').first();
            }

            if (list.length) {
                const lines = [];
                list.find('li').each((j, li) => {
                    const line = $(li).text().trim();
                    if (line) lines.push(line);
                });
                if (lines.length) {
                    sections.push({ section: sectionName, lines });
                }
            }
        });
    });

    // If no sections found with specific selectors, try a generic approach
    if (sections.length === 0) {
        $('h2, h3, h4').each((i, el) => {
            const heading = $(el).text().trim();
            // Heuristic: heading should contain words like "cake", "frosting", "dough", "garnish", "pâte", "garniture", etc.
            const relevant = /cake|frosting|dough|batter|filling|topping|garnish|pâte|garniture|crust|icing|sauce|cream|base/i.test(heading);
            if (!relevant) return;

            const list = $(el).next('ul, ol');
            if (list.length) {
                const lines = [];
                list.find('li').each((j, li) => {
                    const line = $(li).text().trim();
                    if (line) lines.push(line);
                });
                if (lines.length) {
                    sections.push({ section: heading, lines });
                }
            }
        });
    }

    return sections;
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