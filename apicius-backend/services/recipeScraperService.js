const axios = require('axios');
const cheerio = require('cheerio');
const { generateRecipeWithLLM } = require('./videoToRecipeService');

// ==================== DOMAIN REGISTRY ====================
// Map domains to their extraction handlers
const DOMAIN_HANDLERS = {
  '750g.com': extract750gRecipe,
  'marmiton.org': extractMarmitonRecipe,
  'allrecipes.com': extractAllRecipesRecipe,
  'seriouseats.com': extractSeriousEatsRecipe,
  'pinchofyum.com': extractPinchOfYumRecipe,
  'default': extractGenericRecipe,
};

// ==================== UTILITY FUNCTIONS ====================

const normalizeUnit = (unit) => {
  if (!unit) return null;
  
  const unitMap = {
    // Volume (English & French)
    'ml': 'ml', 'milliliter': 'ml', 'millilitre': 'ml', 'ml': 'ml',
    'l': 'l', 'liter': 'l', 'litre': 'l', 'litres': 'l',
    'cup': 'cup', 'cups': 'cup', 'tasse': 'cup', 'tasses': 'cup',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'c. à s.': 'tbsp', 'cuillère à soupe': 'tbsp', 'c.à.s': 'tbsp',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'c. à t.': 'tsp', 'cuillère à thé': 'tsp', 'c.à.t': 'tsp',
    // Weight
    'g': 'g', 'gram': 'g', 'grams': 'g', 'gramme': 'g', 'grammes': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg', 'kilogramme': 'kg', 'kilogrammes': 'kg',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
    // Quantity
    'pc': 'pc', 'piece': 'pc', 'pcs': 'pc', 'unité': 'pc',
    'doz': 'doz', 'dozen': 'doz',
    'pinch': 'pinch', 'pincée': 'pinch', 'prise': 'pinch',
    'dash': 'dash', 'trait': 'dash',
  };
  
  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || normalized;
};

/**
 * Parse quantity (handles fractions, decimals, ranges)
 * Examples: "1 1/2", "2", "3-4", "1.5"
 */
const parseQuantity = (str) => {
  if (!str) return null;
  
  // Remove extra whitespace
  str = str.trim();
  
  // Handle vulgar fractions (½, ¼, etc.)
  const fractionMap = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
  Object.entries(fractionMap).forEach(([vulgar, standard]) => {
    str = str.replace(vulgar, standard);
  });
  
  // Parse ranges like "3-4" → take lower bound, or "3–4"
  const rangeMatch = str.match(/^([\d.\/\s]+)\s*[-–]\s*([\d.\/\s]+)$/);
  if (rangeMatch) {
    str = rangeMatch[1].trim(); // Use lower bound
  }
  
  // Convert fractions to decimal or keep as string
  const fractionRegex = /^(\d+)\s+(\d+)\/(\d+)$/;
  const fractionMatch = str.match(fractionRegex);
  if (fractionMatch) {
    const whole = parseInt(fractionMatch[1], 10);
    const num = parseInt(fractionMatch[2], 10);
    const denom = parseInt(fractionMatch[3], 10);
    return ((whole * denom + num) / denom).toString();
  }
  
  // Simple fraction like "1/2"
  const simpleFraction = /^(\d+)\/(\d+)$/.exec(str);
  if (simpleFraction) {
    const num = parseInt(simpleFraction[1], 10);
    const denom = parseInt(simpleFraction[2], 10);
    return (num / denom).toString();
  }
  
  // Decimal or plain number
  const numMatch = str.match(/^([\d.]+)/);
  return numMatch ? numMatch[1] : str;
};

/**
 * Parse a single ingredient line (e.g., "1 1/2 cups all-purpose flour")
 * Returns: { name, quantity, unit, section }
 */
const parseIngredientLine = (line, section = null) => {
  if (!line) return null;
  
  line = line.trim();
  if (!line) return null;
  
  // Remove common prefixes/annotations
  line = line.replace(/^[\s•\-*]\s*/, ''); // Remove bullets, dashes, etc.
  
  // Try to extract quantity + unit
  const match = line.match(/^([\d.\/\s½¼¾⅓⅔⅛⅜⅝⅞\-–]+)\s*(.+)/);
  
  if (match) {
    const quantityStr = match[1].trim();
    const remainder = match[2].trim();
    
    // Split remainder into unit + name
    const words = remainder.split(/\s+/);
    let unit = null;
    let name = remainder;
    
    if (words.length > 1) {
      const possibleUnit = words[0].toLowerCase();
      if (normalizeUnit(possibleUnit)) {
        unit = normalizeUnit(words.shift());
        name = words.join(' ');
      }
    }
    
    return {
      name: name.trim(),
      quantity: parseQuantity(quantityStr),
      unit: unit,
      section: section || 'Main',
    };
  }
  
  // No quantity detected, ingredient name only
  return {
    name: line,
    quantity: null,
    unit: null,
    section: section || 'Main',
  };
};

/**
 * Clean HTML and extract text
 */
const cleanText = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
};

// ==================== DOMAIN-SPECIFIC EXTRACTORS ====================

/**
 * Extract recipe from 750g.com
 */
async function extract750gRecipe(html, url) {
  const $ = cheerio.load(html);
  
  return {
    title: cleanText($('h1').first().text()) || 'Untitled Recipe',
    description: cleanText($('.recipe-tagline, .subtitle').first().text()) || null,
    portions: parseInt(
      cleanText($('section:contains("Ingrédients") .portion, input[type="number"]').first().val() || '4')
    ) || 4,
    prep_time: parseInt(
      cleanText($(':contains("Préparation :")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    cook_time: parseInt(
      cleanText($(':contains("Cuisson :")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    difficulty: cleanText(
      $('.difficulty-label, [class*="difficulty"]').first().text()
    ) || null,
    course_type: inferCourseType($, url, 'Dessert'), // Infer from breadcrumbs
    meal_type: 'Dessert',
    cuisine_type: 'French',
    ingredients: parseIngredients750g($),
    steps: parseSteps750g($),
  };
}

function parseIngredients750g($) {
  const ingredients = [];
  $('section:contains("Ingrédients") li, section:contains("Ingrédients") .ingredient-line').each((i, el) => {
    const line = cleanText($(el).text());
    const ingredient = parseIngredientLine(line);
    if (ingredient) ingredients.push(ingredient);
  });
  return ingredients;
}

function parseSteps750g($) {
  const steps = [];
  $('section:contains("Préparation") li, section:contains("Préparation") .step-line').each((i, el) => {
    const instruction = cleanText($(el).text());
    if (instruction) {
      steps.push({
        section: 'Prepare',
        step_number: i + 1,
        instruction,
        duration_minutes: null,
        sub_steps: [],
      });
    }
  });
  return steps;
}

/**
 * Extract recipe from Marmiton.org
 */
async function extractMarmitonRecipe(html, url) {
  const $ = cheerio.load(html);
  
  return {
    title: cleanText($('h1').first().text()) || 'Untitled Recipe',
    description: null,
    portions: parseInt(
      cleanText($('input.recipe-ingredients__qt-counter__value').val() || '4')
    ) || 4,
    prep_time: parseInt(
      cleanText($(':contains("Préparation :")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    cook_time: parseInt(
      cleanText($(':contains("Cuisson :")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    difficulty: inferDifficulty($),
    course_type: inferCourseType($, url, null),
    meal_type: null,
    cuisine_type: null,
    ingredients: parseIngredientsMarmiton($),
    steps: parseStepsMarmiton($),
  };
}

function parseIngredientsMarmiton($) {
  const ingredients = [];
  $('section:contains("Ingrédients") li, section:contains("Ingrédients") label').each((i, el) => {
    const line = cleanText($(el).text());
    const ingredient = parseIngredientLine(line);
    if (ingredient) ingredients.push(ingredient);
  });
  return ingredients;
}

function parseStepsMarmiton($) {
  const steps = [];
  $('section:contains("Préparation") li, section:contains("Préparation") [class*="step"]').each((i, el) => {
    const instruction = cleanText($(el).text());
    if (instruction) {
      steps.push({
        section: 'Prepare',
        step_number: i + 1,
        instruction,
        duration_minutes: null,
        sub_steps: [],
      });
    }
  });
  return steps;
}

/**
 * Extract recipe from AllRecipes.com
 */
async function extractAllRecipesRecipe(html, url) {
  const $ = cheerio.load(html);
  
  const title = cleanText($('h1').first().text()) || 'Untitled Recipe';
  const description = cleanText($('[class*="description"]').first().text()) || null;
  
  const prepTime = parseInt(
    cleanText($(':contains("Prep Time:")').text()).match(/(\d+)/) ?.[1] || '0'
  );
  const cookTime = parseInt(
    cleanText($(':contains("Cook Time:")').text()).match(/(\d+)/) ?.[1] || '0'
  );
  const totalTime = prepTime + cookTime;
  
  return {
    title,
    description,
    portions: parseInt(
      cleanText($(':contains("Servings:")').text()).match(/(\d+)/) ?.[1] || '8'
    ) || 8,
    prep_time: prepTime,
    cook_time: cookTime,
    total_time: totalTime,
    difficulty: null, // AllRecipes doesn't provide difficulty
    course_type: inferCourseType($, url, 'Dessert'),
    meal_type: null,
    cuisine_type: inferCuisineFromBreadcrumb($),
    ingredients: parseIngredientsAllRecipes($),
    steps: parseStepsAllRecipes($),
  };
}

function parseIngredientsAllRecipes($) {
  const ingredients = [];
  $('[class*="ingredient"] li, [class*="ingredient"] div').each((i, el) => {
    const line = cleanText($(el).text());
    if (line && line.length > 0) {
      const ingredient = parseIngredientLine(line);
      if (ingredient) ingredients.push(ingredient);
    }
  });
  return ingredients;
}

function parseStepsAllRecipes($) {
  const steps = [];
  $('[class*="direction"] li, [class*="instruction"] li').each((i, el) => {
    const instruction = cleanText($(el).text());
    if (instruction) {
      steps.push({
        section: 'Prepare',
        step_number: i + 1,
        instruction,
        duration_minutes: null,
        sub_steps: [],
      });
    }
  });
  return steps;
}

/**
 * Extract recipe from SeriousEats.com
 */
async function extractSeriousEatsRecipe(html, url) {
  const $ = cheerio.load(html);
  
  return {
    title: cleanText($('h1').first().text()) || 'Untitled Recipe',
    description: cleanText($('[class*="description"], article > p').first().text()) || null,
    portions: parseInt(
      cleanText($(':contains("Serves")').text()).match(/(\d+)/) ?.[1] || '12'
    ) || 12,
    prep_time: parseInt(
      cleanText($(':contains("Prep")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    cook_time: parseInt(
      cleanText($(':contains("Cook")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    difficulty: inferDifficulty($),
    course_type: inferCourseType($, url, 'Dessert'),
    meal_type: null,
    cuisine_type: 'American',
    ingredients: parseIngredientsSeriousEats($),
    steps: parseStepsSeriousEats($),
  };
}

function parseIngredientsSeriousEats($) {
  const ingredients = [];
  let currentSection = null;
  
  $('[class*="ingredient"]').each((i, el) => {
    const text = cleanText($(el).text());
    
    // Check if it's a section header
    if ($(el).is('h3, h4, [class*="heading"]')) {
      currentSection = text;
      return;
    }
    
    if (text && text.length > 0) {
      const ingredient = parseIngredientLine(text, currentSection);
      if (ingredient) ingredients.push(ingredient);
    }
  });
  
  return ingredients;
}

function parseStepsSeriousEats($) {
  const steps = [];
  let currentSection = null;
  
  $('[class*="instruction"]').each((i, el) => {
    const text = cleanText($(el).text());
    
    // Check if it's a section header
    if ($(el).is('h3, h4, [class*="heading"]')) {
      currentSection = text;
      return;
    }
    
    if (text && text.length > 0) {
      steps.push({
        section: currentSection || 'Prepare',
        step_number: steps.filter(s => s.section === (currentSection || 'Prepare')).length + 1,
        instruction: text,
        duration_minutes: null,
        sub_steps: [],
      });
    }
  });
  
  return steps;
}

/**
 * Extract recipe from PinchOfYum.com
 */
async function extractPinchOfYumRecipe(html, url) {
  const $ = cheerio.load(html);
  
  return {
    title: cleanText($('h1').first().text()) || 'Untitled Recipe',
    description: cleanText($('[class*="description"]').first().text()) || null,
    portions: parseInt(
      cleanText($(':contains("Yield:")').text()).match(/(\d+)/) ?.[1] || '8'
    ) || 8,
    prep_time: parseInt(
      cleanText($(':contains("Prep Time:")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    cook_time: parseInt(
      cleanText($(':contains("Cook Time:")').text()).match(/(\d+)/) ?.[1] || '0'
    ),
    difficulty: null,
    course_type: inferCourseType($, url, 'Dessert'),
    meal_type: null,
    cuisine_type: 'American',
    ingredients: parseIngredientsPinchOfYum($),
    steps: parseStepsPinchOfYum($),
  };
}

function parseIngredientsPinchOfYum($) {
  const ingredients = [];
  let currentSection = null;
  
  $('[class*="ingredient"] li, [class*="ingredient"] label').each((i, el) => {
    const text = cleanText($(el).text());
    
    // Check if it's a section header (bold text)
    if ($(el).is('strong, [class*="heading"], h3, h4')) {
      currentSection = text;
      return;
    }
    
    if (text && text.length > 0) {
      const ingredient = parseIngredientLine(text, currentSection);
      if (ingredient) ingredients.push(ingredient);
    }
  });
  
  return ingredients;
}

function parseStepsPinchOfYum($) {
  const steps = [];
  $('[class*="instruction"] li, [class*="direction"] li').each((i, el) => {
    const instruction = cleanText($(el).text());
    if (instruction) {
      steps.push({
        section: 'Prepare',
        step_number: i + 1,
        instruction,
        duration_minutes: null,
        sub_steps: [],
      });
    }
  });
  return steps;
}

/**
 * Generic fallback extractor for unknown sites
 * Uses generic selectors and LLM enhancement
 */
async function extractGenericRecipe(html, url) {
  const $ = cheerio.load(html);
  
  const recipe = {
    title: cleanText($('h1').first().text()) || cleanText($('title').text()) || 'Untitled Recipe',
    description: cleanText($('meta[name="description"]').attr('content') || $('[class*="description"]').first().text()) || null,
    portions: 4,
    prep_time: 0,
    cook_time: 0,
    total_time: 0,
    difficulty: null,
    course_type: null,
    meal_type: null,
    cuisine_type: null,
    ingredients: extractGenericIngredients($),
    steps: extractGenericSteps($),
  };
  
  // Try to enhance with LLM if insufficient data
  if (recipe.ingredients.length < 3 || recipe.steps.length < 2) {
    try {
      const htmlText = cleanText($('body').html()).substring(0, 4000);
      const enhanced = await generateRecipeWithLLM(htmlText);
      
      return {
        ...recipe,
        ...enhanced,
      };
    } catch (error) {
      console.warn('⚠️ LLM enhancement failed for generic extraction:', error.message);
    }
  }
  
  return recipe;
}

function extractGenericIngredients($) {
  const ingredients = [];
  const selectors = [
    'ul:contains("Ingredient") li',
    'ol:contains("Ingredient") li',
    '[class*="ingredient"] li',
    '[id*="ingredient"] li',
  ];
  
  for (const selector of selectors) {
    $(selector).each((i, el) => {
      const line = cleanText($(el).text());
      if (line && line.length > 10) {
        const ingredient = parseIngredientLine(line);
        if (ingredient && !ingredients.some(ing => ing.name === ingredient.name)) {
          ingredients.push(ingredient);
        }
      }
    });
    
    if (ingredients.length > 0) break;
  }
  
  return ingredients;
}

function extractGenericSteps($) {
  const steps = [];
  const selectors = [
    'ol:contains("Direction") li',
    'ol:contains("Instruction") li',
    '[class*="instruction"] li',
    '[class*="direction"] li',
  ];
  
  for (const selector of selectors) {
    $(selector).each((i, el) => {
      const instruction = cleanText($(el).text());
      if (instruction && instruction.length > 10) {
        steps.push({
          section: 'Prepare',
          step_number: i + 1,
          instruction,
          duration_minutes: null,
          sub_steps: [],
        });
      }
    });
    
    if (steps.length > 0) break;
  }
  
  return steps;
}

// ==================== HELPER FUNCTIONS ====================

function inferCourseType($, url, fallback = null) {
  const breadcrumbs = cleanText($('[class*="breadcrumb"]').text()).toLowerCase();
  const urlLower = url.toLowerCase();
  
  const courseMap = {
    'appetizer|starter|entrée|appetisers': 'Appetizer',
    'main|plat|course|meat|chicken|fish': 'Main Course',
    'dessert|sweet|cake|cookie|brownie|pie': 'Dessert',
    'snack|appetizer': 'Snack',
    'beverage|drink|smoothie': 'Beverage',
  };
  
  for (const [patterns, course] of Object.entries(courseMap)) {
    const regex = new RegExp(patterns, 'i');
    if (regex.test(breadcrumbs) || regex.test(urlLower)) {
      return course;
    }
  }
  
  return fallback;
}

function inferCuisineFromBreadcrumb($) {
  const breadcrumbs = cleanText($('[class*="breadcrumb"]').text()).toLowerCase();
  
  const cuisines = [
    'italian', 'french', 'chinese', 'indian', 'mexican', 'thai', 'spanish',
    'greek', 'korean', 'japanese', 'vietnamese', 'moroccan', 'indian', 'american',
  ];
  
  for (const cuisine of cuisines) {
    if (breadcrumbs.includes(cuisine)) {
      return cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
    }
  }
  
  return null;
}

function inferDifficulty($) {
  const text = cleanText($('body').text()).toLowerCase();
  
  if (/very\s+easy|tres\s+facile|très\s+facile/.test(text)) return 'Very Easy';
  if (/easy|facile|simple/.test(text)) return 'Easy';
  if (/medium|moyen|intermediate/.test(text)) return 'Medium';
  if (/hard|difficult|difficile|avancé/.test(text)) return 'Hard';
  
  return null;
}

// ==================== MAIN EXTRACTOR ====================

/**
 * Extract recipe from any URL
 * Automatically detects site type and applies appropriate handler
 */
async function extractRecipeFromURL(url) {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }
    
    console.log(`🌐 Extracting recipe from: ${url}`);
    
    // Fetch the page
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    
    const html = response.data;
    
    // Determine domain
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    console.log(`📍 Detected domain: ${domain}`);
    
    // Find matching handler
    const handler = DOMAIN_HANDLERS[domain] || DOMAIN_HANDLERS.default;
    console.log(`🔍 Using handler: ${handler.name}`);
    
    // Extract recipe
    const recipe = await handler(html, url);
    
    // Validate recipe
    if (!recipe.title || recipe.ingredients.length === 0) {
      throw new Error('Failed to extract sufficient recipe data from page');
    }
    
    console.log(`✅ Recipe extracted: "${recipe.title}" with ${recipe.ingredients.length} ingredients and ${recipe.steps.length} steps`);
    
    return {
      success: true,
      recipe,
      source_url: url,
      extracted_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`❌ Error extracting recipe from ${url}:`, error.message);
    
    return {
      success: false,
      error: error.message,
      source_url: url,
    };
  }
}

module.exports = {
  extractRecipeFromURL,
  parseIngredientLine,
  normalizeUnit,
  parseQuantity,
  cleanText,
};