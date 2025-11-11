const mongoose = require('mongoose');
const { Meal, MealPlan, FoodLog } = require('../models/Nutrition');
const User = require('../models/User');

// Kết nối database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-manager');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Tạo meals mẫu
const createSampleMeals = async (trainerUser) => {
  const meals = [
    // BREAKFAST MEALS
    {
      name: 'Yến mạch với chuối và hạt chia',
      description: 'Bữa sáng giàu chất xơ và protein, hoàn hảo cho người muốn giảm cân',
      category: 'weight_loss',
      mealType: 'breakfast',
      cuisine: 'vietnamese',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 10,
      servings: 1,
      ingredients: [
        { name: 'Yến mạch', amount: 50, unit: 'g', calories: 190, protein: 7, carbs: 35, fat: 3, fiber: 5 },
        { name: 'Chuối', amount: 1, unit: 'piece', calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 },
        { name: 'Hạt chia', amount: 15, unit: 'g', calories: 70, protein: 2, carbs: 6, fat: 4, fiber: 5 },
        { name: 'Sữa hạnh nhân', amount: 200, unit: 'ml', calories: 60, protein: 1, carbs: 3, fat: 5, fiber: 1 },
        { name: 'Mật ong', amount: 10, unit: 'g', calories: 30, protein: 0, carbs: 8, fat: 0, fiber: 0 }
      ],
      instructions: [
        'Đun sôi sữa hạnh nhân trong nồi nhỏ',
        'Thêm yến mạch và khuấy đều',
        'Nấu trên lửa nhỏ trong 5-7 phút cho đến khi yến mạch mềm',
        'Thái chuối thành lát mỏng',
        'Cho yến mạch ra bát, thêm chuối và hạt chia',
        'Rưới mật ong lên trên và thưởng thức'
      ],
      nutrition: {
        calories: 455,
        protein: 11,
        carbs: 79,
        fat: 12,
        fiber: 14,
        sugar: 25,
        sodium: 50
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
        publicId: 'oatmeal_banana_chia',
        caption: 'Yến mạch với chuối và hạt chia'
      }],
      tags: ['breakfast', 'healthy', 'fiber', 'protein', 'weight_loss'],
      createdBy: trainerUser._id,
      viewCount: 1250,
      likeCount: 89,
      averageRating: 4.5,
      ratingCount: 23
    },
    {
      name: 'Trứng ốp la với bánh mì đen',
      description: 'Bữa sáng giàu protein, phù hợp cho người muốn tăng cơ',
      category: 'muscle_gain',
      mealType: 'breakfast',
      cuisine: 'vietnamese',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 8,
      servings: 1,
      ingredients: [
        { name: 'Trứng gà', amount: 2, unit: 'piece', calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
        { name: 'Bánh mì đen', amount: 2, unit: 'slice', calories: 160, protein: 6, carbs: 30, fat: 2, fiber: 4 },
        { name: 'Bơ', amount: 10, unit: 'g', calories: 72, protein: 0, carbs: 0, fat: 8, fiber: 0 },
        { name: 'Cà chua', amount: 50, unit: 'g', calories: 9, protein: 0, carbs: 2, fat: 0, fiber: 1 },
        { name: 'Rau xà lách', amount: 30, unit: 'g', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1 }
      ],
      instructions: [
        'Làm nóng chảo với một ít dầu',
        'Đập trứng vào chảo, nêm muối và tiêu',
        'Nấu trứng theo ý thích (lòng đào hoặc chín)',
        'Nướng bánh mì đen cho giòn',
        'Phết bơ lên bánh mì',
        'Xếp trứng, cà chua và rau xà lách lên bánh mì',
        'Thưởng thức ngay khi còn nóng'
      ],
      nutrition: {
        calories: 386,
        protein: 18,
        carbs: 34,
        fat: 20,
        fiber: 6,
        sugar: 3,
        sodium: 400
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&h=600&fit=crop',
        publicId: 'scrambled_eggs_bread',
        caption: 'Trứng ốp la với bánh mì đen'
      }],
      tags: ['breakfast', 'protein', 'muscle_gain', 'eggs', 'healthy'],
      createdBy: trainerUser._id,
      viewCount: 2100,
      likeCount: 156,
      averageRating: 4.7,
      ratingCount: 45
    },

    // LUNCH MEALS
    {
      name: 'Salad gà nướng với rau củ',
      description: 'Bữa trưa cân bằng dinh dưỡng, giàu protein và vitamin',
      category: 'maintenance',
      mealType: 'lunch',
      cuisine: 'western',
      difficulty: 'medium',
      prepTime: 15,
      cookTime: 20,
      servings: 2,
      ingredients: [
        { name: 'Ức gà', amount: 200, unit: 'g', calories: 330, protein: 62, carbs: 0, fat: 7, fiber: 0 },
        { name: 'Rau xà lách', amount: 100, unit: 'g', calories: 15, protein: 1, carbs: 3, fat: 0, fiber: 2 },
        { name: 'Cà chua bi', amount: 100, unit: 'g', calories: 18, protein: 1, carbs: 4, fat: 0, fiber: 1 },
        { name: 'Dưa chuột', amount: 100, unit: 'g', calories: 16, protein: 1, carbs: 4, fat: 0, fiber: 1 },
        { name: 'Dầu olive', amount: 15, unit: 'ml', calories: 120, protein: 0, carbs: 0, fat: 14, fiber: 0 },
        { name: 'Chanh', amount: 1, unit: 'piece', calories: 20, protein: 0, carbs: 6, fat: 0, fiber: 2 }
      ],
      instructions: [
        'Ướp ức gà với muối, tiêu, tỏi băm và dầu olive',
        'Nướng gà trong lò 200°C trong 15-20 phút',
        'Để gà nguội và thái thành miếng vừa ăn',
        'Rửa sạch và cắt nhỏ các loại rau',
        'Trộn dầu olive với nước cốt chanh, muối và tiêu',
        'Xếp rau vào đĩa, thêm gà và rưới nước sốt',
        'Thưởng thức ngay'
      ],
      nutrition: {
        calories: 619,
        protein: 64,
        carbs: 17,
        fat: 21,
        fiber: 6,
        sugar: 10,
        sodium: 200
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=800&h=600&fit=crop',
        publicId: 'grilled_chicken_salad',
        caption: 'Salad gà nướng với rau củ'
      }],
      tags: ['lunch', 'salad', 'protein', 'healthy', 'low_carb'],
      createdBy: trainerUser._id,
      viewCount: 1800,
      likeCount: 134,
      averageRating: 4.6,
      ratingCount: 38
    },
    {
      name: 'Cơm gà nướng mật ong',
      description: 'Món ăn truyền thống Việt Nam với cách chế biến lành mạnh',
      category: 'muscle_gain',
      mealType: 'lunch',
      cuisine: 'vietnamese',
      difficulty: 'medium',
      prepTime: 20,
      cookTime: 30,
      servings: 2,
      ingredients: [
        { name: 'Gạo lứt', amount: 150, unit: 'g', calories: 540, protein: 12, carbs: 112, fat: 4, fiber: 4 },
        { name: 'Đùi gà', amount: 300, unit: 'g', calories: 450, protein: 54, carbs: 0, fat: 24, fiber: 0 },
        { name: 'Mật ong', amount: 30, unit: 'g', calories: 90, protein: 0, carbs: 24, fat: 0, fiber: 0 },
        { name: 'Tỏi', amount: 20, unit: 'g', calories: 30, protein: 1, carbs: 7, fat: 0, fiber: 0 },
        { name: 'Gừng', amount: 10, unit: 'g', calories: 8, protein: 0, carbs: 2, fat: 0, fiber: 0 },
        { name: 'Nước tương', amount: 30, unit: 'ml', calories: 15, protein: 2, carbs: 3, fat: 0, fiber: 0 }
      ],
      instructions: [
        'Nấu gạo lứt theo hướng dẫn trên bao bì',
        'Ướp gà với mật ong, tỏi băm, gừng băm và nước tương',
        'Để ướp ít nhất 30 phút',
        'Nướng gà trong lò 180°C trong 25-30 phút',
        'Lật gà một lần trong quá trình nướng',
        'Kiểm tra gà chín bằng cách chọc đũa',
        'Thưởng thức với cơm gạo lứt'
      ],
      nutrition: {
        calories: 1133,
        protein: 69,
        carbs: 148,
        fat: 28,
        fiber: 4,
        sugar: 24,
        sodium: 800
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&h=600&fit=crop',
        publicId: 'honey_glazed_chicken_rice',
        caption: 'Cơm gà nướng mật ong'
      }],
      tags: ['lunch', 'vietnamese', 'protein', 'muscle_gain', 'rice'],
      createdBy: trainerUser._id,
      viewCount: 1650,
      likeCount: 98,
      averageRating: 4.4,
      ratingCount: 28
    },

    // DINNER MEALS
    {
      name: 'Cá hồi nướng với rau củ',
      description: 'Bữa tối giàu omega-3 và protein chất lượng cao',
      category: 'muscle_gain',
      mealType: 'dinner',
      cuisine: 'western',
      difficulty: 'easy',
      prepTime: 10,
      cookTime: 25,
      servings: 2,
      ingredients: [
        { name: 'Cá hồi', amount: 300, unit: 'g', calories: 420, protein: 45, carbs: 0, fat: 24, fiber: 0 },
        { name: 'Bông cải xanh', amount: 200, unit: 'g', calories: 68, protein: 6, carbs: 14, fat: 1, fiber: 6 },
        { name: 'Cà rốt', amount: 150, unit: 'g', calories: 62, protein: 1, carbs: 15, fat: 0, fiber: 4 },
        { name: 'Khoai tây', amount: 200, unit: 'g', calories: 164, protein: 4, carbs: 37, fat: 0, fiber: 4 },
        { name: 'Dầu olive', amount: 20, unit: 'ml', calories: 160, protein: 0, carbs: 0, fat: 18, fiber: 0 },
        { name: 'Chanh', amount: 1, unit: 'piece', calories: 20, protein: 0, carbs: 6, fat: 0, fiber: 2 }
      ],
      instructions: [
        'Làm nóng lò ở 200°C',
        'Rửa sạch và cắt nhỏ các loại rau củ',
        'Xếp rau củ vào khay nướng, rưới dầu olive',
        'Nêm muối, tiêu và nướng trong 15 phút',
        'Ướp cá hồi với muối, tiêu và nước cốt chanh',
        'Đặt cá lên rau củ và nướng thêm 10-12 phút',
        'Kiểm tra cá chín và thưởng thức'
      ],
      nutrition: {
        calories: 894,
        protein: 56,
        carbs: 72,
        fat: 43,
        fiber: 16,
        sugar: 21,
        sodium: 300
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop',
        publicId: 'baked_salmon_vegetables',
        caption: 'Cá hồi nướng với rau củ'
      }],
      tags: ['dinner', 'salmon', 'omega3', 'protein', 'healthy'],
      createdBy: trainerUser._id,
      viewCount: 1950,
      likeCount: 145,
      averageRating: 4.6,
      ratingCount: 35
    },
    {
      name: 'Phở bò tái',
      description: 'Món phở truyền thống với thịt bò tái, phù hợp cho người muốn tăng cơ',
      category: 'muscle_gain',
      mealType: 'dinner',
      cuisine: 'vietnamese',
      difficulty: 'hard',
      prepTime: 60,
      cookTime: 120,
      servings: 4,
      ingredients: [
        { name: 'Bánh phở', amount: 400, unit: 'g', calories: 440, protein: 12, carbs: 88, fat: 4, fiber: 4 },
        { name: 'Thịt bò tái', amount: 200, unit: 'g', calories: 300, protein: 36, carbs: 0, fat: 16, fiber: 0 },
        { name: 'Xương bò', amount: 500, unit: 'g', calories: 200, protein: 20, carbs: 0, fat: 12, fiber: 0 },
        { name: 'Hành tây', amount: 100, unit: 'g', calories: 40, protein: 1, carbs: 9, fat: 0, fiber: 2 },
        { name: 'Gừng', amount: 20, unit: 'g', calories: 16, protein: 0, carbs: 4, fat: 0, fiber: 0 },
        { name: 'Hành lá', amount: 50, unit: 'g', calories: 16, protein: 1, carbs: 3, fat: 0, fiber: 1 },
        { name: 'Rau thơm', amount: 30, unit: 'g', calories: 8, protein: 1, carbs: 2, fat: 0, fiber: 1 }
      ],
      instructions: [
        'Rửa sạch xương bò và chần qua nước sôi',
        'Ninh xương với hành tây, gừng trong 2 giờ',
        'Lọc nước dùng và nêm gia vị',
        'Thái mỏng thịt bò tái',
        'Trần bánh phở trong nước sôi',
        'Xếp phở vào tô, thêm thịt bò',
        'Rưới nước dùng nóng và trang trí với hành lá, rau thơm'
      ],
      nutrition: {
        calories: 1020,
        protein: 70,
        carbs: 106,
        fat: 32,
        fiber: 8,
        sugar: 18,
        sodium: 1200
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&h=600&fit=crop',
        publicId: 'pho_bo_tai',
        caption: 'Phở bò tái'
      }],
      tags: ['dinner', 'vietnamese', 'pho', 'beef', 'protein'],
      createdBy: trainerUser._id,
      viewCount: 3200,
      likeCount: 234,
      averageRating: 4.7,
      ratingCount: 58
    },

    // SNACK MEALS
    {
      name: 'Smoothie protein chuối dâu',
      description: 'Đồ uống bổ sung protein sau tập luyện, giúp phục hồi cơ bắp',
      category: 'muscle_gain',
      mealType: 'snack',
      cuisine: 'western',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 1,
      servings: 1,
      ingredients: [
        { name: 'Chuối', amount: 1, unit: 'piece', calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 },
        { name: 'Dâu tây', amount: 100, unit: 'g', calories: 32, protein: 1, carbs: 8, fat: 0, fiber: 2 },
        { name: 'Whey protein', amount: 30, unit: 'g', calories: 120, protein: 24, carbs: 2, fat: 1, fiber: 0 },
        { name: 'Sữa hạnh nhân', amount: 250, unit: 'ml', calories: 75, protein: 1, carbs: 4, fat: 6, fiber: 1 },
        { name: 'Hạt chia', amount: 10, unit: 'g', calories: 47, protein: 2, carbs: 4, fat: 3, fiber: 3 }
      ],
      instructions: [
        'Cắt chuối thành lát nhỏ',
        'Rửa sạch dâu tây',
        'Cho tất cả nguyên liệu vào máy xay sinh tố',
        'Xay trong 1-2 phút cho đến khi mịn',
        'Thêm đá viên nếu muốn uống lạnh',
        'Đổ ra ly và thưởng thức ngay'
      ],
      nutrition: {
        calories: 379,
        protein: 29,
        carbs: 45,
        fat: 10,
        fiber: 9,
        sugar: 35,
        sodium: 50
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&h=600&fit=crop',
        publicId: 'protein_smoothie',
        caption: 'Smoothie protein chuối dâu'
      }],
      tags: ['snack', 'smoothie', 'protein', 'post_workout', 'healthy'],
      createdBy: trainerUser._id,
      viewCount: 2800,
      likeCount: 201,
      averageRating: 4.8,
      ratingCount: 52
    },
    {
      name: 'Yogurt Hy Lạp với quả mọng',
      description: 'Món ăn nhẹ giàu protein và chất chống oxy hóa',
      category: 'weight_loss',
      mealType: 'snack',
      cuisine: 'western',
      difficulty: 'easy',
      prepTime: 5,
      cookTime: 1,
      servings: 1,
      ingredients: [
        { name: 'Yogurt Hy Lạp', amount: 200, unit: 'g', calories: 130, protein: 20, carbs: 8, fat: 0, fiber: 0 },
        { name: 'Quả việt quất', amount: 50, unit: 'g', calories: 29, protein: 0, carbs: 7, fat: 0, fiber: 2 },
        { name: 'Quả mâm xôi', amount: 50, unit: 'g', calories: 26, protein: 1, carbs: 6, fat: 0, fiber: 4 },
        { name: 'Hạt óc chó', amount: 15, unit: 'g', calories: 98, protein: 2, carbs: 2, fat: 10, fiber: 1 },
        { name: 'Mật ong', amount: 5, unit: 'g', calories: 15, protein: 0, carbs: 4, fat: 0, fiber: 0 }
      ],
      instructions: [
        'Cho yogurt Hy Lạp vào bát',
        'Rửa sạch các loại quả mọng',
        'Xếp quả mọng lên trên yogurt',
        'Rắc hạt óc chó lên trên',
        'Rưới một chút mật ong',
        'Thưởng thức ngay hoặc để lạnh'
      ],
      nutrition: {
        calories: 298,
        protein: 23,
        carbs: 27,
        fat: 10,
        fiber: 7,
        sugar: 19,
        sodium: 50
      },
      images: [{
        url: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&h=600&fit=crop',
        publicId: 'greek_yogurt_berries',
        caption: 'Yogurt Hy Lạp với quả mọng'
      }],
      tags: ['snack', 'yogurt', 'berries', 'protein', 'antioxidants'],
      createdBy: trainerUser._id,
      viewCount: 1780,
      likeCount: 123,
      averageRating: 4.4,
      ratingCount: 31
    }
  ];

  try {
    const createdMeals = await Meal.insertMany(meals);
    console.log('✅ Sample meals created');
    return createdMeals;
  } catch (error) {
    console.error('Error creating meals:', error);
  }
};

// Tạo meal plans mẫu
const createSampleMealPlans = async (normalUser, trainerUser, meals) => {
  if (!meals || meals.length === 0) {
    console.error('❌ No meals found to create meal plans');
    return [];
  }
  
  console.log('📋 Available meals:', meals.map(m => ({ name: m.name, _id: m._id })));
  const mealPlans = [
    {
      name: 'Kế hoạch Giảm cân - 7 ngày',
      description: 'Thực đơn cân bằng dinh dưỡng cho người muốn giảm cân an toàn',
      user: normalUser._id,
      nutritionist: trainerUser._id,
      goal: 'weight_loss',
      duration: 7,
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      dailyMeals: [
        {
          date: new Date(),
          meals: [
            { mealType: 'breakfast', meal: meals[0]._id, servings: 1 },
            { mealType: 'lunch', meal: meals[2]._id, servings: 1 },
            { mealType: 'dinner', meal: meals[4]._id, servings: 1 },
            { mealType: 'snack', meal: meals[7]._id, servings: 1 }
          ]
        }
      ],
      isTemplate: true,
      isPublic: true,
      tags: ['weight_loss', 'healthy', 'balanced']
    },
    {
      name: 'Kế hoạch Tăng cơ - 14 ngày',
      description: 'Thực đơn giàu protein cho người muốn tăng cơ bắp',
      user: normalUser._id,
      nutritionist: trainerUser._id,
      goal: 'muscle_gain',
      duration: 14,
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      dailyMeals: [
        {
          date: new Date(),
          meals: [
            { mealType: 'breakfast', meal: meals[1]._id, servings: 1 },
            { mealType: 'lunch', meal: meals[3]._id, servings: 1 },
            { mealType: 'dinner', meal: meals[5]._id, servings: 1 },
            { mealType: 'snack', meal: meals[6]._id, servings: 1 }
          ]
        }
      ],
      isTemplate: true,
      isPublic: true,
      tags: ['muscle_gain', 'protein', 'high_calorie']
    }
  ];

  try {
    await MealPlan.insertMany(mealPlans);
    console.log('✅ Sample meal plans created');
    return mealPlans;
  } catch (error) {
    console.error('Error creating meal plans:', error);
  }
};

// Chạy script seed
const seedNutritionDatabase = async () => {
  try {
    await connectDB();
    
    // Xóa dữ liệu cũ
    await Meal.deleteMany({});
    await MealPlan.deleteMany({});
    await FoodLog.deleteMany({});
    console.log('🗑️ Old nutrition data cleared');

    // Lấy users đã có
    const trainerUser = await User.findOne({ role: 'trainer' });
    const normalUser = await User.findOne({ role: 'user' });

    if (!trainerUser || !normalUser) {
      console.error('❌ Users not found. Please run main seed script first.');
      process.exit(1);
    }

    // Tạo dữ liệu mới
    const meals = await createSampleMeals(trainerUser);
    await createSampleMealPlans(normalUser, trainerUser, meals);

    console.log('🎉 Nutrition database seeded successfully!');
    console.log('\n📊 Sample nutrition data created:');
    console.log('- 8 Meals (Breakfast, Lunch, Dinner, Snacks)');
    console.log('- 2 Meal Plans (Weight Loss, Muscle Gain)');
    console.log('- Vietnamese & Western cuisines');
    console.log('- Complete nutrition information');

  } catch (error) {
    console.error('Error seeding nutrition database:', error);
  } finally {
    process.exit(0);
  }
};

// Chạy script
if (require.main === module) {
  seedNutritionDatabase();
}

module.exports = { seedNutritionDatabase };
