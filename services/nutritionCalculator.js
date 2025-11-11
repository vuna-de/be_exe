const { Meal } = require('../models/Nutrition');
const { NutritionCalculator } = require('../models/Personalization');

class NutritionCalculatorService {
  constructor() {
    this.macroRatios = {
      weight_loss: { protein: 0.3, carbs: 0.4, fat: 0.3 },
      muscle_gain: { protein: 0.35, carbs: 0.45, fat: 0.2 },
      maintenance: { protein: 0.25, carbs: 0.5, fat: 0.25 },
      performance: { protein: 0.3, carbs: 0.5, fat: 0.2 },
      health: { protein: 0.25, carbs: 0.45, fat: 0.3 }
    };

    this.activityMultipliers = {
      sedentary: 1.2,
      lightly_active: 1.375,
      moderately_active: 1.55,
      very_active: 1.725,
      extremely_active: 1.9
    };
  }

  // Main method to calculate personalized nutrition
  async calculatePersonalizedNutrition(userId, bodyComposition, goals, preferences) {
    try {
      // Calculate BMR and TDEE
      const bmr = this.calculateBMR(bodyComposition);
      const tdee = this.calculateTDEE(bmr, bodyComposition.activityLevel);
      
      // Calculate target calories based on goals
      const targetCalories = this.calculateTargetCalories(tdee, goals);
      
      // Calculate macronutrients
      const macros = this.calculateMacros(targetCalories, goals, bodyComposition);
      
      // Calculate meal distribution
      const mealPlan = this.calculateMealDistribution(targetCalories, macros, preferences);
      
      // Generate weekly meal plan
      const weeklyPlan = await this.generateWeeklyMealPlan(mealPlan, preferences);
      
      // Save or update nutrition calculator
      const nutritionData = {
        user: userId,
        bodyComposition,
        goals,
        calculatedMacros: {
          bmr,
          tdee,
          calories: {
            maintenance: tdee,
            target: targetCalories,
            deficit: Math.max(0, tdee - targetCalories),
            surplus: Math.max(0, targetCalories - tdee)
          },
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          fiber: this.calculateFiber(bodyComposition),
          water: this.calculateWater(bodyComposition)
        },
        mealPlan: {
          mealsPerDay: preferences.mealFrequency || 3,
          mealTiming: mealPlan.mealTiming,
          weeklyPlan
        },
        restrictions: preferences.restrictions || {},
        preferences: preferences.foodPreferences || {},
        isActive: true,
        lastUpdated: new Date()
      };

      // Update or create nutrition calculator
      await NutritionCalculator.findOneAndUpdate(
        { user: userId },
        nutritionData,
        { upsert: true, new: true }
      );

      return nutritionData;
    } catch (error) {
      console.error('Error calculating personalized nutrition:', error);
      throw error;
    }
  }

  // Calculate Basal Metabolic Rate (BMR) using Mifflin-St Jeor Equation
  calculateBMR(bodyComposition) {
    const { weight, height, age, gender } = bodyComposition;
    
    if (gender === 'male') {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
  }

  // Calculate Total Daily Energy Expenditure (TDEE)
  calculateTDEE(bmr, activityLevel) {
    const multiplier = this.activityMultipliers[activityLevel] || 1.55;
    return Math.round(bmr * multiplier);
  }

  // Calculate target calories based on goals
  calculateTargetCalories(tdee, goals) {
    const calorieAdjustments = {
      weight_loss: -500, // 500 calorie deficit
      muscle_gain: 300,  // 300 calorie surplus
      maintenance: 0,
      performance: 200,  // 200 calorie surplus
      health: 0
    };

    const primaryGoal = goals.primary || 'maintenance';
    const adjustment = calorieAdjustments[primaryGoal] || 0;
    
    return Math.max(1200, tdee + adjustment); // Minimum 1200 calories
  }

  // Calculate macronutrients
  calculateMacros(targetCalories, goals, bodyComposition) {
    const primaryGoal = goals.primary || 'maintenance';
    const ratios = this.macroRatios[primaryGoal];
    
    // Adjust ratios based on body composition
    if (bodyComposition.bodyFatPercentage) {
      if (bodyComposition.bodyFatPercentage > 25) {
        ratios.protein = Math.min(0.4, ratios.protein + 0.05);
        ratios.carbs = Math.max(0.35, ratios.carbs - 0.05);
      } else if (bodyComposition.bodyFatPercentage < 15) {
        ratios.carbs = Math.min(0.55, ratios.carbs + 0.05);
        ratios.protein = Math.max(0.25, ratios.protein - 0.05);
      }
    }

    const protein = {
      grams: Math.round((targetCalories * ratios.protein) / 4),
      percentage: Math.round(ratios.protein * 100)
    };

    const carbs = {
      grams: Math.round((targetCalories * ratios.carbs) / 4),
      percentage: Math.round(ratios.carbs * 100)
    };

    const fat = {
      grams: Math.round((targetCalories * ratios.fat) / 9),
      percentage: Math.round(ratios.fat * 100)
    };

    return { protein, carbs, fat };
  }

  // Calculate fiber needs
  calculateFiber(bodyComposition) {
    // 14g fiber per 1000 calories
    const baseFiber = (bodyComposition.weight * 0.5) + 14;
    return {
      grams: Math.round(baseFiber),
      per1000Cal: 14
    };
  }

  // Calculate water needs
  calculateWater(bodyComposition) {
    // 35ml per kg body weight
    const baseWater = bodyComposition.weight * 35;
    return {
      liters: Math.round(baseWater / 1000 * 10) / 10,
      glasses: Math.round(baseWater / 250)
    };
  }

  // Calculate meal distribution
  calculateMealDistribution(targetCalories, macros, preferences) {
    const mealsPerDay = preferences.mealFrequency || 3;
    const mealTiming = [];

    // Standard meal distribution
    const mealDistribution = {
      3: { breakfast: 0.3, lunch: 0.4, dinner: 0.3 },
      4: { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 },
      5: { breakfast: 0.2, lunch: 0.3, dinner: 0.3, snack1: 0.1, snack2: 0.1 },
      6: { breakfast: 0.2, lunch: 0.25, dinner: 0.25, snack1: 0.1, snack2: 0.1, snack3: 0.1 }
    };

    const distribution = mealDistribution[mealsPerDay] || mealDistribution[3];

    Object.entries(distribution).forEach(([mealType, percentage]) => {
      const calories = Math.round(targetCalories * percentage);
      mealTiming.push({
        mealType: this.mapMealType(mealType),
        time: this.getMealTime(mealType),
        calories,
        macros: {
          protein: Math.round(macros.protein.grams * percentage),
          carbs: Math.round(macros.carbs.grams * percentage),
          fat: Math.round(macros.fat.grams * percentage)
        }
      });
    });

    return { mealTiming };
  }

  // Map meal type names
  mapMealType(mealType) {
    const mapping = {
      breakfast: 'breakfast',
      lunch: 'lunch',
      dinner: 'dinner',
      snack: 'snack',
      snack1: 'snack',
      snack2: 'snack',
      snack3: 'snack'
    };
    return mapping[mealType] || 'snack';
  }

  // Get meal time
  getMealTime(mealType) {
    const times = {
      breakfast: '07:00',
      lunch: '12:00',
      dinner: '19:00',
      snack: '15:00',
      snack1: '10:00',
      snack2: '15:00',
      snack3: '21:00'
    };
    return times[mealType] || '12:00';
  }

  // Generate weekly meal plan
  async generateWeeklyMealPlan(mealPlan, preferences) {
    const weeklyPlan = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      const dayPlan = {
        day,
        meals: [],
        totalCalories: 0,
        totalMacros: { protein: 0, carbs: 0, fat: 0 }
      };

      // Generate meals for each meal type
      for (const mealTiming of mealPlan.mealTiming) {
        const meal = await this.selectMealForMealType(mealTiming, preferences);
        if (meal) {
          dayPlan.meals.push(meal._id);
          dayPlan.totalCalories += meal.nutrition.calories;
          dayPlan.totalMacros.protein += meal.nutrition.protein;
          dayPlan.totalMacros.carbs += meal.nutrition.carbs;
          dayPlan.totalMacros.fat += meal.nutrition.fat;
        }
      }

      weeklyPlan.push(dayPlan);
    }

    return weeklyPlan;
  }

  // Select appropriate meal for meal type
  async selectMealForMealType(mealTiming, preferences) {
    const { mealType, calories, macros } = mealTiming;
    
    // Build query filters
    const filters = {
      isActive: true,
      isPublic: true,
      mealType,
      'nutrition.calories': {
        $gte: calories * 0.8, // Allow 20% variance
        $lte: calories * 1.2
      }
    };

    // Add dietary restrictions
    if (preferences.restrictions?.dietary) {
      const dietaryRestrictions = preferences.restrictions.dietary;
      
      // Filter out meals with restricted ingredients
      if (dietaryRestrictions.includes('vegetarian')) {
        filters.tags = { $nin: ['meat', 'chicken', 'beef', 'pork', 'fish'] };
      }
      if (dietaryRestrictions.includes('vegan')) {
        filters.tags = { $nin: ['meat', 'chicken', 'beef', 'pork', 'fish', 'dairy', 'eggs'] };
      }
      if (dietaryRestrictions.includes('gluten_free')) {
        filters.tags = { $nin: ['wheat', 'gluten', 'bread', 'pasta'] };
      }
    }

    // Add cuisine preferences
    if (preferences.preferences?.cuisine?.length > 0) {
      filters.cuisine = { $in: preferences.preferences.cuisine };
    }

    // Find matching meals
    const meals = await Meal.find(filters).limit(10);
    
    if (meals.length === 0) {
      // Fallback to any meal of the right type
      const fallbackMeals = await Meal.find({
        isActive: true,
        isPublic: true,
        mealType
      }).limit(5);
      
      return fallbackMeals[Math.floor(Math.random() * fallbackMeals.length)];
    }

    // Score meals based on macro match
    const scoredMeals = meals.map(meal => {
      const proteinDiff = Math.abs(meal.nutrition.protein - macros.protein);
      const carbsDiff = Math.abs(meal.nutrition.carbs - macros.carbs);
      const fatDiff = Math.abs(meal.nutrition.fat - macros.fat);
      const caloriesDiff = Math.abs(meal.nutrition.calories - calories);
      
      const score = 100 - (proteinDiff + carbsDiff + fatDiff + caloriesDiff / 10);
      return { meal, score };
    });

    // Sort by score and return best match
    scoredMeals.sort((a, b) => b.score - a.score);
    return scoredMeals[0]?.meal;
  }

  // Get nutrition recommendations
  async getNutritionRecommendations(userId) {
    try {
      const nutritionData = await NutritionCalculator.findOne({ 
        user: userId, 
        isActive: true 
      });

      if (!nutritionData) {
        return { recommendations: [], tips: [] };
      }

      const recommendations = [];
      const tips = [];

      // Analyze current nutrition vs targets
      const { calculatedMacros, goals } = nutritionData;
      
      // Protein recommendations
      if (calculatedMacros.protein.grams < calculatedMacros.protein.grams * 0.9) {
        recommendations.push({
          type: 'protein',
          message: 'Tăng lượng protein để đạt mục tiêu',
          suggestion: 'Thêm thịt nạc, cá, trứng hoặc đậu phụ vào bữa ăn'
        });
      }

      // Hydration recommendations
      if (calculatedMacros.water.liters < 2) {
        recommendations.push({
          type: 'hydration',
          message: 'Tăng lượng nước uống',
          suggestion: 'Uống ít nhất 8 ly nước mỗi ngày'
        });
      }

      // Meal timing recommendations
      if (nutritionData.mealPlan.mealsPerDay < 3) {
        recommendations.push({
          type: 'meal_frequency',
          message: 'Tăng số bữa ăn trong ngày',
          suggestion: 'Chia nhỏ bữa ăn thành 4-5 bữa để tăng cường trao đổi chất'
        });
      }

      // Goal-specific tips
      if (goals.primary === 'weight_loss') {
        tips.push('Ăn nhiều rau xanh và protein để cảm thấy no lâu hơn');
        tips.push('Tránh đồ uống có đường và thức ăn chế biến sẵn');
        tips.push('Uống nước trước bữa ăn để giảm cảm giác đói');
      } else if (goals.primary === 'muscle_gain') {
        tips.push('Ăn protein trong vòng 30 phút sau khi tập');
        tips.push('Tăng lượng carbs để cung cấp năng lượng cho tập luyện');
        tips.push('Không bỏ bữa sáng - bữa ăn quan trọng nhất trong ngày');
      }

      return { recommendations, tips };
    } catch (error) {
      console.error('Error getting nutrition recommendations:', error);
      throw error;
    }
  }

  // Track nutrition progress
  async trackNutritionProgress(userId, date, meals) {
    try {
      const nutritionData = await NutritionCalculator.findOne({ 
        user: userId, 
        isActive: true 
      });

      if (!nutritionData) {
        throw new Error('Nutrition calculator not found');
      }

      // Calculate actual nutrition for the day
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;

      for (const meal of meals) {
        if (meal.meal && meal.meal.nutrition) {
          const multiplier = meal.servings || 1;
          totalCalories += meal.meal.nutrition.calories * multiplier;
          totalProtein += meal.meal.nutrition.protein * multiplier;
          totalCarbs += meal.meal.nutrition.carbs * multiplier;
          totalFat += meal.meal.nutrition.fat * multiplier;
        }
      }

      // Calculate progress percentages
      const progress = {
        calories: {
          actual: totalCalories,
          target: nutritionData.calculatedMacros.calories.target,
          percentage: Math.round((totalCalories / nutritionData.calculatedMacros.calories.target) * 100)
        },
        protein: {
          actual: totalProtein,
          target: nutritionData.calculatedMacros.protein.grams,
          percentage: Math.round((totalProtein / nutritionData.calculatedMacros.protein.grams) * 100)
        },
        carbs: {
          actual: totalCarbs,
          target: nutritionData.calculatedMacros.carbs.grams,
          percentage: Math.round((totalCarbs / nutritionData.calculatedMacros.carbs.grams) * 100)
        },
        fat: {
          actual: totalFat,
          target: nutritionData.calculatedMacros.fat.grams,
          percentage: Math.round((totalFat / nutritionData.calculatedMacros.fat.grams) * 100)
        }
      };

      return progress;
    } catch (error) {
      console.error('Error tracking nutrition progress:', error);
      throw error;
    }
  }

  // Get nutrition insights
  async getNutritionInsights(userId, period = 'week') {
    try {
      // This would typically query a nutrition tracking collection
      // For now, return mock insights
      return {
        averageCalories: 2000,
        averageProtein: 150,
        averageCarbs: 250,
        averageFat: 80,
        consistency: 0.85,
        trends: {
          calories: 'stable',
          protein: 'increasing',
          carbs: 'decreasing',
          fat: 'stable'
        },
        recommendations: [
          'Tăng lượng protein vào bữa sáng',
          'Giảm carbs vào buổi tối',
          'Thêm rau xanh vào bữa trưa'
        ]
      };
    } catch (error) {
      console.error('Error getting nutrition insights:', error);
      throw error;
    }
  }
}

module.exports = new NutritionCalculatorService();
