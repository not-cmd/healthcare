const ocrService = require('../services/ocrService');
const nlpService = require('../services/nlpService');
const { db } = require('../utils/dbClient'); // Import the Firestore instance
const schedulingService = require('../services/schedulingService'); // Import scheduling service
const { uploadFileToStorage } = require('../utils/storageUploader'); // Import storage uploader

exports.uploadPrescription = async (req, res) => {
    // req.files will contain the files based on field names
    const prescriptionImageFile = req.files?.prescriptionImage?.[0];
    const packageImageFile = req.files?.packageImage?.[0];
    const medicationImageFile = req.files?.medicationImage?.[0];

    if (!prescriptionImageFile) {
        return res.status(400).json({ message: 'No prescription image file uploaded.' });
    }
    const userId = "temp-user-id";

    try {
        let prescriptionImageUrl = null, packageImageUrl = null, medicationImageUrl = null;

        // --- Upload Images to Storage --- 
        const uploadPromises = [];
        
        // Upload prescription image (required)
        uploadPromises.push(
            uploadFileToStorage(prescriptionImageFile.buffer, prescriptionImageFile.originalname, 'prescription_images/')
                .then(url => prescriptionImageUrl = url)
        );

        // Upload package image (optional)
        if (packageImageFile) {
             uploadPromises.push(
                uploadFileToStorage(packageImageFile.buffer, packageImageFile.originalname, 'med_images/')
                    .then(url => packageImageUrl = url)
             );
        }
         // Upload medication image (optional)
        if (medicationImageFile) {
             uploadPromises.push(
                uploadFileToStorage(medicationImageFile.buffer, medicationImageFile.originalname, 'med_images/')
                    .then(url => medicationImageUrl = url)
             );
        }

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);
        console.log('Image uploads complete.', { prescriptionImageUrl, packageImageUrl, medicationImageUrl });
        // ---------------------------------

        // --- OCR and NLP (on prescription image) ---
        const ocrText = await ocrService.extractTextFromImage(prescriptionImageFile.buffer);
        console.log('OCR Result:', ocrText);
        if (!ocrText || ocrText.trim() === '') {
            // Optionally save the image URL even if OCR fails
            // await db.collection('failed_prescriptions').add({ userId, prescriptionImageUrl, createdAt: new Date() });
            return res.json({ ocrText: 'No text detected or OCR failed.', nlpData: null, prescriptionImageUrl });
        }
        const nlpData = await nlpService.parsePrescriptionText(ocrText);
        console.log('NLP Result:', nlpData);
        // ----------------------------------------

        // 3. Prepare initial data for Firestore (including image URLs)
        const initialPrescriptionData = {
            userId: userId,
            originalFilename: prescriptionImageFile.originalname,
            prescriptionImageUrl: prescriptionImageUrl, // URL of the uploaded prescription image
            packageImageUrl: packageImageUrl,       // URL of the package image
            medicationImageUrl: medicationImageUrl,   // URL of the medication image
            ocrText: ocrText,
            nlpResult: {
                rawEntities: nlpData.rawEntities || [],
                structuredMedications: nlpData.structuredMedications || [],
            },
            status: 'processing',
            createdAt: new Date()
        };

        // 4. Save initial data to Firestore
        const docRef = await db.collection('prescriptions').add(initialPrescriptionData);
        const prescriptionId = docRef.id;
        console.log('Initial prescription data saved with ID:', prescriptionId);

        // 5. Generate and save initial schedules 
        if (nlpData.structuredMedications && nlpData.structuredMedications.length > 0) {
            // Include image URLs when creating schedules
             const medsWithImages = nlpData.structuredMedications.map(med => ({ 
                ...med, 
                packageImageUrl: packageImageUrl, // Associate uploaded images with all meds for now
                medicationImageUrl: medicationImageUrl // TODO: Allow associating images per medication later
            }));

            schedulingService.createInitialSchedules(prescriptionId, medsWithImages)
                .catch(err => console.error("Error creating initial schedules in background:", err));
        } else {
             db.collection('prescriptions').doc(prescriptionId).update({ status: 'no_meds_found' });
        }

        // 6. Send back the results 
        res.json({ 
            ocrText, 
            nlpData: nlpData,
            prescriptionId: prescriptionId,
            imageUrls: { prescriptionImageUrl, packageImageUrl, medicationImageUrl }
        });

    } catch (error) {
        console.error('Error processing prescription upload:', error);
        res.status(500).json({ message: 'Error processing image or saving data.', error: error.message });
    }
};

// Add other controller functions here (e.g., getPrescriptions, addManualPrescription)
