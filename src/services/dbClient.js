const { db } = require('../config/firebase'); // Import db instance

// Get a single prescription document (renamed for clarity)
exports.getPrescription = async (prescriptionId) => {
    try {
        console.log(`[DBClient] Getting prescription with ID: ${prescriptionId}`);
        const docRef = db.collection('prescriptions').doc(prescriptionId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            console.log(`[DBClient] Prescription with ID ${prescriptionId} not found.`);
            return null;
        }
        
        const data = { id: doc.id, ...doc.data() };
        console.log(`[DBClient] Found prescription:`, JSON.stringify(data, null, 2)); // Log found data
        return data;
    } catch (error) {
        console.error(`[DBClient] Error getting prescription ${prescriptionId}:`, error);
        throw error;
    }
};

// Update a prescription document
// Note: This currently assumes updatedData contains fields matching the MedicationSchedule structure
// and updates the *first* schedule. A more robust implementation would handle multiple schedules
// or allow updating top-level prescription fields.
exports.updatePrescription = async (prescriptionId, updatedData) => {
    try {
        console.log(`[DBClient] Updating prescription ${prescriptionId} with data:`, JSON.stringify(updatedData, null, 2));
        const docRef = db.collection('prescriptions').doc(prescriptionId);
        const doc = await docRef.get();

        if (!doc.exists) {
             console.log(`[DBClient] Prescription ${prescriptionId} not found for update.`);
            return null; 
        }

        const currentData = doc.data();
        // Prepare the update object - for now, merging into the first schedule
        // This is a simplification!
        const updatePayload = {};
        if (currentData.medicationSchedules && currentData.medicationSchedules.length > 0) {
            // Update fields in the first schedule
            Object.keys(updatedData).forEach(key => {
                // Map frontend field names to backend schedule field names if needed
                // Assuming direct mapping for now (e.g., medicationName -> name)
                const scheduleKey = (key === 'medicationName') ? 'name' : key;
                updatePayload[`medicationSchedules.0.${scheduleKey}`] = updatedData[key];
            });
             updatePayload['updatedAt'] = new Date(); // Update timestamp
        } else {
            // Handle case with no schedules? Or update top-level fields? 
            // For now, log a warning and maybe update top-level if applicable
            console.warn(`[DBClient] Prescription ${prescriptionId} has no schedules to update directly. Updating top-level fields.`);
             Object.assign(updatePayload, updatedData); // Simple merge for now
             updatePayload['updatedAt'] = new Date();
        }


        console.log(`[DBClient] Applying update payload:`, JSON.stringify(updatePayload, null, 2));
        await docRef.update(updatePayload);
        
        const updatedDoc = await docRef.get();
        const resultData = { id: updatedDoc.id, ...updatedDoc.data() };
         console.log(`[DBClient] Prescription ${prescriptionId} updated successfully.`);
        return resultData;
    } catch (error) {
        console.error(`[DBClient] Error updating prescription ${prescriptionId}:`, error);
        throw error;
    }
};

// Delete a prescription document (renamed for clarity)
exports.deletePrescription = async (prescriptionId) => {
    try {
        console.log(`[DBClient] Deleting prescription with ID: ${prescriptionId}`);
        const docRef = db.collection('prescriptions').doc(prescriptionId);
        const doc = await docRef.get(); // Check if it exists before deleting
        
        if (!doc.exists) {
            console.log(`[DBClient] Prescription ${prescriptionId} not found for deletion.`);
            return false; // Indicate not found
        }

        await docRef.delete();
        console.log(`[DBClient] Prescription ${prescriptionId} deleted successfully.`);
        return true; // Indicate success
    } catch (error) {
        console.error(`[DBClient] Error deleting prescription ${prescriptionId}:`, error);
        throw error;
    }
};

// --- Remove or comment out the old functions --- 
/*
// Get a single reminder
exports.getReminder = async (reminderId) => {
    try {
        const reminder = await db.collection('reminders').doc(reminderId).get();
        if (!reminder.exists) {
            return null;
        }
        return { id: reminder.id, ...reminder.data() };
    } catch (error) {
        console.error('[DBClient] Error getting reminder:', error);
        throw error;
    }
};

// Update a reminder
exports.updateReminder = async (reminderId, updatedData) => {
    try {
        const reminderRef = db.collection('reminders').doc(reminderId);
        await reminderRef.update(updatedData);
        
        const updatedReminder = await reminderRef.get();
        if (!updatedReminder.exists) {
            return null;
        }
        return { id: updatedReminder.id, ...updatedReminder.data() };
    } catch (error) {
        console.error('[DBClient] Error updating reminder:', error);
        throw error;
    }
};

// Delete a reminder
exports.deleteReminder = async (reminderId) => {
    try {
        const reminderRef = db.collection('reminders').doc(reminderId);
        await reminderRef.delete();
        return true;
    } catch (error) {
        console.error('[DBClient] Error deleting reminder:', error);
        throw error;
    }
};
*/

// ... existing code ... 

// Get all prescriptions for a specific user (renamed for clarity)
exports.getPrescriptionsByUser = async (userId) => {
    // ... rest of the file
}; 