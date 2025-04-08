const { bucket } = require('./dbClient');
const { format } = require('util');
const { v4: uuidv4 } = require('uuid'); // For generating unique filenames

/**
 * Uploads a file buffer to Firebase Storage.
 * @param {Buffer} buffer The file buffer.
 * @param {string} originalname The original filename.
 * @param {string} destinationPath Path within the bucket (e.g., 'prescription_images/').
 * @returns {Promise<string>} A promise that resolves with the public URL of the uploaded file.
 */
exports.uploadFileToStorage = (buffer, originalname, destinationPath) => {
    return new Promise((resolve, reject) => {
        if (!buffer) {
            return reject(new Error('No file buffer provided.'));
        }

        const blobName = `${destinationPath}${uuidv4()}-${originalname}`;
        const blob = bucket.file(blobName);
        const blobStream = blob.createWriteStream({
            resumable: false,
            // You might want to set contentType based on file mime type
            // metadata: {
            //     contentType: file.mimetype
            // }
        });

        blobStream.on('error', err => {
            console.error('Storage Upload Error:', err);
            reject(err);
        });

        blobStream.on('finish', () => {
            // Construct the public URL
            // This format assumes the bucket is publicly readable or uses signed URLs
            // For simplicity, using public URL format. Secure with Storage Rules!
            const publicUrl = format(
                `https://storage.googleapis.com/${bucket.name}/${blob.name}`
            );
            console.log(`File uploaded to: ${publicUrl}`);
            resolve(publicUrl);
        });

        blobStream.end(buffer);
    });
}; 