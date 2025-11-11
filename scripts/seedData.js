const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const { WorkoutPlan, WorkoutSession } = require('../models/Workout');
const { Trainer, PTConnection, PTMessage } = require('../models/PT');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

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

// Tạo user mẫu
const createSampleUsers = async () => {
  try {
    // Tạo admin user
    const adminUser = new User({
      email: 'admin@gym.com',
      phone: '0123456789',
      password: await bcrypt.hash('admin123', 12),
      fullName: 'Admin Gym',
      role: 'admin',
      membershipType: 'premium',
      isActive: true,
      isEmailVerified: true,
      totalWorkouts: 0
    });
    await adminUser.save();

    // Tạo trainer user
    const trainerUser = new User({
      email: 'trainer@gym.com',
      phone: '0987654321',
      password: await bcrypt.hash('trainer123', 12),
      fullName: 'Nguyễn Văn Huấn Luyện',
      role: 'trainer',
      membershipType: 'premium',
      isActive: true,
      isEmailVerified: true,
      totalWorkouts: 0
    });
    await trainerUser.save();

    // Tạo user thường
    const normalUser = new User({
      email: 'user@gym.com',
      phone: '0555555555',
      password: await bcrypt.hash('user123', 12),
      fullName: 'Nguyễn Văn Tập',
      dateOfBirth: '1995-05-15',
      gender: 'male',
      height: 175,
      weight: 70,
      fitnessGoal: 'muscle_gain',
      activityLevel: 'moderate',
      role: 'user',
      membershipType: 'basic',
      isActive: true,
      isEmailVerified: true,
      totalWorkouts: 0
    });
    await normalUser.save();

    console.log('✅ Sample users created');
    return { adminUser, trainerUser, normalUser };
  } catch (error) {
    console.error('Error creating users:', error);
  }
};

// Tạo exercises mẫu
const createSampleExercises = async (trainerUser) => {
  const exercises = [
    // CARDIO EXERCISES
    {
      name: 'Burpees',
      description: 'Bài tập toàn thân kết hợp cardio và sức mạnh, đốt cháy calories hiệu quả',
      instructions: [
        'Bắt đầu ở tư thế đứng thẳng',
        'Hạ xuống tư thế squat và đặt tay xuống sàn',
        'Nhảy chân ra sau để vào tư thế plank',
        'Thực hiện một lần chống đẩy',
        'Nhảy chân về tư thế squat',
        'Nhảy lên cao với tay giơ lên trời'
      ],
      category: 'cardio',
      primaryMuscles: ['quads', 'hamstrings', 'glutes', 'chest', 'shoulders', 'triceps'],
      secondaryMuscles: ['core', 'calves'],
      difficulty: 'intermediate',
      type: 'cardio',
      equipment: ['none'],
      images: [{
        url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
        publicId: 'burpees_sample',
        caption: 'Burpees - Bài tập toàn thân'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 12,
      estimatedDuration: 15,
      defaultSets: 1,
      defaultReps: { min: 8, max: 15 },
      createdBy: trainerUser._id,
      tags: ['cardio', 'hiit', 'full_body', 'calorie_burn'],
      viewCount: 1250,
      likeCount: 89,
      averageRating: 4.5,
      ratingCount: 23
    },
    {
      name: 'Mountain Climbers',
      description: 'Bài tập cardio cường độ cao giúp tăng nhịp tim và đốt cháy mỡ thừa',
      instructions: [
        'Bắt đầu ở tư thế plank cao',
        'Giữ cơ thể thẳng từ đầu đến chân',
        'Nhanh chóng đưa đầu gối phải về phía ngực',
        'Trở về tư thế plank',
        'Lặp lại với chân trái',
        'Tiếp tục luân phiên nhanh chóng'
      ],
      category: 'cardio',
      primaryMuscles: ['core', 'shoulders', 'triceps'],
      secondaryMuscles: ['quads', 'hamstrings', 'glutes'],
      difficulty: 'intermediate',
      type: 'cardio',
      equipment: ['none'],
      images: [{
        url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
        publicId: 'mountain_climbers_sample',
        caption: 'Mountain Climbers - Cardio cường độ cao'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 10,
      estimatedDuration: 10,
      defaultSets: 1,
      defaultReps: { min: 20, max: 40 },
      createdBy: trainerUser._id,
      tags: ['cardio', 'hiit', 'core', 'fat_burn'],
      viewCount: 980,
      likeCount: 67,
      averageRating: 4.3,
      ratingCount: 18
    },

    // CHEST EXERCISES
    {
      name: 'Push-ups',
      description: 'Bài tập cơ bản cho ngực, vai và tay sau, không cần thiết bị',
      instructions: [
        'Bắt đầu ở tư thế plank cao',
        'Tay rộng bằng vai, lòng bàn tay úp xuống',
        'Giữ cơ thể thẳng từ đầu đến chân',
        'Hạ thấp ngực xuống gần sàn',
        'Đẩy mạnh lên để trở về vị trí ban đầu',
        'Lặp lại động tác'
      ],
      category: 'chest',
      primaryMuscles: ['chest', 'triceps', 'shoulders'],
      secondaryMuscles: ['core'],
      difficulty: 'beginner',
      type: 'strength',
      equipment: ['none'],
      images: [{
        url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
        publicId: 'pushups_sample',
        caption: 'Push-ups - Bài tập ngực cơ bản'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 6,
      estimatedDuration: 10,
      defaultSets: 3,
      defaultReps: { min: 8, max: 15 },
      createdBy: trainerUser._id,
      tags: ['chest', 'bodyweight', 'beginner', 'strength'],
      viewCount: 2100,
      likeCount: 156,
      averageRating: 4.7,
      ratingCount: 45
    },
    {
      name: 'Dumbbell Chest Press',
      description: 'Bài tập ngực với tạ đơn, phát triển sức mạnh và khối lượng cơ',
      instructions: [
        'Nằm trên ghế tập, tay cầm tạ đơn',
        'Bắt đầu với tạ ở ngang ngực',
        'Đẩy tạ lên cao cho đến khi tay duỗi thẳng',
        'Hạ tạ từ từ xuống ngang ngực',
        'Lặp lại động tác',
        'Giữ kiểm soát trong suốt chuyển động'
      ],
      category: 'chest',
      primaryMuscles: ['chest', 'triceps', 'shoulders'],
      secondaryMuscles: ['core'],
      difficulty: 'intermediate',
      type: 'strength',
      equipment: ['dumbbells', 'bench'],
      images: [{
        url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=600&fit=crop',
        publicId: 'dumbbell_chest_press_sample',
        caption: 'Dumbbell Chest Press - Tăng cơ ngực'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 8,
      estimatedDuration: 15,
      defaultSets: 3,
      defaultReps: { min: 8, max: 12 },
      createdBy: trainerUser._id,
      tags: ['chest', 'dumbbells', 'strength', 'muscle_gain'],
      viewCount: 1800,
      likeCount: 134,
      averageRating: 4.6,
      ratingCount: 38
    },

    // BACK EXERCISES
    {
      name: 'Pull-ups',
      description: 'Bài tập kéo xà cho lưng và tay trước, phát triển sức mạnh thân trên',
      instructions: [
        'Treo người trên xà đơn',
        'Tay rộng hơn vai, lòng bàn tay hướng ra ngoài',
        'Kéo người lên cho đến khi cằm qua xà',
        'Hạ người từ từ xuống vị trí ban đầu',
        'Lặp lại động tác',
        'Giữ cơ thể ổn định'
      ],
      category: 'back',
      primaryMuscles: ['lats', 'biceps', 'rhomboids'],
      secondaryMuscles: ['traps', 'rear_delts', 'core'],
      difficulty: 'advanced',
      type: 'strength',
      equipment: ['pull_up_bar'],
      images: [{
        url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&h=600&fit=crop',
        publicId: 'pullups_sample',
        caption: 'Pull-ups - Phát triển lưng và tay'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 9,
      estimatedDuration: 12,
      defaultSets: 3,
      defaultReps: { min: 3, max: 8 },
      createdBy: trainerUser._id,
      tags: ['back', 'bodyweight', 'advanced', 'strength'],
      viewCount: 1650,
      likeCount: 98,
      averageRating: 4.4,
      ratingCount: 28
    },
    {
      name: 'Bent-over Rows',
      description: 'Bài tập kéo tạ cho lưng, phát triển cơ xô và cơ thoi',
      instructions: [
        'Đứng với chân rộng bằng vai',
        'Cầm tạ đòn, hơi cong đầu gối',
        'Cúi người về phía trước khoảng 45 độ',
        'Kéo tạ lên ngang bụng',
        'Ép chặt xương bả vai lại',
        'Hạ tạ từ từ xuống vị trí ban đầu'
      ],
      category: 'back',
      primaryMuscles: ['lats', 'rhomboids', 'traps'],
      secondaryMuscles: ['biceps', 'rear_delts', 'core'],
      difficulty: 'intermediate',
      type: 'strength',
      equipment: ['barbell'],
      images: [{
        url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=600&fit=crop',
        publicId: 'bent_over_rows_sample',
        caption: 'Bent-over Rows - Phát triển lưng'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 7,
      estimatedDuration: 15,
      defaultSets: 3,
      defaultReps: { min: 8, max: 12 },
      createdBy: trainerUser._id,
      tags: ['back', 'barbell', 'strength', 'posture'],
      viewCount: 1420,
      likeCount: 87,
      averageRating: 4.5,
      ratingCount: 25
    },

    // LEG EXERCISES
    {
      name: 'Squats',
      description: 'Bài tập squat cơ bản cho chân và mông, vua của các bài tập chân',
      instructions: [
        'Đứng với chân rộng bằng vai',
        'Ngón chân hơi hướng ra ngoài',
        'Hạ người xuống như ngồi ghế',
        'Giữ ngực thẳng, đầu gối theo hướng ngón chân',
        'Hạ xuống cho đến khi đùi song song sàn',
        'Đẩy gót chân để đứng lên'
      ],
      category: 'legs',
      primaryMuscles: ['quads', 'glutes', 'hamstrings'],
      secondaryMuscles: ['core', 'calves'],
      difficulty: 'beginner',
      type: 'strength',
      equipment: ['none'],
      images: [{
        url: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&h=600&fit=crop',
        publicId: 'squats_sample',
        caption: 'Squats - Vua của bài tập chân'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 8,
      estimatedDuration: 12,
      defaultSets: 3,
      defaultReps: { min: 10, max: 20 },
      createdBy: trainerUser._id,
      tags: ['legs', 'bodyweight', 'beginner', 'strength'],
      viewCount: 2800,
      likeCount: 201,
      averageRating: 4.8,
      ratingCount: 52
    },
    {
      name: 'Deadlifts',
      description: 'Bài tập nâng tạ từ sàn, tập trung vào lưng và chân, bài tập tổng hợp',
      instructions: [
        'Đứng với chân rộng bằng hông',
        'Tạ đòn ở trước chân, gần ống chân',
        'Cúi người xuống, giữ lưng thẳng',
        'Nắm tạ với tay rộng bằng vai',
        'Đẩy hông về phía sau, hạ tạ xuống',
        'Đẩy hông về phía trước để nâng tạ lên'
      ],
      category: 'legs',
      primaryMuscles: ['hamstrings', 'glutes', 'lower_back'],
      secondaryMuscles: ['traps', 'lats', 'core', 'calves'],
      difficulty: 'advanced',
      type: 'strength',
      equipment: ['barbell'],
      images: [{
        url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=600&fit=crop',
        publicId: 'deadlifts_sample',
        caption: 'Deadlifts - Bài tập tổng hợp'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 10,
      estimatedDuration: 20,
      defaultSets: 3,
      defaultReps: { min: 5, max: 8 },
      createdBy: trainerUser._id,
      tags: ['legs', 'barbell', 'advanced', 'compound'],
      viewCount: 1950,
      likeCount: 145,
      averageRating: 4.6,
      ratingCount: 35
    },

    // CORE EXERCISES
    {
      name: 'Plank',
      description: 'Bài tập plank cho cơ core và ổn định thân, tăng sức mạnh cơ bụng',
      instructions: [
        'Bắt đầu ở tư thế chống đẩy',
        'Hạ xuống khuỷu tay',
        'Giữ cơ thể thẳng từ đầu đến chân',
        'Siết chặt cơ bụng',
        'Giữ tư thế trong thời gian quy định',
        'Hít thở đều đặn'
      ],
      category: 'core',
      primaryMuscles: ['abs', 'core'],
      secondaryMuscles: ['shoulders', 'triceps', 'glutes'],
      difficulty: 'beginner',
      type: 'strength',
      equipment: ['none'],
      images: [{
        url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
        publicId: 'plank_sample',
        caption: 'Plank - Tăng cường cơ core'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 5,
      estimatedDuration: 8,
      defaultSets: 3,
      defaultReps: { min: 30, max: 60 },
      createdBy: trainerUser._id,
      tags: ['core', 'bodyweight', 'beginner', 'stability'],
      viewCount: 3200,
      likeCount: 234,
      averageRating: 4.7,
      ratingCount: 58
    },
    {
      name: 'Russian Twists',
      description: 'Bài tập xoay người cho cơ bụng chéo, tăng cường sức mạnh cơ core',
      instructions: [
        'Ngồi trên sàn, đầu gối cong',
        'Nâng chân lên khỏi sàn',
        'Nghiêng người về phía sau một chút',
        'Xoay thân sang trái, chạm tay xuống sàn',
        'Xoay sang phải, chạm tay xuống sàn',
        'Tiếp tục luân phiên nhanh chóng'
      ],
      category: 'core',
      primaryMuscles: ['obliques', 'abs'],
      secondaryMuscles: ['core'],
      difficulty: 'intermediate',
      type: 'strength',
      equipment: ['none'],
      images: [{
        url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
        publicId: 'russian_twists_sample',
        caption: 'Russian Twists - Cơ bụng chéo'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 6,
      estimatedDuration: 10,
      defaultSets: 3,
      defaultReps: { min: 15, max: 30 },
      createdBy: trainerUser._id,
      tags: ['core', 'bodyweight', 'intermediate', 'obliques'],
      viewCount: 1780,
      likeCount: 123,
      averageRating: 4.4,
      ratingCount: 31
    },

    // SHOULDER EXERCISES
    {
      name: 'Shoulder Press',
      description: 'Bài tập đẩy vai với tạ đơn, phát triển sức mạnh vai',
      instructions: [
        'Ngồi hoặc đứng, cầm tạ đơn',
        'Bắt đầu với tạ ở ngang vai',
        'Đẩy tạ lên cao cho đến khi tay duỗi thẳng',
        'Hạ tạ từ từ xuống ngang vai',
        'Lặp lại động tác',
        'Giữ kiểm soát trong suốt chuyển động'
      ],
      category: 'shoulders',
      primaryMuscles: ['front_delts', 'side_delts'],
      secondaryMuscles: ['triceps', 'core'],
      difficulty: 'intermediate',
      type: 'strength',
      equipment: ['dumbbells'],
      images: [{
        url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=600&fit=crop',
        publicId: 'shoulder_press_sample',
        caption: 'Shoulder Press - Phát triển vai'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 7,
      estimatedDuration: 12,
      defaultSets: 3,
      defaultReps: { min: 8, max: 12 },
      createdBy: trainerUser._id,
      tags: ['shoulders', 'dumbbells', 'strength', 'muscle_gain'],
      viewCount: 1450,
      likeCount: 98,
      averageRating: 4.5,
      ratingCount: 27
    },

    // FLEXIBILITY EXERCISES
    {
      name: 'Downward Dog',
      description: 'Tư thế yoga cơ bản, tăng cường sự linh hoạt và sức mạnh toàn thân',
      instructions: [
        'Bắt đầu ở tư thế bò',
        'Đặt tay rộng bằng vai',
        'Nâng hông lên cao',
        'Duỗi thẳng chân và tay',
        'Tạo hình chữ V ngược',
        'Giữ tư thế và hít thở đều'
      ],
      category: 'flexibility',
      primaryMuscles: ['hamstrings', 'calves', 'shoulders'],
      secondaryMuscles: ['core', 'back'],
      difficulty: 'beginner',
      type: 'flexibility',
      equipment: ['yoga_mat'],
      images: [{
        url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
        publicId: 'downward_dog_sample',
        caption: 'Downward Dog - Yoga cơ bản'
      }],
      videos: [{
        url: 'https://www.youtube.com/watch?v=TU8QYVW0gDU',
        publicId: 'burpees_video',
        title: 'Hướng dẫn Burpees',
        duration: 180
      }],
      caloriesPerMinute: 3,
      estimatedDuration: 5,
      defaultSets: 1,
      defaultReps: { min: 30, max: 60 },
      createdBy: trainerUser._id,
      tags: ['flexibility', 'yoga', 'beginner', 'stretching'],
      viewCount: 2100,
      likeCount: 156,
      averageRating: 4.6,
      ratingCount: 42
    }
  ];

  try {
    const savedExercises = await Exercise.insertMany(exercises);
    console.log('✅ Sample exercises created');
    return savedExercises;
  } catch (error) {
    console.error('Error creating exercises:', error);
  }
};

// Tạo workout plans mẫu
const createSampleWorkoutPlans = async (normalUser, trainerUser, exercises) => {
  const workoutPlans = [
    {
      name: 'Kế hoạch Giảm cân - Người mới bắt đầu',
      description: 'Kế hoạch tập luyện 30 phút mỗi ngày, phù hợp cho người mới bắt đầu muốn giảm cân',
      user: normalUser._id,
      category: 'weight_loss',
      difficulty: 'beginner',
      estimatedDuration: 30,
      frequency: 'daily',
      exercises: [
        {
          exercise: (exercises.find(e => e.name === 'Burpees') || {})._id,
          plannedSets: 1,
          plannedReps: { min: 8, max: 12 },
          plannedDuration: 600, // 10 phút
          restTime: 30,
          order: 1,
          notes: 'Bắt đầu chậm, tăng dần cường độ'
        },
        {
          exercise: (exercises.find(e => e.name === 'Mountain Climbers') || {})._id,
          plannedSets: 1,
          plannedReps: { min: 20, max: 30 },
          plannedDuration: 300, // 5 phút
          restTime: 30,
          order: 2,
          notes: 'Giữ cơ thể thẳng'
        },
        {
          exercise: (exercises.find(e => e.name === 'Squats') || {})._id,
          plannedSets: 3,
          plannedReps: { min: 10, max: 15 },
          plannedWeight: 0,
          restTime: 45,
          order: 3,
          notes: 'Tập trung vào kỹ thuật'
        },
        {
          exercise: (exercises.find(e => e.name === 'Plank') || {})._id,
          plannedSets: 3,
          plannedReps: { min: 30, max: 45 },
          plannedDuration: 300, // 5 phút
          restTime: 30,
          order: 4,
          notes: 'Siết chặt cơ bụng'
        }
      ],
      totalCalories: 250,
      isTemplate: true,
      isPublic: true,
      tags: ['weight_loss', 'beginner', 'cardio', 'fat_burn']
    },
    {
      name: 'Kế hoạch Tăng cơ - Trung cấp',
      description: 'Kế hoạch tập luyện 45 phút, tập trung vào phát triển cơ bắp và sức mạnh',
      user: trainerUser._id,
      trainer: trainerUser._id,
      category: 'muscle_gain',
      difficulty: 'intermediate',
      estimatedDuration: 45,
      frequency: 'every_other_day',
      exercises: [
        {
          exercise: (exercises.find(e => e.name === 'Dumbbell Chest Press') || {})._id,
          plannedSets: 4,
          plannedReps: { min: 8, max: 12 },
          plannedWeight: 15, // kg
          restTime: 90,
          order: 1,
          notes: 'Tăng dần trọng lượng'
        },
        {
          exercise: (exercises.find(e => e.name === 'Bent-over Rows') || {})._id,
          plannedSets: 4,
          plannedReps: { min: 8, max: 12 },
          plannedWeight: 20, // kg
          restTime: 90,
          order: 2,
          notes: 'Giữ lưng thẳng'
        },
        {
          exercise: (exercises.find(e => e.name === 'Squats') || {})._id,
          plannedSets: 4,
          plannedReps: { min: 10, max: 15 },
          plannedWeight: 25, // kg
          restTime: 90,
          order: 3,
          notes: 'Sâu xuống đùi song song sàn'
        },
        {
          exercise: (exercises.find(e => e.name === 'Shoulder Press') || {})._id,
          plannedSets: 3,
          plannedReps: { min: 8, max: 12 },
          plannedWeight: 12, // kg
          restTime: 60,
          order: 4,
          notes: 'Kiểm soát chuyển động'
        },
        {
          exercise: (exercises.find(e => e.name === 'Russian Twists') || {})._id,
          plannedSets: 3,
          plannedReps: { min: 20, max: 30 },
          restTime: 45,
          order: 5,
          notes: 'Xoay từ cơ bụng'
        }
      ],
      totalCalories: 400,
      isTemplate: true,
      isPublic: true,
      tags: ['muscle_gain', 'intermediate', 'strength', 'hypertrophy']
    },
    {
      name: 'Kế hoạch Sức mạnh - Nâng cao',
      description: 'Kế hoạch tập luyện 60 phút cho người có kinh nghiệm, tập trung vào sức mạnh tối đa',
      user: trainerUser._id,
      trainer: trainerUser._id,
      category: 'strength',
      difficulty: 'advanced',
      estimatedDuration: 60,
      frequency: 'weekly',
      exercises: [
        {
          exercise: (exercises.find(e => e.name === 'Deadlifts') || {})._id,
          plannedSets: 5,
          plannedReps: { min: 3, max: 5 },
          plannedWeight: 60, // kg
          restTime: 180,
          order: 1,
          notes: 'Tập trung vào kỹ thuật hoàn hảo'
        },
        {
          exercise: (exercises.find(e => e.name === 'Pull-ups') || {})._id,
          plannedSets: 4,
          plannedReps: { min: 5, max: 8 },
          restTime: 120,
          order: 2,
          notes: 'Kéo từ lưng, không từ tay'
        },
        {
          exercise: (exercises.find(e => e.name === 'Squats') || {})._id,
          plannedSets: 5,
          plannedReps: { min: 5, max: 8 },
          plannedWeight: 50, // kg
          restTime: 180,
          order: 3,
          notes: 'Sâu xuống, đẩy mạnh lên'
        },
        {
          exercise: (exercises.find(e => e.name === 'Push-ups') || {})._id,
          plannedSets: 4,
          plannedReps: { min: 12, max: 20 },
          restTime: 90,
          order: 4,
          notes: 'Chậm và kiểm soát'
        }
      ],
      totalCalories: 500,
      isTemplate: true,
      isPublic: true,
      tags: ['strength', 'advanced', 'compound', 'power']
    }
  ];

  try {
    await WorkoutPlan.insertMany(workoutPlans);
    console.log('✅ Sample workout plans created');
    return workoutPlans;
  } catch (error) {
    console.error('Error creating workout plans:', error);
  }
};

// Tạo PT (Trainer) mẫu và kết nối
const createSampleTrainersAndConnections = async (users) => {
  try {
    // Tạo 2 PT từ admin/trainer user nếu có
    const trainer1 = new Trainer({
      user: users.trainerUser._id,
      specialties: ['strength', 'hypertrophy', 'fat_loss'],
      bio: 'PT 8 năm kinh nghiệm, chuyên tăng cơ và giảm mỡ.',
      rating: 4.9,
      pricePerSession: 300000,
      isActive: true
    });
    await trainer1.save();

    // Kết nối mẫu: user -> trainer1
    const connection = new PTConnection({
      user: users.normalUser._id,
      trainer: trainer1._id,
      status: 'active'
    });
    await connection.save();

    // Tin nhắn mẫu giữa user và PT
    await PTMessage.insertMany([
      { connection: connection._id, senderType: 'user', text: 'Chào PT, mình muốn tăng cơ ngực.', createdAt: new Date(Date.now() - 1000 * 60 * 60) },
      { connection: connection._id, senderType: 'trainer', text: 'Chào bạn! Mình sẽ thiết kế plan cho ngực/đẩy trong 8 tuần.', createdAt: new Date(Date.now() - 1000 * 60 * 50) },
      { connection: connection._id, senderType: 'user', text: 'Tuyệt vời, cảm ơn bạn!', createdAt: new Date(Date.now() - 1000 * 60 * 45) },
    ]);

    console.log('✅ Sample trainers and PT connections created');
    return { trainer1, connection };
  } catch (e) {
    console.error('Error creating trainers/connections:', e);
  }
};

// Phiên tập mẫu gần đây
const createSampleSessions = async (normalUser, plans = []) => {
  const now = new Date();
  const sessions = [
    {
      user: normalUser._id,
      workoutPlan: (plans && plans[0] && plans[0]._id) ? plans[0]._id : undefined,
      name: (plans && plans[0] && plans[0].name) ? plans[0].name : 'Buổi tập',
      startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 45 * 60000),
      status: 'completed',
      exercises: [],
      totalCaloriesBurned: 320,
      totalDuration: 45,
      completionRate: 1
    },
    {
      user: normalUser._id,
      workoutPlan: (plans && plans[1] && plans[1]._id) ? plans[1]._id : undefined,
      name: (plans && plans[1] && plans[1].name) ? plans[1].name : 'Buổi tập',
      startTime: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 + 30 * 60000),
      status: 'completed',
      exercises: [],
      totalCaloriesBurned: 250,
      totalDuration: 30,
      completionRate: 1
    }
  ];
  try {
    await WorkoutSession.insertMany(sessions);
    console.log('✅ Sample workout sessions created');
  } catch (e) {
    console.error('Error creating sessions:', e);
  }
};

// Chạy script seed
const seedDatabase = async () => {
  try {
    await connectDB();
    
    // Xóa dữ liệu cũ
    await Exercise.deleteMany({});
    await WorkoutPlan.deleteMany({});
    await WorkoutSession.deleteMany({});
    await Trainer.deleteMany({});
    await PTConnection.deleteMany({});
    await PTMessage.deleteMany({});
    await User.deleteMany({});
    console.log('🗑️ Old data cleared');

    // Tạo dữ liệu mới
    const users = await createSampleUsers();
    const exercises = await createSampleExercises(users.trainerUser);
    const plans = await createSampleWorkoutPlans(users.normalUser, users.trainerUser, exercises);
    await createSampleTrainersAndConnections(users);
    await createSampleSessions(users.normalUser, plans);

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Sample data created:');
    console.log('- 3 Users (Admin, Trainer, User)');
    console.log('- 12 Exercises (Cardio, Strength, Flexibility)');
    console.log('- 3 Workout Plans (Weight Loss, Muscle Gain, Strength)');
    console.log('- 2 Workout Sessions (recent)');
    console.log('- 1 Trainer & 1 PT connection');
    console.log('\n🔑 Login credentials:');
    console.log('Admin: admin@gym.com / admin123');
    console.log('Trainer: trainer@gym.com / trainer123');
    console.log('User: user@gym.com / user123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    process.exit(0);
  }
};

// Chạy script
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
