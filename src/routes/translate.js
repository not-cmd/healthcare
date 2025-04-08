const express = require('express');
const translationService = require('../services/translationService');

const router = express.Router();

// POST /api/translate
router.post('/', async (req, res) => {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
        return res.status(400).json({ message: 'Missing required fields: text, targetLanguage' });
    }

    try {
        const translatedText = await translationService.translateText(text, targetLanguage);
        res.json({ originalText: text, translatedText: translatedText, language: targetLanguage });
    } catch (error) {
        console.error('Translation API Error:', error);
        res.status(500).json({ message: 'Error during translation', error: error.message });
    }
});

module.exports = router; 