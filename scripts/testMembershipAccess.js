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

  console.log('Creating test users...');
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

// Test membership access logic
const testMembershipAccess = () => {
  console.log('\n=== Testing Membership Access Logic ===');
  
  const testCases = [
    { membershipType: 'basic', expected: false },
    { membershipType: 'premium', expected: true },
    { membershipType: 'pro', expected: true },
    { membershipType: 'year', expected: true },
    { membershipType: 'annual', expected: true }, // Should be normalized to 'year'
    { membershipType: null, expected: false },
    { membershipType: undefined, expected: false }
  ];

  const allowedMemberships = ['premium', 'pro', 'year'];
  
  testCases.forEach(testCase => {
    const normalized = (testCase.membershipType || '').toLowerCase();
    const aliases = { annual: 'year' };
    const normalizedUser = aliases[normalized] || normalized;
    const allowSet = new Set(allowedMemberships.map(m => (aliases[m] || m).toLowerCase()));
    const hasAccess = allowSet.has(normalizedUser);
    
    const status = hasAccess === testCase.expected ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testCase.membershipType || 'null'} -> ${hasAccess} (expected: ${testCase.expected})`);
  });
};

// Main function
const main = async () => {
  try {
    await connectDB();
    await createTestUsers();
    testMembershipAccess();
    console.log('\nTest completed! You can now test with these accounts:');
    console.log('- basic@test.com / password123 (should NOT have access)');
    console.log('- premium@test.com / password123 (should have access)');
    console.log('- pro@test.com / password123 (should have access)');
    console.log('- year@test.com / password123 (should have access)');
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
