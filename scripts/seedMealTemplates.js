const mongoose = require('mongoose');
const MealTemplate = require('../models/MealTemplate');
const Meal = require('../models/Nutrition').Meal;
const User = require('../models/User');

// Kết nối database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-manager', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Tạo admin user nếu chưa có
const createAdminUser = async () => {
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = new User({
      fullName: 'Admin User',
      email: 'admin@gymmanager.com',
      password: 'admin123',
      role: 'admin',
      isEmailVerified: true,
      membershipType: 'premium'
    });
    await admin.save();
    console.log('Admin user created');
  }
  return admin;
};

// Tạo meals mẫu nếu chưa có
const createSampleMeals = async (admin) => {
  const meals = [];
  
  // Breakfast meals
  const breakfastMeals = [
    {
      name: 'Yến mạch với chuối và hạt chia',
      description: 'Bữa sáng giàu chất xơ và protein, hoàn hảo cho người giảm cân',
      category: 'weight_loss',
      mealType: 'breakfast',
      cuisine: 'vietnamese',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 10,
      servings: 1,
      ingredients: [
        { name: 'Yến mạch', amount: 50, unit: 'g' },
        { name: 'Chuối', amount: 1, unit: 'piece' },
        { name: 'Hạt chia', amount: 10, unit: 'g' },
        { name: 'Sữa hạnh nhân', amount: 200, unit: 'ml' },
        { name: 'Mật ong', amount: 5, unit: 'ml' }
      ],
      instructions: [
        'Đun sôi sữa hạnh nhân',
        'Thêm yến mạch và nấu 5 phút',
        'Cắt chuối thành lát mỏng',
        'Cho chuối và hạt chia vào bát',
        'Rót yến mạch lên trên và thêm mật ong'
      ],
      nutrition: {
        calories: 350,
        protein: 12,
        carbs: 65,
        fat: 8,
        fiber: 10,
        sugar: 20,
        sodium: 50
      },
      tags: ['healthy', 'fiber', 'protein'],
      isActive: true,
      isPublic: true,
      createdBy: admin._id
    },
    {
      name: 'Trứng ốp la với bánh mì đen',
      description: 'Bữa sáng giàu protein, lý tưởng cho việc tăng cơ',
      category: 'muscle_gain',
      mealType: 'breakfast',
      cuisine: 'vietnamese',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 10,
      servings: 1,
      ingredients: [
        { name: 'Trứng gà', amount: 3, unit: 'piece' },
        { name: 'Bánh mì đen', amount: 2, unit: 'slice' },
        { name: 'Bơ', amount: 10, unit: 'g' },
        { name: 'Rau xanh', amount: 50, unit: 'g' },
        { name: 'Dầu oliu', amount: 5, unit: 'ml' }
      ],
      instructions: [
        'Làm nóng chảo với dầu oliu',
        'Đập trứng vào chảo',
        'Nấu trứng theo ý thích',
        'Nướng bánh mì đen',
        'Phết bơ lên bánh mì',
        'Bày trứng và rau xanh lên bánh mì'
      ],
      nutrition: {
        calories: 420,
        protein: 28,
        carbs: 35,
        fat: 20,
        fiber: 5,
        sugar: 3,
        sodium: 400
      },
      tags: ['protein', 'muscle-gain', 'breakfast'],
      isActive: true,
      isPublic: true
    }
  ];

  // Lunch meals
  const lunchMeals = [
    {
      name: 'Salad gà nướng với quinoa',
      description: 'Bữa trưa cân bằng dinh dưỡng, phù hợp cho mọi mục tiêu',
      category: 'maintenance',
      mealType: 'lunch',
      cuisine: 'western',
      difficulty: 'medium',
      prepTime: 15,
      cookTime: 20,
      servings: 1,
      ingredients: [
        { name: 'Ức gà', amount: 150, unit: 'g' },
        { name: 'Quinoa', amount: 80, unit: 'g' },
        { name: 'Rau xanh', amount: 100, unit: 'g' },
        { name: 'Cà chua', amount: 50, unit: 'g' },
        { name: 'Dưa chuột', amount: 50, unit: 'g' },
        { name: 'Dầu oliu', amount: 10, unit: 'ml' },
        { name: 'Chanh', amount: 0.5, unit: 'piece' }
      ],
      instructions: [
        'Nướng ức gà với gia vị',
        'Nấu quinoa theo hướng dẫn',
        'Rửa và cắt rau xanh',
        'Trộn salad với dầu oliu và chanh',
        'Bày quinoa và gà lên salad'
      ],
      nutrition: {
        calories: 480,
        protein: 35,
        carbs: 45,
        fat: 18,
        fiber: 8,
        sugar: 6,
        sodium: 300
      },
      tags: ['healthy', 'balanced', 'protein'],
      isActive: true,
      isPublic: true
    }
  ];

  // Dinner meals
  const dinnerMeals = [
    {
      name: 'Cá hồi nướng với rau củ',
      description: 'Bữa tối giàu omega-3, tốt cho tim mạch và não bộ',
      category: 'general',
      mealType: 'dinner',
      cuisine: 'western',
      difficulty: 'medium',
      prepTime: 15,
      cookTime: 25,
      servings: 1,
      ingredients: [
        { name: 'Cá hồi', amount: 200, unit: 'g' },
        { name: 'Bông cải xanh', amount: 100, unit: 'g' },
        { name: 'Cà rốt', amount: 80, unit: 'g' },
        { name: 'Khoai tây', amount: 100, unit: 'g' },
        { name: 'Dầu oliu', amount: 15, unit: 'ml' },
        { name: 'Tỏi', amount: 2, unit: 'clove' },
        { name: 'Chanh', amount: 0.5, unit: 'piece' }
      ],
      instructions: [
        'Làm nóng lò ở 200°C',
        'Cắt rau củ thành miếng vừa ăn',
        'Ướp cá hồi với tỏi và chanh',
        'Xếp rau củ và cá lên khay nướng',
        'Nướng 20-25 phút',
        'Rưới dầu oliu lên trên'
      ],
      nutrition: {
        calories: 520,
        protein: 40,
        carbs: 35,
        fat: 25,
        fiber: 6,
        sugar: 8,
        sodium: 200
      },
      tags: ['omega-3', 'healthy', 'dinner'],
      isActive: true,
      isPublic: true
    }
  ];

  // Snack meals
  const snackMeals = [
    {
      name: 'Smoothie protein chuối dâu',
      description: 'Đồ uống giàu protein và vitamin, hoàn hảo sau tập luyện',
      category: 'muscle_gain',
      mealType: 'snack',
      cuisine: 'western',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 0,
      servings: 1,
      ingredients: [
        { name: 'Chuối', amount: 1, unit: 'piece' },
        { name: 'Dâu tây', amount: 100, unit: 'g' },
        { name: 'Whey protein', amount: 30, unit: 'g' },
        { name: 'Sữa hạnh nhân', amount: 250, unit: 'ml' },
        { name: 'Hạt chia', amount: 10, unit: 'g' }
      ],
      instructions: [
        'Cắt chuối và dâu tây',
        'Cho tất cả nguyên liệu vào máy xay',
        'Xay nhuyễn trong 30 giây',
        'Đổ ra ly và thưởng thức'
      ],
      nutrition: {
        calories: 280,
        protein: 25,
        carbs: 35,
        fat: 8,
        fiber: 8,
        sugar: 25,
        sodium: 100
      },
      tags: ['protein', 'post-workout', 'smoothie'],
      isActive: true,
      isPublic: true
    }
  ];

  const allMeals = [...breakfastMeals, ...lunchMeals, ...dinnerMeals, ...snackMeals];
  
  for (const mealData of allMeals) {
    const existingMeal = await Meal.findOne({ name: mealData.name });
    if (!existingMeal) {
      const meal = new Meal({
        ...mealData,
        createdBy: admin._id
      });
      await meal.save();
      meals.push(meal);
    } else {
      meals.push(existingMeal);
    }
  }
  
  return meals;
};

// Tạo meal templates mẫu
const createMealTemplates = async (admin, meals) => {
  const templates = [
    {
      name: 'Thực đơn giảm cân 7 ngày',
      description: 'Thực đơn cân bằng dinh dưỡng giúp giảm cân an toàn và hiệu quả trong 7 ngày',
      goal: 'weight_loss',
      difficulty: 'beginner',
      duration: 7,
      targetCalories: 1500,
      targetProtein: 120,
      targetCarbs: 150,
      targetFat: 50,
      mealsPerDay: 4,
      dailyMeals: [
        {
          day: 1,
          meals: [
            { mealType: 'breakfast', meal: meals[0]._id, servings: 1 },
            { mealType: 'lunch', meal: meals[2]._id, servings: 1 },
            { mealType: 'dinner', meal: meals[3]._id, servings: 0.8 },
            { mealType: 'snack', meal: meals[4]._id, servings: 0.5 }
          ]
        },
        {
          day: 2,
          meals: [
            { mealType: 'breakfast', meal: meals[1]._id, servings: 0.8 },
            { mealType: 'lunch', meal: meals[2]._id, servings: 1 },
            { mealType: 'dinner', meal: meals[3]._id, servings: 0.8 },
            { mealType: 'snack', meal: meals[4]._id, servings: 0.5 }
          ]
        }
      ],
      tags: ['weight-loss', 'healthy', 'balanced'],
      isActive: true,
      isPublic: true,
      createdBy: admin._id
    },
    {
      name: 'Thực đơn tăng cơ 14 ngày',
      description: 'Thực đơn giàu protein và calories giúp tăng cơ bắp hiệu quả trong 14 ngày',
      goal: 'muscle_gain',
      difficulty: 'intermediate',
      duration: 14,
      targetCalories: 2800,
      targetProtein: 200,
      targetCarbs: 300,
      targetFat: 80,
      mealsPerDay: 5,
      dailyMeals: [
        {
          day: 1,
          meals: [
            { mealType: 'breakfast', meal: meals[1]._id, servings: 1.2 },
            { mealType: 'snack', meal: meals[4]._id, servings: 1 },
            { mealType: 'lunch', meal: meals[2]._id, servings: 1.2 },
            { mealType: 'snack', meal: meals[4]._id, servings: 0.8 },
            { mealType: 'dinner', meal: meals[3]._id, servings: 1.2 }
          ]
        }
      ],
      tags: ['muscle-gain', 'protein', 'high-calorie'],
      isActive: true,
      isPublic: true,
      createdBy: admin._id
    },
    {
      name: 'Thực đơn duy trì cân nặng 21 ngày',
      description: 'Thực đơn cân bằng giúp duy trì cân nặng và sức khỏe tốt trong 21 ngày',
      goal: 'maintenance',
      difficulty: 'beginner',
      duration: 21,
      targetCalories: 2000,
      targetProtein: 150,
      targetCarbs: 200,
      targetFat: 70,
      mealsPerDay: 3,
      dailyMeals: [
        {
          day: 1,
          meals: [
            { mealType: 'breakfast', meal: meals[0]._id, servings: 1 },
            { mealType: 'lunch', meal: meals[2]._id, servings: 1 },
            { mealType: 'dinner', meal: meals[3]._id, servings: 1 }
          ]
        }
      ],
      tags: ['maintenance', 'balanced', 'healthy'],
      isActive: true,
      isPublic: true,
      createdBy: admin._id
    },
    {
      name: 'Thực đơn hiệu suất thể thao 30 ngày',
      description: 'Thực đơn tối ưu cho vận động viên và người tập luyện cường độ cao',
      goal: 'performance',
      difficulty: 'advanced',
      duration: 30,
      targetCalories: 3200,
      targetProtein: 180,
      targetCarbs: 400,
      targetFat: 90,
      mealsPerDay: 6,
      dailyMeals: [
        {
          day: 1,
          meals: [
            { mealType: 'breakfast', meal: meals[1]._id, servings: 1.5 },
            { mealType: 'snack', meal: meals[4]._id, servings: 1 },
            { mealType: 'lunch', meal: meals[2]._id, servings: 1.5 },
            { mealType: 'snack', meal: meals[4]._id, servings: 1 },
            { mealType: 'dinner', meal: meals[3]._id, servings: 1.5 },
            { mealType: 'snack', meal: meals[4]._id, servings: 0.8 }
          ]
        }
      ],
      tags: ['performance', 'athlete', 'high-energy'],
      isActive: true,
      isPublic: true,
      createdBy: admin._id
    }
  ];

  for (const templateData of templates) {
    const existingTemplate = await MealTemplate.findOne({ name: templateData.name });
    if (!existingTemplate) {
      const template = new MealTemplate(templateData);
      await template.save();
      console.log(`Created template: ${template.name}`);
    } else {
      console.log(`Template already exists: ${templateData.name}`);
    }
  }
};

// Main function
const seedMealTemplates = async () => {
  try {
    await connectDB();
    
    console.log('Creating admin user...');
    const admin = await createAdminUser();
    
    console.log('Creating sample meals...');
    const meals = await createSampleMeals(admin);
    
    console.log('Creating meal templates...');
    await createMealTemplates(admin, meals);
    
    console.log('Meal templates seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding meal templates:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedMealTemplates();
}

module.exports = seedMealTemplates;
