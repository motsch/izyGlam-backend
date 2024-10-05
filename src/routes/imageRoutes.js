const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middlewares/authMiddleware');
const imageController = require('../controllers/imageController');
const router = express.Router();

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/images/');  // Directory for image uploads
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);  // Unique file names
  }
});
const upload = multer({ storage: storage });

// ---------- IMAGE UPLOAD ROUTES ---------- //

// Route to upload an image (field named 'image')
router.post('/image/upload', authMiddleware, upload.single('image'), imageController.uploadImage);

// Route to retrieve a specific image by filename
router.get('/image/:filename', imageController.getImageByFilename);

// Route to delete an image by filename
router.delete('/image/:filename', authMiddleware, imageController.deleteImage);

// ----------------------------------------- //

module.exports = router;
