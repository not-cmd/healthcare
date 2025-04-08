require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron'); // Import node-cron
const schedulingService = require('./services/schedulingService'); // Import scheduling service
const { admin } = require('./config/firebase'); // Import initialized admin instance

// Import routes
const prescriptionRoutes = require('./routes/prescriptions');
const translateRoutes = require('./routes/translate'); // Import translate routes
const reminderRoutes = require('./routes/reminders'); // Import reminder routes

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], // Allow requests from frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// Mount routes
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/translate', translateRoutes); // Mount translate routes
app.use('/api/reminders', reminderRoutes); // Mount reminder routes

// Basic route
app.get('/', (req, res) => {
  res.send('Medication Reminder API is running!');
});

// --- Schedule Reminder Check --- 
// Runs every minute (* * * * *)
console.log('Scheduling reminder check job...');
cron.schedule('* * * * *', () => {
  console.log('Running reminder check job...');
  schedulingService.checkReminders(); 
});
// --------------------------------

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
