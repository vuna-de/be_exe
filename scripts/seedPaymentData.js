const mongoose = require('mongoose');
const { SubscriptionPlan, Coupon } = require('../models/Payment');
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

// Tạo subscription plans mẫu
const createSubscriptionPlans = async () => {
  const plans = [
    {
      name: 'Gói Cơ bản',
      description: 'Gói phù hợp cho người mới bắt đầu tập luyện',
      type: 'monthly',
      price: 99000,
      originalPrice: 149000,
      currency: 'VND',
      duration: 30,
      features: [
        { name: 'Truy cập thư viện bài tập', description: 'Hơn 100 bài tập cơ bản', included: true },
        { name: 'Tạo kế hoạch tập luyện', description: 'Tối đa 3 kế hoạch', included: true },
        { name: 'Theo dõi tiến độ', description: 'Ghi nhận và phân tích tiến độ', included: true },
        { name: 'Hỗ trợ cộng đồng', description: 'Tham gia cộng đồng người dùng', included: true },
        { name: 'Tư vấn dinh dưỡng cơ bản', description: 'Gợi ý thực đơn đơn giản', included: true },
        { name: 'Hỗ trợ 24/7', description: 'Hỗ trợ qua email', included: false },
        { name: 'Huấn luyện viên cá nhân', description: '1-1 với huấn luyện viên', included: false }
      ],
      isActive: true,
      isPopular: false,
      sortOrder: 1,
      metadata: {
        maxWorkouts: 3,
        maxMealPlans: 2,
        maxTrainers: 0,
        prioritySupport: false,
        customBranding: false
      }
    },
    {
      name: 'Gói Premium',
      description: 'Gói phổ biến nhất với đầy đủ tính năng',
      type: 'monthly',
      price: 199000,
      originalPrice: 299000,
      currency: 'VND',
      duration: 30,
      features: [
        { name: 'Truy cập thư viện bài tập', description: 'Hơn 500 bài tập đa dạng', included: true },
        { name: 'Tạo kế hoạch tập luyện', description: 'Không giới hạn kế hoạch', included: true },
        { name: 'Theo dõi tiến độ nâng cao', description: 'Phân tích chi tiết và báo cáo', included: true },
        { name: 'Hỗ trợ cộng đồng', description: 'Tham gia cộng đồng Premium', included: true },
        { name: 'Tư vấn dinh dưỡng chuyên sâu', description: 'Kế hoạch dinh dưỡng cá nhân hóa', included: true },
        { name: 'Hỗ trợ 24/7', description: 'Hỗ trợ qua chat và email', included: true },
        { name: 'Huấn luyện viên cá nhân', description: '2 buổi tư vấn/tháng', included: true },
        { name: 'Video hướng dẫn HD', description: 'Video chất lượng cao', included: true },
        { name: 'Xuất báo cáo PDF', description: 'Xuất báo cáo tiến độ', included: true }
      ],
      isActive: true,
      isPopular: true,
      sortOrder: 2,
      metadata: {
        maxWorkouts: -1,
        maxMealPlans: -1,
        maxTrainers: 2,
        prioritySupport: true,
        customBranding: false
      }
    },
    {
      name: 'Gói Pro',
      description: 'Gói cao cấp dành cho người tập chuyên nghiệp',
      type: 'monthly',
      price: 399000,
      originalPrice: 499000,
      currency: 'VND',
      duration: 30,
      features: [
        { name: 'Truy cập thư viện bài tập', description: 'Hơn 1000 bài tập chuyên nghiệp', included: true },
        { name: 'Tạo kế hoạch tập luyện', description: 'Không giới hạn + AI tối ưu', included: true },
        { name: 'Theo dõi tiến độ chuyên sâu', description: 'Phân tích AI và dự đoán', included: true },
        { name: 'Hỗ trợ cộng đồng', description: 'Cộng đồng Pro độc quyền', included: true },
        { name: 'Tư vấn dinh dưỡng chuyên sâu', description: 'Kế hoạch dinh dưỡng AI', included: true },
        { name: 'Hỗ trợ 24/7', description: 'Hỗ trợ ưu tiên qua nhiều kênh', included: true },
        { name: 'Huấn luyện viên cá nhân', description: 'Không giới hạn tư vấn', included: true },
        { name: 'Video hướng dẫn 4K', description: 'Video chất lượng 4K', included: true },
        { name: 'Xuất báo cáo PDF', description: 'Báo cáo chuyên nghiệp', included: true },
        { name: 'Tích hợp thiết bị', description: 'Kết nối với thiết bị thông minh', included: true },
        { name: 'API riêng', description: 'Truy cập API cho phát triển', included: true },
        { name: 'White-label', description: 'Tùy chỉnh giao diện', included: true }
      ],
      isActive: true,
      isPopular: false,
      sortOrder: 3,
      metadata: {
        maxWorkouts: -1,
        maxMealPlans: -1,
        maxTrainers: -1,
        prioritySupport: true,
        customBranding: true
      }
    },
    {
      name: 'Gói Năm',
      description: 'Gói tiết kiệm cho người dùng lâu dài',
      type: 'yearly',
      price: 1990000,
      originalPrice: 2390000,
      currency: 'VND',
      duration: 365,
      features: [
        { name: 'Tất cả tính năng Premium', description: 'Đầy đủ tính năng Premium', included: true },
        { name: 'Tiết kiệm 17%', description: 'Tiết kiệm so với gói tháng', included: true },
        { name: 'Ưu đãi đặc biệt', description: 'Các ưu đãi độc quyền', included: true },
        { name: 'Hỗ trợ ưu tiên', description: 'Hỗ trợ ưu tiên cao nhất', included: true }
      ],
      isActive: true,
      isPopular: false,
      sortOrder: 4,
      metadata: {
        maxWorkouts: -1,
        maxMealPlans: -1,
        maxTrainers: -1,
        prioritySupport: true,
        customBranding: false
      }
    }
  ];

  try {
    await SubscriptionPlan.insertMany(plans);
    console.log('✅ Subscription plans created');
    return plans;
  } catch (error) {
    console.error('Error creating subscription plans:', error);
  }
};

// Tạo coupons mẫu
const createCoupons = async (adminUser) => {
  const coupons = [
    {
      code: 'WELCOME20',
      name: 'Chào mừng 20%',
      description: 'Giảm 20% cho người dùng mới',
      type: 'percentage',
      value: 20,
      maxDiscountAmount: 100000,
      minOrderAmount: 50000,
      usageLimit: 1000,
      userLimit: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 năm
      isActive: true,
      isPublic: true,
      createdBy: adminUser._id
    },
    {
      code: 'SUMMER50K',
      name: 'Hè 2024 - 50K',
      description: 'Giảm 50,000 VND cho mùa hè',
      type: 'fixed_amount',
      value: 50000,
      maxDiscountAmount: 50000,
      minOrderAmount: 100000,
      usageLimit: 500,
      userLimit: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 tháng
      isActive: true,
      isPublic: true,
      createdBy: adminUser._id
    },
    {
      code: 'PREMIUM30',
      name: 'Premium 30%',
      description: 'Giảm 30% cho gói Premium',
      type: 'percentage',
      value: 30,
      maxDiscountAmount: 200000,
      minOrderAmount: 150000,
      usageLimit: 200,
      userLimit: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 2 tháng
      isActive: true,
      isPublic: true,
      createdBy: adminUser._id
    },
    {
      code: 'FIRSTMONTH',
      name: 'Tháng đầu miễn phí',
      description: 'Dùng thử miễn phí tháng đầu tiên',
      type: 'free_trial',
      value: 100,
      usageLimit: 100,
      userLimit: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 tháng
      isActive: true,
      isPublic: true,
      createdBy: adminUser._id
    },
    {
      code: 'VIP2024',
      name: 'VIP 2024',
      description: 'Giảm 25% cho gói Pro',
      type: 'percentage',
      value: 25,
      maxDiscountAmount: 300000,
      minOrderAmount: 300000,
      usageLimit: 50,
      userLimit: 1,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 tháng
      isActive: true,
      isPublic: false, // Coupon riêng tư
      createdBy: adminUser._id
    }
  ];

  try {
    await Coupon.insertMany(coupons);
    console.log('✅ Coupons created');
    return coupons;
  } catch (error) {
    console.error('Error creating coupons:', error);
  }
};

// Chạy script seed
const seedPaymentDatabase = async () => {
  try {
    await connectDB();
    
    // Xóa dữ liệu cũ
    await SubscriptionPlan.deleteMany({});
    await Coupon.deleteMany({});
    console.log('🗑️ Old payment data cleared');

    // Lấy admin user
    const adminUser = await User.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ Admin user not found. Please run main seed script first.');
      process.exit(1);
    }

    // Tạo dữ liệu mới
    await createSubscriptionPlans();
    await createCoupons(adminUser);

    console.log('🎉 Payment database seeded successfully!');
    console.log('\n📊 Sample payment data created:');
    console.log('- 4 Subscription Plans (Basic, Premium, Pro, Yearly)');
    console.log('- 5 Coupons (Welcome, Summer, Premium, Free Trial, VIP)');
    console.log('- Complete pricing and features');

  } catch (error) {
    console.error('Error seeding payment database:', error);
  } finally {
    process.exit(0);
  }
};

// Chạy script
if (require.main === module) {
  seedPaymentDatabase();
}

module.exports = { seedPaymentDatabase };
