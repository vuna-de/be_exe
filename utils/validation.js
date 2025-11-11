const { body, param, query, validationResult } = require('express-validator');

// Middleware để xử lý kết quả validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      error: 'Dữ liệu không hợp lệ',
      details: formattedErrors
    });
  }
  
  next();
};

// Validation rules cho User
const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Email không hợp lệ')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
  
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Họ tên chỉ được chứa chữ cái và khoảng trắng'),
  
  body('phone')
    .optional()
    .matches(/^[0-9]{10,11}$/)
    .withMessage('Số điện thoại không hợp lệ'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 100) {
        throw new Error('Tuổi phải từ 13-100');
      }
      
      return true;
    }),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Giới tính không hợp lệ'),
  
  handleValidationErrors
];

const validateLogin = [
  body('emailOrPhone')
    .notEmpty()
    .withMessage('Email hoặc số điện thoại là bắt buộc')
    .custom((value) => {
      const isEmail = /^\S+@\S+\.\S+$/.test(value);
      const isPhone = /^[0-9]{10,11}$/.test(value);
      
      if (!isEmail && !isPhone) {
        throw new Error('Email hoặc số điện thoại không hợp lệ');
      }
      
      return true;
    }),
  
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu là bắt buộc'),
  
  handleValidationErrors
];

const validateUpdateProfile = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự')
    .matches(/^[a-zA-ZÀ-ỹ\s]+$/)
    .withMessage('Họ tên chỉ được chứa chữ cái và khoảng trắng'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ')
    .custom((value) => {
      if (!value) return true;
      
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 13 || age > 100) {
        throw new Error('Tuổi phải từ 13-100');
      }
      
      return true;
    }),
  
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Giới tính không hợp lệ'),
  
  body('height')
    .optional()
    .isFloat({ min: 100, max: 250 })
    .withMessage('Chiều cao phải từ 100-250cm'),
  
  body('weight')
    .optional()
    .isFloat({ min: 30, max: 300 })
    .withMessage('Cân nặng phải từ 30-300kg'),
  
  body('fitnessGoal')
    .optional()
    .isIn(['weight_loss', 'muscle_gain', 'maintenance', 'endurance'])
    .withMessage('Mục tiêu tập luyện không hợp lệ'),
  
  body('activityLevel')
    .optional()
    .isIn(['sedentary', 'light', 'moderate', 'active', 'very_active'])
    .withMessage('Mức độ hoạt động không hợp lệ'),
  
  handleValidationErrors
];

const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mật khẩu hiện tại là bắt buộc'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu mới phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Xác nhận mật khẩu không khớp');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Validation rules cho Exercise
const validateCreateExercise = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên bài tập phải từ 2-100 ký tự'),
  
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Mô tả phải từ 10-1000 ký tự'),
  
  body('instructions')
    .isArray({ min: 1 })
    .withMessage('Phải có ít nhất 1 bước hướng dẫn'),
  
  body('instructions.*')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Mỗi bước hướng dẫn phải từ 5-500 ký tự'),
  
  body('category')
    .isIn(['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'flexibility', 'full_body'])
    .withMessage('Danh mục bài tập không hợp lệ'),
  
  body('primaryMuscles')
    .isArray({ min: 1 })
    .withMessage('Phải chọn ít nhất 1 nhóm cơ chính'),
  
  body('difficulty')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Độ khó không hợp lệ'),
  
  body('type')
    .isIn(['strength', 'cardio', 'flexibility', 'balance', 'plyometric'])
    .withMessage('Loại bài tập không hợp lệ'),
  
  body('equipment')
    .optional()
    .isArray()
    .withMessage('Thiết bị phải là mảng'),
  
  body('caloriesPerMinute')
    .optional()
    .isFloat({ min: 1, max: 50 })
    .withMessage('Calories mỗi phút phải từ 1-50'),
  
  body('estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 180 })
    .withMessage('Thời gian ước tính phải từ 1-180 phút'),
  
  handleValidationErrors
];

// Validation rules cho Workout Plan
const validateCreateWorkoutPlan = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên kế hoạch phải từ 2-100 ký tự'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Mô tả không được quá 1000 ký tự'),
  
  body('category')
    .isIn(['strength', 'muscle_gain', 'weight_loss', 'endurance', 'flexibility', 'general'])
    .withMessage('Danh mục kế hoạch không hợp lệ'),
  
  body('difficulty')
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Độ khó không hợp lệ'),
  
  body('estimatedDuration')
    .isInt({ min: 10, max: 300 })
    .withMessage('Thời gian ước tính phải từ 10-300 phút'),
  
  body('exercises')
    .isArray({ min: 1 })
    .withMessage('Phải có ít nhất 1 bài tập'),
  
  body('exercises.*.exercise')
    .isMongoId()
    .withMessage('ID bài tập không hợp lệ'),
  
  body('exercises.*.plannedSets')
    .isInt({ min: 1, max: 10 })
    .withMessage('Số sets phải từ 1-10'),
  
  body('exercises.*.order')
    .isInt({ min: 1 })
    .withMessage('Thứ tự phải lớn hơn 0'),
  
  handleValidationErrors
];

// Validation cho parameters
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName} không hợp lệ`),
  
  handleValidationErrors
];

// Validation cho pagination
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Trang phải là số nguyên dương'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit phải từ 1-100'),
  
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'name', '-name', 'difficulty', '-difficulty'])
    .withMessage('Sắp xếp không hợp lệ'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateCreateExercise,
  validateCreateWorkoutPlan,
  validateObjectId,
  validatePagination
};
