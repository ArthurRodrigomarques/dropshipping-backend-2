import multer from 'multer';

const storage = multer.memoryStorage();

const multerConfig = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('O arquivo não é uma imagem válida.'));
    }
  },
});

export default multerConfig;
