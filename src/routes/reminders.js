const express = require('express');
const reminderController = require('../controllers/reminderController');
const multer = require('multer');
const { verifyToken } = require('../middleware/auth');

// Configure multer for manual uploads (optional images)
const storage = multer.memoryStorage();
const manualUpload = multer({ storage: storage }).fields([
    { name: 'packageImage', maxCount: 1 },
    { name: 'medicationImage', maxCount: 1 }
]);

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// POST /api/reminders/voice - Add reminder from transcribed voice text
router.post('/voice', reminderController.addVoiceReminder);

// POST /api/reminders/manual - Add reminder from form data
router.post('/manual', manualUpload, reminderController.addManualReminder);

// GET /api/reminders - Get all reminders for a user
router.get('/', reminderController.getReminders);

// Get a single reminder
router.get('/:id', reminderController.getReminder);

// Add test route for debugging
router.post('/test', reminderController.createTestReminder);

// Update a reminder
router.put('/:id', reminderController.updateReminder);

// Delete a reminder
router.delete('/:id', reminderController.deleteReminder);

module.exports = router; 