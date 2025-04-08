const { admin } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
    console.log('[auth middleware] Checking authentication...');
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        console.log('[auth middleware] No authorization header provided');
        return res.status(401).json({ error: 'Unauthorized - No authorization header provided' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        console.log('[auth middleware] Invalid token format - must start with "Bearer "');
        return res.status(401).json({ error: 'Unauthorized - Invalid token format' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    if (!token) {
        console.log('[auth middleware] Empty token provided');
        return res.status(401).json({ error: 'Unauthorized - Empty token provided' });
    }
    
    console.log('[auth middleware] Received token (first 10 chars):', token.substring(0, 10) + '...');

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        console.log('[auth middleware] Token verified successfully for user:', decodedToken.uid);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('[auth middleware] Error verifying token:', error);
        
        // More specific error messages based on the error type
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Unauthorized - Token expired' });
        } else if (error.code === 'auth/id-token-revoked') {
            return res.status(401).json({ error: 'Unauthorized - Token revoked' });
        } else if (error.code === 'auth/invalid-id-token') {
            return res.status(401).json({ error: 'Unauthorized - Invalid token' });
        } else if (error.code === 'auth/argument-error') {
            return res.status(400).json({ error: 'Bad Request - Malformed token' });
        }
        
        return res.status(401).json({ error: 'Unauthorized - Token verification failed' });
    }
};

module.exports = { verifyToken }; 