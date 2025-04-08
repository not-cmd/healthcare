const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

const db = admin.firestore();

// Get all reminders for a user
const getReminders = async (userId) => {
    const snapshot = await db.collection('reminders')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

    if (snapshot.empty) {
        return [];
    }

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

// Get a single reminder
const getReminder = async (reminderId) => {
    const doc = await db.collection('reminders').doc(reminderId).get();
    if (!doc.exists) {
        return null;
    }
    return {
        id: doc.id,
        ...doc.data()
    };
};

// Add a new reminder
const addReminder = async (reminderData) => {
    const docRef = await db.collection('reminders').add(reminderData);
    const doc = await docRef.get();
    return {
        id: doc.id,
        ...doc.data()
    };
};

// Update a reminder
const updateReminder = async (reminderId, updatedData) => {
    await db.collection('reminders').doc(reminderId).update(updatedData);
    return getReminder(reminderId);
};

// Delete a reminder
const deleteReminder = async (reminderId) => {
    await db.collection('reminders').doc(reminderId).delete();
};

module.exports = {
    getReminders,
    getReminder,
    addReminder,
    updateReminder,
    deleteReminder
}; 