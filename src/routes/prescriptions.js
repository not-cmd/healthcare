const express = require('express');
const multer = require('multer');
const prescriptionController = require('../controllers/prescriptionController');

// Configure multer for memory storage
const storage = multer.memoryStorage();
// Accept multiple fields: one prescription image, optional package/med images
const upload = multer({ storage: storage }).fields([
    { name: 'prescriptionImage', maxCount: 1 },
    { name: 'packageImage', maxCount: 1 },      // Image of the medication packaging
    { name: 'medicationImage', maxCount: 1 }   // Image of the pill/liquid itself
]);

const router = express.Router();

// POST /api/prescriptions/upload - Uses the new upload config
router.post('/upload', upload, prescriptionController.uploadPrescription);

// Add other prescription-related routes here (e.g., get, update, delete)

module.exports = router;
