const mongoose = require('mongoose');
const { PTClient, ClientProgress, ClientPlan, PTStats } = require('../models/PTDashboard');
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

// Tạo PT user nếu chưa có
const createPTUser = async () => {
  let pt = await User.findOne({ role: 'trainer' });
  if (!pt) {
    pt = new User({
      fullName: 'Personal Trainer',
      email: 'pt@gymmanager.com',
      password: 'pt123456',
      role: 'trainer',
      isEmailVerified: true,
      membershipType: 'premium'
    });
    await pt.save();
    console.log('PT user created');
  }
  return pt;
};

// Tạo client users nếu chưa có
const createClientUsers = async () => {
  const clients = [];
  const clientData = [
    {
      fullName: 'Nguyễn Văn A',
      email: 'client1@gymmanager.com',
      password: 'client123456',
      role: 'user',
      membershipType: 'premium',
      height: 175,
      weight: 70
    },
    {
      fullName: 'Trần Thị B',
      email: 'client2@gymmanager.com',
      password: 'client123456',
      role: 'user',
      membershipType: 'premium',
      height: 160,
      weight: 55
    },
    {
      fullName: 'Lê Văn C',
      email: 'client3@gymmanager.com',
      password: 'client123456',
      role: 'user',
      membershipType: 'premium',
      height: 180,
      weight: 80
    }
  ];

  for (const data of clientData) {
    let client = await User.findOne({ email: data.email });
    if (!client) {
      client = new User(data);
      await client.save();
      clients.push(client);
    } else {
      clients.push(client);
    }
  }

  return clients;
};

// Tạo PT-Client connections
const createPTConnections = async (pt, clients) => {
  const connections = [];
  
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const existingConnection = await PTClient.findOne({ pt: pt._id, client: client._id });
    
    if (!existingConnection) {
      const goals = ['weight_loss', 'muscle_gain', 'endurance', 'strength', 'flexibility', 'general_fitness'];
      const randomGoals = goals.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
      
      const connection = new PTClient({
        pt: pt._id,
        client: client._id,
        status: i === 0 ? 'active' : (i === 1 ? 'pending' : 'active'),
        goals: randomGoals,
        notes: `Khách hàng ${i + 1} - Mục tiêu: ${randomGoals.join(', ')}`
      });
      
      await connection.save();
      connections.push(connection);
    } else {
      connections.push(existingConnection);
    }
  }
  
  return connections;
};

// Tạo client progress data
const createClientProgress = async (connections) => {
  const progressData = [];
  
  for (const connection of connections) {
    // Tạo progress data cho 30 ngày gần đây
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Chỉ tạo progress cho 70% số ngày (ngẫu nhiên)
      if (Math.random() < 0.7) {
        const baseWeight = connection.client.weight || 70;
        const weightVariation = (Math.random() - 0.5) * 2; // ±1kg variation
        const currentWeight = Math.max(50, baseWeight + weightVariation);
        
        const moods = ['excellent', 'good', 'average', 'poor', 'terrible'];
        const energies = ['high', 'medium', 'low'];
        
        const progress = new ClientProgress({
          ptClient: connection._id,
          client: connection.client._id,
          date: date,
          weight: parseFloat(currentWeight.toFixed(1)),
          bodyFat: parseFloat((Math.random() * 10 + 15).toFixed(1)), // 15-25%
          muscleMass: parseFloat((currentWeight * 0.4 + Math.random() * 5).toFixed(1)),
          measurements: {
            chest: Math.floor(Math.random() * 10 + 90),
            waist: Math.floor(Math.random() * 10 + 70),
            hips: Math.floor(Math.random() * 10 + 90),
            arms: Math.floor(Math.random() * 5 + 25),
            thighs: Math.floor(Math.random() * 10 + 50)
          },
          mood: moods[Math.floor(Math.random() * moods.length)],
          energy: energies[Math.floor(Math.random() * energies.length)],
          sleep: parseFloat((Math.random() * 4 + 6).toFixed(1)), // 6-10 hours
          waterIntake: Math.floor(Math.random() * 1000 + 1500), // 1500-2500ml
          workoutCompleted: Math.random() < 0.8, // 80% completion rate
          workoutNotes: Math.random() < 0.5 ? 'Tập luyện tốt, cần tăng cường độ' : '',
          nutrition: {
            calories: Math.floor(Math.random() * 500 + 1500), // 1500-2000 cal
            protein: Math.floor(Math.random() * 50 + 100), // 100-150g
            carbs: Math.floor(Math.random() * 100 + 150), // 150-250g
            fat: Math.floor(Math.random() * 30 + 50), // 50-80g
            notes: Math.random() < 0.3 ? 'Cần tăng protein' : ''
          }
        });
        
        await progress.save();
        progressData.push(progress);
      }
    }
  }
  
  return progressData;
};

// Tạo client plans
const createClientPlans = async (connections) => {
  const plans = [];
  const planTemplates = [
    {
      type: 'workout',
      title: 'Kế hoạch tập luyện tuần 1',
      description: 'Tập luyện cơ bản cho người mới bắt đầu',
      content: {
        exercises: [
          { name: 'Push-ups', sets: 3, reps: 10, rest: '60s' },
          { name: 'Squats', sets: 3, reps: 15, rest: '60s' },
          { name: 'Plank', sets: 3, reps: '30s', rest: '60s' }
        ],
        schedule: 'Thứ 2, 4, 6 - 45 phút/buổi',
        notes: 'Tập với cường độ vừa phải, nghỉ ngơi đầy đủ'
      },
      priority: 'high'
    },
    {
      type: 'nutrition',
      title: 'Thực đơn giảm cân',
      description: 'Kế hoạch dinh dưỡng 7 ngày',
      content: {
        dailyMeals: {
          breakfast: 'Yến mạch + chuối + sữa hạnh nhân',
          lunch: 'Salad gà + quinoa + rau xanh',
          dinner: 'Cá hồi + rau củ nướng',
          snack: 'Hạt chia + nước dừa'
        },
        calories: 1500,
        macros: { protein: 120, carbs: 150, fat: 50 }
      },
      priority: 'medium'
    },
    {
      type: 'general',
      title: 'Lịch kiểm tra tiến độ',
      description: 'Hẹn gặp để đánh giá tiến độ',
      content: {
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        duration: '30 phút',
        location: 'Phòng tập Gymnet',
        agenda: ['Kiểm tra cân nặng', 'Đo chỉ số cơ thể', 'Đánh giá kế hoạch tập luyện']
      },
      priority: 'high'
    }
  ];
  
  for (const connection of connections) {
    // Tạo 2-4 plans cho mỗi client
    const numPlans = Math.floor(Math.random() * 3) + 2;
    
    for (let i = 0; i < numPlans; i++) {
      const template = planTemplates[Math.floor(Math.random() * planTemplates.length)];
      const plan = new ClientPlan({
        ptClient: connection._id,
        client: connection.client._id,
        type: template.type,
        title: template.title,
        description: template.description,
        content: template.content,
        priority: template.priority,
        dueDate: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000), // 0-14 days
        status: Math.random() < 0.7 ? 'sent' : (Math.random() < 0.5 ? 'received' : 'in_progress'),
        isRead: Math.random() < 0.8,
        readAt: Math.random() < 0.8 ? new Date() : null
      });
      
      await plan.save();
      plans.push(plan);
    }
  }
  
  return plans;
};

// Tạo PT stats
const createPTStats = async (pt, connections, progressData, plans) => {
  const totalClients = connections.length;
  const activeClients = connections.filter(c => c.status === 'active').length;
  const totalSessions = progressData.length;
  const totalPlansSent = plans.length;
  
  const completedWorkouts = progressData.filter(p => p.workoutCompleted).length;
  const avgRating = 4.2 + Math.random() * 0.6; // 4.2-4.8
  
  const stats = new PTStats({
    pt: pt._id,
    totalClients,
    activeClients,
    totalSessions,
    totalPlansSent,
    averageClientRating: parseFloat(avgRating.toFixed(1)),
    totalRatingCount: Math.floor(totalClients * 0.8), // 80% clients rate
    monthlyStats: [
      {
        month: '2024-01',
        newClients: Math.floor(totalClients * 0.3),
        completedSessions: Math.floor(totalSessions * 0.4),
        plansSent: Math.floor(totalPlansSent * 0.3),
        revenue: Math.floor(totalClients * 500000) // 500k per client
      },
      {
        month: '2024-02',
        newClients: Math.floor(totalClients * 0.2),
        completedSessions: Math.floor(totalSessions * 0.3),
        plansSent: Math.floor(totalPlansSent * 0.4),
        revenue: Math.floor(totalClients * 600000)
      }
    ]
  });
  
  await stats.save();
  return stats;
};

// Main function
const seedPTDashboard = async () => {
  try {
    await connectDB();
    
    console.log('Creating PT user...');
    const pt = await createPTUser();
    
    console.log('Creating client users...');
    const clients = await createClientUsers();
    
    console.log('Creating PT-Client connections...');
    const connections = await createPTConnections(pt, clients);
    
    console.log('Creating client progress data...');
    const progressData = await createClientProgress(connections);
    
    console.log('Creating client plans...');
    const plans = await createClientPlans(connections);
    
    console.log('Creating PT stats...');
    const stats = await createPTStats(pt, connections, progressData, plans);
    
    console.log('PT Dashboard seeded successfully!');
    console.log(`Created: ${connections.length} connections, ${progressData.length} progress entries, ${plans.length} plans`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding PT dashboard:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedPTDashboard();
}

module.exports = seedPTDashboard;
