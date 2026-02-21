const { normalizeUnit, cleanIngredientName }  = require('../../controllers/videoRecipeController.js');

// __________-------------Extract ingredients from text with unit normalization-------------__________
const extractIngredientsFromText = (text) => {
    if (!text) return [];
    
    const ingredients = [];
    const seen = new Set();
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    let currentSection = 'Main';
    let inIngredientsSection = false;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty or very long lines
        if (trimmed.length === 0 || trimmed.length > 500) continue;
        
        // Detect ingredients section header
        if (/^ingredients\s*:?\s*$/i.test(trimmed)) {
            inIngredientsSection = true;
            currentSection = 'Ingredients';
            continue;
        }
        
        // Detect other section headers (e.g., Cake Batter, Frosting)
        const sectionMatch = trimmed.match(/^[✔✓]?\s*([A-Za-z\s]+?)\s*:?\s*$/i);
        if (sectionMatch && /cake|batter|frosting|glaze|sauce|filling|topping|dough|crust|base|icing|ganache|baking|pan/i.test(trimmed)) {
            currentSection = sectionMatch[1].trim();
            inIngredientsSection = false;
            continue;
        }
        
        // Stop at instruction keywords
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
        
        // Combined patterns from both functions, expanded for more coverage
        const patterns = [
            // Pattern 1 from #1: "Ingredient name - 1 cup (130g)" or "Ingredient - 1cup"
            /^[-•✓✔]?\s*([a-zA-Z\s]+?)\s*-\s*(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔)\s*([a-zA-Z\s]*?)(?:\s*[\(\[]|$)/i,
            // Pattern 2 from #1: "1 cup flour" or "½ cup cocoa powder"
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔)\s+([a-zA-Z\s]+?)\s+(.+?)(?:\s*\[|\s*\(|$)/i,
            // Pattern 3 from #1: "1 cup flour" (simple)
            /^[-•✓✔]?\s*(\d+\.?\d*|\d+\/\d+|½|¼|⅓|⅔)\s+([a-zA-Z\s]+?)$/i,
            // Pattern 4 from #1: "Ingredient - 200g" or "Dark Chocolate - 200g"
            /^[-•✓✔]?\s*([a-zA-Z\s]+?)\s*-\s*(\d+\.?\d*)\s*([a-zA-Z]+)(?:\s*[\(\[]|$)/i,
            // Pattern from #2: "123 g ingredient" or "123ml ingredient"
            /(\d+(?:\.\d+)?)\s*(g|mg|kg|ml|l|litre|liter|tbsp|tsp|cup|cups|oz|lb|lbs|tablespoon|teaspoon|pinch|dash|handful)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern from #2: "1/2 teaspoon baking powder" or "3/4 cup flour"
            /(\d+\/\d+)\s+(teaspoon|tablespoon|tsp|tbsp|cup|cups|g|ml|oz|lb)\s+([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
            // Pattern from #2: "2 large eggs" or "1 egg"
            /(\d+(?:\/\d+)?)\s+(large|small|medium)?\s*([a-zA-Z\s\-\(\)]+?)(?:\n|,|;|$)/gi,
        ];
        
        let matched = false;
        for (const pattern of patterns) {
            let match = trimmed.match(pattern);
            if (!match && pattern.global) {
                while ((match = pattern.exec(trimmed)) !== null) {
                    // Handle global patterns
                    let quantity = match[1];
                    let rawUnit = match[2] || '';
                    let rawName = match[3]?.trim() || '';
                    
                    processMatch(quantity, rawUnit, rawName, trimmed);
                }
            } else if (match) {
                // Handle non-global patterns
                let quantity = null;
                let rawUnit = null;
                let rawName = null;
                
                // Assign based on pattern type (adjust indices per pattern)
                if (pattern === patterns[0]) {
                    rawName = match[1];
                    quantity = match[2];
                    rawUnit = match[3] || '';
                } else if (pattern === patterns[1]) {
                    quantity = match[1];
                    rawUnit = match[2];
                    rawName = match[3];
                } else if (pattern === patterns[2]) {
                    quantity = match[1];
                    rawUnit = '';
                    rawName = match[2];
                } else if (pattern === patterns[3]) {
                    rawName = match[1];
                    quantity = match[2];
                    rawUnit = match[3];
                }
                
                if (quantity && rawName) {
                    processMatch(quantity, rawUnit, rawName, trimmed);
                    matched = true;
                    break;
                }
            }
        }
        
        function processMatch(quantity, rawUnit, rawName, original) {
            // Convert special fractions to decimals
            quantity = quantity.replace(/½/g, '0.5').replace(/¼/g, '0.25').replace(/⅓/g, '0.33').replace(/⅔/g, '0.67');
            
            // Clean name: remove parentheses, trim
            const cleanName = cleanIngredientName(rawName)
                .replace(/\([^)]*\)/g, '')
                .replace(/^\s+|\s+$/g, '')
                .trim()
                .toLowerCase();
            
            // Skip invalid names
            if (cleanName.length < 2 || cleanName.length > 100) return;
            
            // Normalize unit
            const normalizedUnit = normalizeUnit(rawUnit.toLowerCase()) || rawUnit || 'pc';
            
            // Deduplication key
            const key = `${quantity}-${normalizedUnit}-${cleanName}`.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            
            // Push ingredient
            ingredients.push({
                name: cleanName,
                quantity: quantity || null,
                unit: normalizedUnit,
                section: currentSection,
                rawUnit: rawUnit,
                original: original,
                matched: !!normalizedUnit
            });
        }
    }
    
    return ingredients;
};


module.exports = { extractIngredientsFromText };