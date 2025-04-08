const { db } = require('../config/firebase');
const nlpService = require('../services/nlpService');
const schedulingService = require('../services/schedulingService');
const { uploadFileToStorage } = require('../utils/storageUploader');
const openFdaService = require('../services/openFdaService');

/**
 * Extracts relevant details from a structured medication object.
 * Needed for formatting response in addVoiceReminder.
 */
function formatMedicationForResponse(medication) {
    if (!medication) return null;
    return {
        medicine: medication.name || "Unknown",
        dose: medication.dosage || "Not specified",
        times: medication.reminderTimes || [],
        timeContext: medication.timeContext || "",
        instructions: medication.instructions || "Take as directed",
        frequency: medication.frequency || "Not specified",
    };
}

/**
 * Processes text (from voice) to create a reminder.
 */
exports.addVoiceReminder = async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ message: 'Missing required field: text' });
    }
    const userId = "temp-user-id"; // Replace with actual authenticated user ID

    try {
        console.log('Processing voice text for reminder:', text);

        // 1. Use NLP to parse the text
        const nlpData = await nlpService.parsePrescriptionText(text);
        console.log('NLP Result from voice:', nlpData);

        if (nlpData.error || !nlpData.structuredMedications || nlpData.structuredMedications.length === 0) {
            return res.status(400).json({ 
                message: nlpData.error || 'Could not extract medication details from the provided text.', 
                nlpData,
                suggestion: "Try saying something like 'I need to take X-Medicine, two pills daily – one before breakfast and one before dinner.'"
            });
        }

        // Assume first medication found is the one to schedule (simplification)
        const primaryMedication = nlpData.structuredMedications[0];
        
        // If validation exists and failed, handle it (now handled by NLP service)
        if (primaryMedication.validation && !primaryMedication.validation.found) {
             return res.status(400).json({ 
                message: `Medication "${primaryMedication.name}" not found or validated. Please check spelling or enter manually.`, 
                nlpData,
                suggestion: "If this is a correct medication name, please continue with 'Confirm' or try again."
            });
        }
        
        // 2. Prepare data for Firestore
        const reminderData = {
            userId: userId,
            source: 'voice',
            inputText: text,
            packageImageUrl: null,
            medicationImageUrl: null,
            nlpResult: {
                rawEntities: nlpData.rawEntities || [],
                structuredMedications: nlpData.structuredMedications || [],
            },
            status: 'processing',
            createdAt: new Date()
        };

        // 3. Save initial data
        const docRef = await db.collection('prescriptions').add(reminderData);
        const prescriptionId = docRef.id;
        console.log('Voice reminder data saved with ID:', prescriptionId);

        // 4. Generate and save schedule (Await ensures completion)
        await schedulingService.createInitialSchedules(prescriptionId, nlpData.structuredMedications);
        
        // Update status to 'scheduled' after successful scheduling
        await db.collection('prescriptions').doc(prescriptionId).update({ status: 'scheduled' });

        // 5. Create a senior-friendly response
        const formattedMedication = formatMedicationForResponse(primaryMedication);
        const confirmationText = `I've set reminders for ${formattedMedication.medicine} at ${formattedMedication.times?.join(' and ') || 'scheduled times'}. Say 'Edit' to change or 'Confirm' to save.`;
        
        res.status(201).json({ 
            message: 'Reminder created successfully from voice input', 
            prescriptionId: prescriptionId, 
            reminder: { ...formattedMedication, confirmationText, prescriptionId } 
        });

    } catch (error) {
        console.error('Error processing voice reminder:', error);
        res.status(500).json({ 
            message: 'Error processing voice input.', 
            error: error.message,
            suggestion: "Please try again with a clearer statement about your medication."
        });
    }
};

/**
 * Creates a reminder from manually entered form data.
 */
exports.addManualReminder = async (req, res) => {
    // Extract data from form body (adjust field names as needed)
    const { medicationName, dosage, frequency, instructions } = req.body;
    const packageImageFile = req.files?.packageImage?.[0];
    const medicationImageFile = req.files?.medicationImage?.[0];
    const userId = "temp-user-id"; // Replace with actual authenticated user ID

    if (!medicationName || !frequency) {
         return res.status(400).json({ message: 'Missing required fields: medicationName, frequency' });
    }

    try {
        let packageImageUrl = null, medicationImageUrl = null;

        // Upload optional images
        const uploadPromises = [];
        if (packageImageFile) {
             uploadPromises.push(
                uploadFileToStorage(packageImageFile.buffer, packageImageFile.originalname, 'med_images/')
                    .then(url => packageImageUrl = url)
             );
        }
        if (medicationImageFile) {
             uploadPromises.push(
                uploadFileToStorage(medicationImageFile.buffer, medicationImageFile.originalname, 'med_images/')
                    .then(url => medicationImageUrl = url)
             );
        }
        await Promise.all(uploadPromises);
        console.log('Manual image uploads complete.', { packageImageUrl, medicationImageUrl });

        // Simulate structured medication data based on input
        // Perform validation using OpenFDA
        const validationResult = await openFdaService.findDrugByName(medicationName);
        if (!validationResult?.found) {
            console.warn(`Manual entry validation failed for: ${medicationName}`);
            // Decide whether to block or allow saving with a warning/review status
        }
        
        const structuredMed = {
            name: medicationName,
            dosage: dosage || null,
            frequency: frequency,
            instructions: instructions || null,
            validation: validationResult || { found: false, nameUsed: medicationName },
            // Include image URLs here if needed immediately
            packageImageUrl: packageImageUrl,
            medicationImageUrl: medicationImageUrl
        };

        const reminderData = {
            userId: userId,
            source: 'manual',
            packageImageUrl: packageImageUrl,
            medicationImageUrl: medicationImageUrl,
            // No OCR/raw NLP entities for manual entry
            nlpResult: {
                 rawEntities: [],
                 structuredMedications: [structuredMed], // Store the manually created structure
             },
            status: 'processing', 
            createdAt: new Date()
        };

        // Save initial data
        const docRef = await db.collection('prescriptions').add(reminderData);
        const prescriptionId = docRef.id;
        console.log('Manual reminder data saved with ID:', prescriptionId);

        // Generate and save schedule
        schedulingService.createInitialSchedules(prescriptionId, [structuredMed]) // Pass the structured data
            .catch(err => console.error("Error creating initial schedules in background:", err)); 

        res.status(201).json({ message: 'Reminder created successfully from manual input', prescriptionId: prescriptionId, structuredMedication: structuredMed });

    } catch (error) {
        console.error('Error processing manual reminder:', error);
        res.status(500).json({ message: 'Error processing manual input.', error: error.message });
    }
};

/**
 * Retrieves all reminders for a user
 */
exports.getReminders = async (req, res) => {
    try {
        const userId = req.user.uid;
        const reminders = await db.collection('prescriptions').where('userId', '==', userId).get();
        const reminderData = [];
        reminders.forEach(doc => {
            reminderData.push({ id: doc.id, ...doc.data() });
        });
        res.json(reminderData);
    } catch (error) {
        console.error('Error getting reminders:', error);
        res.status(500).json({ error: 'Failed to get reminders' });
    }
};

/**
 * Simple test method to create a basic reminder for debugging
 */
exports.createTestReminder = async (req, res) => {
    try {
        const userId = "temp-user-id"; // Default test user
        
        // Create a basic test reminder
        const testReminder = {
            userId: userId,
            source: 'test',
            status: 'scheduled',
            createdAt: new Date(),
            updatedAt: new Date(),
            medicationSchedules: [
                {
                    name: "Test Medication",
                    dosage: "1 pill",
                    frequency: "twice a day",
                    instructions: "Take with water",
                    reminderTimes: ["8:00 AM", "8:00 PM"],
                    active: true,
                    packageImageUrl: null,
                    medicationImageUrl: null,
                    createdAt: new Date()
                }
            ]
        };
        
        // Save to Firestore
        const docRef = await db.collection('prescriptions').add(testReminder);
        console.log('Test reminder created with ID:', docRef.id);
        
        res.status(201).json({
            message: 'Test reminder created successfully',
            prescriptionId: docRef.id,
            reminder: testReminder
        });
    } catch (error) {
        console.error('Error creating test reminder:', error);
        res.status(500).json({
            message: 'Error creating test reminder',
            error: error.message
        });
    }
};

// Get a single reminder (now fetches full prescription doc)
exports.getReminder = async (req, res) => {
    try {
        const prescriptionId = req.params.id;
        console.log(`[ReminderController] GET request for prescription ID: ${prescriptionId}`);
        const prescription = await db.collection('prescriptions').doc(prescriptionId).get();
        
        if (!prescription.exists) {
            console.log(`[ReminderController] Prescription ${prescriptionId} not found.`);
            return res.status(404).json({ error: 'Reminder (Prescription) not found' });
        }
        
        console.log(`[ReminderController] Found prescription ${prescriptionId}, returning.`);
        res.json(prescription.data()); // Return the full prescription document
    } catch (error) {
        console.error(`[ReminderController] Error fetching reminder (prescription) ${req.params.id}:`, error);
        res.status(500).json({ error: 'Failed to fetch reminder' });
    }
};

// Update a reminder (prescription)
exports.updateReminder = async (req, res) => {
    try {
        const userId = req.user.uid;
        const reminderId = req.params.id;

        // Verify the reminder belongs to the user
        const existingReminder = await db.collection('prescriptions').doc(reminderId).get();
        if (!existingReminder.exists || existingReminder.data().userId !== userId) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        const updatedData = {
            ...req.body,
            updatedAt: new Date()
        };

        await db.collection('prescriptions').doc(reminderId).update(updatedData);
        res.json({ message: 'Reminder updated successfully' });
    } catch (error) {
        console.error('Error updating reminder:', error);
        res.status(500).json({ error: 'Failed to update reminder' });
    }
};

// Delete a reminder (prescription)
exports.deleteReminder = async (req, res) => {
    try {
        const userId = req.user.uid;
        const reminderId = req.params.id;

        // Verify the reminder belongs to the user
        const existingReminder = await db.collection('prescriptions').doc(reminderId).get();
        if (!existingReminder.exists || existingReminder.data().userId !== userId) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        await db.collection('prescriptions').doc(reminderId).delete();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting reminder:', error);
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
};

module.exports = {
    addVoiceReminder: exports.addVoiceReminder,
    addManualReminder: exports.addManualReminder,
    getReminders: exports.getReminders,
    createTestReminder: exports.createTestReminder,
    getReminder: exports.getReminder,
    updateReminder: exports.updateReminder,
    deleteReminder: exports.deleteReminder
}; 