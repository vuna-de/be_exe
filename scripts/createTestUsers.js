const mongoose = require('mongoose');
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

// Tạo test users với các membership khác nhau
const createTestUsers = async () => {
  const testUsers = [
    {
      fullName: 'User Basic',
      email: 'basic@test.com',
      password: 'password123',
      role: 'user',
      membershipType: 'basic',
      isEmailVerified: true
    },
    {
      fullName: 'User Premium',
      email: 'premium@test.com',
      password: 'password123',
      role: 'user',
      membershipType: 'premium',
      membershipExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isEmailVerified: true
    },
    {
      fullName: 'User Pro',
      email: 'pro@test.com',
      password: 'password123',
      role: 'user',
      membershipType: 'pro',
      membershipExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isEmailVerified: true
    },
    {
      fullName: 'User Year',
      email: 'year@test.com',
      password: 'password123',
      role: 'user',
      membershipType: 'year',
      membershipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      isEmailVerified: true
    }
  ];

  for (const userData of testUsers) {
    try {
      // Kiểm tra xem user đã tồn tại chưa
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`User ${userData.email} already exists, updating...`);
        await User.findByIdAndUpdate(existingUser._id, userData);
      } else {
        const user = new User(userData);
        await user.save();
        console.log(`Created user: ${userData.email} (${userData.membershipType})`);
      }
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error.message);
    }
  }
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await createTestUsers();
    console.log('Test users created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
