const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads nếu chưa tồn tại
const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../uploads/meals');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

// Cấu hình storage cho multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDir();
    cb(null, path.join(__dirname, '../uploads/meals'));
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique: mealId_timestamp.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `meal_${uniqueSuffix}${extension}`;
    cb(null, filename);
  }
});

// File filter để chỉ cho phép upload ảnh
const fileFilter = (req, file, cb) => {
  // Kiểm tra MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ được upload file ảnh (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Cấu hình multer
const uploadMealImages = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Cho phép upload tối đa 5 ảnh
  },
  fileFilter: fileFilter
});

// Middleware để xử lý lỗi upload
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ được upload tối đa 5 ảnh'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Tên field không đúng. Sử dụng "images"'
      });
    }
  }
  
  if (error.message.includes('Chỉ được upload file ảnh')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

// Utility function để xóa file cũ
const deleteOldImage = (imagePath) => {
  if (imagePath && !imagePath.includes('ui-avatars.com')) {
    const fullPath = path.join(__dirname, '..', imagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
};

module.exports = {
  uploadMealImages,
  handleUploadError,
  deleteOldImage
};
