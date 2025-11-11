const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads nếu chưa tồn tại
const ensureUploadsDir = () => {
  const uploadsDir = path.join(__dirname, '../uploads/avatars');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
};

// Cấu hình storage cho multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadsDir();
    cb(null, path.join(__dirname, '../uploads/avatars'));
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique: userId_timestamp.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = `${req.user.id}_${uniqueSuffix}${extension}`;
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
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Chỉ cho phép upload 1 file
  },
  fileFilter: fileFilter
});

// Middleware để xử lý lỗi upload
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 5MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ được upload 1 file'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Tên field không đúng. Sử dụng "avatar"'
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
const deleteOldAvatar = (avatarPath) => {
  if (avatarPath && !avatarPath.includes('ui-avatars.com')) {
    // Chỉ xóa file local, không xóa avatar mặc định từ ui-avatars.com
    const fullPath = path.join(__dirname, '../', avatarPath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log('Đã xóa avatar cũ:', fullPath);
      } catch (error) {
        console.error('Lỗi khi xóa avatar cũ:', error);
      }
    }
  }
};

module.exports = {
  uploadAvatar: upload.single('avatar'),
  handleUploadError,
  deleteOldAvatar
};
