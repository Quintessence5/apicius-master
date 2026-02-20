const { normalizeUnit, normalizeIngredientNameForMatching }  = require('../../controllers/videoRecipeController.js');

const extractIngredientsFromText = (text) => {
    if (!text || text.length === 0) return [];
    
    const ingredients = [];
    const seen = new Set();
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentSection = 'Main';
    let inIngredientsSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty or very long lines
        if (trimmed.length === 0 || trimmed.length > 500) continue;
        
        // Skip metadata lines (serves, yields, etc.)
        if (/^(serves?|servings?|yields?|makes?)[\s\d]*/i.test(trimmed)) continue;
        
        // Detect ingredients section header
        if (/^(ingredients?\s*:?\s*)$/i.test(trimmed)) {
            inIngredientsSection = true;
            currentSection = trimmed.replace(/s?:?\s*$/i, '').trim();
            continue;
        }
        
        // Detect other section headers (expanded keywords from both)
        const sectionMatch = trimmed.match(/^[✔✓]?\s*([A-Za-z\s]+?)\s*:?\s*$/i);
        if (sectionMatch) {
            const sectionName = sectionMatch[1].trim();
            if (/cake|batter|frosting|glaze|sauce|filling|topping|dough|crust|base|icing|ganache|baking|pan|chocolate|main/i.test(sectionName)) {
                currentSection = sectionName;
                inIngredientsSection = false;
                continue;
            }
        }
        
        // Stop at instruction keywords (set flag but continue for potential later sections)
        if (/^(instructions|directions|steps|method|procedure|pan\s+size|mix|bake|heat|cook|fold|whisk|preheat|batter|baking|oven|temperature|°|degrees|step|instruction|direction)/i.test(trimmed)) {
            inIngredientsSection = false;
            continue;
        }
        
        // Skip pure text lines without numbers, bullets, or ingredient keywords
        if (/^[a-z\s]*$/i.test(trimmed) && !trimmed.match(/\d/) && !trimmed.match(/[-•✓✔]/) && !trimmed.match(/egg|flour|sugar|butter|milk|oil|powder|salt|soda|cream|chocolate|cocoa/i)) {
            continue;
        }
        
        // Skip header-like lines (all caps)
        if (/^[A-Z\s\-]+$/.test(trimmed)) continue;
        
        // Expanded patterns support for mixed fractions (e.g., 1 1/2)
        const patterns = [
            // Pattern 0: "Ingredient name - 1 cup (130g)" or "Ingredient - 1cup"
            /^[-•✓✔]?\s*([a-zA-Z\s]+?)\s*-\s*((\d+\s+)?(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔))\s*([a-zA-Z\s]*?)(?:\s*[\(\[]|$)/i,
            // Pattern 1: "1 cup flour" or "½ cup cocoa powder"
            /^[-•✓✔]?\s*((\d+\s+)?(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔))\s+([a-zA-Z\s]+?)\s+(.+?)(?:\s*\[|\s*\(|$)/i,
            // Pattern 2: "1 cup flour" (simple)
            /^[-•✓✔]?\s*((\d+\s+)?(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔))\s+([a-zA-Z\s]+?)$/i,
            // Pattern 3: "Ingredient - 200g" or "Dark Chocolate - 200g"
            /^[-•✓✔]?\s*([a-zA-Z\s]+?)\s*-\s*((\d+\s+)?(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔))\s*([a-zA-Z]+)(?:\s*[\(\[]|$)/i,
            // Pattern 4: "123 g ingredient" or "123ml ingredient"
            /((\d+\s+)?\d+(?:\.\d+)?)\s*(g|mg|kg|ml|l|litre|liter|tbsp|tsp|cup|cups|oz|lb|lbs|tablespoon|teaspoon|pinch|dash|handful)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern 5: "1/2 teaspoon baking powder" or "3/4 cup flour"
            /((\d+\s+)?\d+\/\d+)\s+(teaspoon|tablespoon|tsp|tbsp|cup|cups|g|ml|oz|lb)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern 6: "2 large eggs" or "1 egg"
            /((\d+\s+)?\d+(?:\/\d+)?)\s+(large|small|medium)?\s*([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern 7: From #1 main pattern, handles ranges and notes
            /^[-•✓✔]?\s*((\d+\s+)?[\d.]+(?:\/\d+)?(?:\s*-\s*[\d.]+)?)\s+([a-zA-Z\s\(\)]+?)(?:\s+(.+?))?(?:\s*\(([^)]*)\))?$/i,
            // Pattern 8: From #1 simple pattern
            /^[-•✓✔]?\s*((\d+\s+)?[\d.]+(?:\/\d+)?(?:\s*-\s*[\d.]+)?)\s+(.+)$/i,
        ];
        
        for (const [index, pattern] of patterns.entries()) {
            let match = trimmed.match(pattern);
            if (!match && pattern.global) {
                pattern.lastIndex = 0; // Reset for global
                while ((match = pattern.exec(trimmed)) !== null) {
                    let quantity = match[1];
                    let rawUnit = match[3] || '';
                    let rawName = match[4]?.trim() || '';
                    if (index === 4) { // Adjust for pattern4
                        quantity = match[1];
                        rawUnit = match[3];
                        rawName = match[4];
                    } else if (index === 5) {
                        quantity = match[1];
                        rawUnit = match[4];
                        rawName = match[5];
                    } else if (index === 6) {
                        quantity = match[1];
                        rawUnit = match[3] || '';
                        rawName = match[4];
                    }
                    processMatch(quantity, rawUnit, rawName, trimmed);
                }
            } else if (match) {
                let quantity = null;
                let rawUnit = null;
                let rawName = null;
                
                if (index === 0) {
                    rawName = match[1].trim();
                    quantity = match[2];
                    rawUnit = match[5] || '';
                } else if (index === 1) {
                    quantity = match[1];
                    rawUnit = match[5];
                    rawName = match[6];
                } else if (index === 2) {
                    quantity = match[1];
                    rawUnit = '';
                    rawName = match[5];
                } else if (index === 3) {
                    rawName = match[1].trim();
                    quantity = match[2];
                    rawUnit = match[5];
                } else if (index === 7) {
                    quantity = match[1];
                    rawUnit = match[4];
                    rawName = match[5] || (match[6] ? match[6] : '');
                } else if (index === 8) {
                    quantity = match[1];
                    rawUnit = '';
                    rawName = match[4];
                }
                
                if (quantity && rawName) {
                    processMatch(quantity, rawUnit, rawName, trimmed);
                    break; // Stop after first successful non-global match
                }
            }
        }
    }
    
    function processMatch(quantity, rawUnit, rawName, original) {
        // Convert special fraction symbols to decimals
        quantity = quantity.replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/⅓/g, '0.33').replace(/⅔/g, '0.67');
        
        // Remove parentheses from rawUnit and rawName (alternative measures, notes)
        let cleanRawUnit = rawUnit.replace(/\([^)]*\)/g, '').trim();
        let cleanRawName = rawName.replace(/\([^)]*\)/g, '').trim();
        
        // Attempt to split unit if it contains extra name parts
        const unitSplit = cleanRawUnit.match(/^([a-zA-Z\s]+?)(?:\s+(.+))?$/i);
        if (unitSplit) {
            cleanRawUnit = unitSplit[1].trim();
            if (unitSplit[2]) {
                cleanRawName = `${unitSplit[2].trim()} ${cleanRawName}`.trim();
            }
        }
        
        // Normalize unit
        const normalizedUnit = normalizeUnit(cleanRawUnit.toLowerCase());
        
        // If unit not recognized and present, append to name
        let finalUnit = normalizedUnit || cleanRawUnit || 'pc';
        let finalName = cleanRawName;
        if (!normalizedUnit && cleanRawUnit) {
            finalName = `${cleanRawUnit} ${cleanRawName}`.trim();
            finalUnit = 'pc';
        }
        
        // Apply custom cleaning
        const cleanName = normalizeIngredientNameForMatching(finalName).trim().toLowerCase();
        
        // Skip invalid names
        if (cleanName.length < 2 || cleanName.length > 100) return;
        
        // Deduplication key
        const key = `${quantity}-${finalUnit}-${cleanName}`.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        
        // Push ingredient
        ingredients.push({
            name: cleanName,
            quantity: quantity || null,
            unit: finalUnit,
            section: currentSection,
            rawUnit: rawUnit,
            original: original,
            matched: !!normalizedUnit
        });
    }
    
    return ingredients;
};

module.exports = { extractIngredientsFromText };