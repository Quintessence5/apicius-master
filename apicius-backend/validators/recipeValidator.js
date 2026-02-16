const { z } = require('zod');

// Define the Recipe schema for runtime validation
const RecipeIngredientSchema = z.object({
  name: z.string().min(1).max(255),
  quantity: z.union([z.number(), z.string(), z.null()]).optional(),
  unit: z.string().max(50).nullable().optional(),
  section: z.string().default('Main').max(100).optional(),
});

const RecipeSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  servings: z.union([z.number(), z.null()]).optional(),
  prep_time: z.union([z.number(), z.null()]).optional(),
  cook_time: z.union([z.number(), z.null()]).optional(),
  total_time: z.union([z.number(), z.null()]).optional(),
  baking_temperature: z.union([z.number(), z.null()]).optional(),
  baking_time: z.union([z.number(), z.null()]).optional(),
  difficulty: z.enum(['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard']).nullable().optional(),
  course_type: z.enum(['Appetizer', 'Main Course', 'Dessert', 'Snack', 'Beverage']).nullable().optional(),
  meal_type: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']).nullable().optional(),
  cuisine_type: z.string().max(100).nullable().optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  steps: z.array(z.union([z.object({
    instruction: z.string(),
    duration_minutes: z.number().nullable().optional()
  }), z.string()])).optional(),
  notes: z.string().max(2000).nullable().optional(),
  source: z.string().max(255).nullable().optional(),
  tags: z.array(z.string()).optional(),
  public: z.boolean().default(false).optional(),
});

module.exports = {
  RecipeSchema,
  RecipeIngredientSchema
};