// Create a mock database solution since Firebase authentication is failing

// In-memory database for testing/development
const mockDb = {
    collections: {
        prescriptions: []
    },
    
    // Collection reference
    collection: function(collectionName) {
        console.log(`[MockDB] Accessing collection: ${collectionName}`);
        if (!this.collections[collectionName]) {
            this.collections[collectionName] = [];
        }
        
        // Helper function to create a query object
        const createQuery = (conditions) => {
            console.log(`[MockDB] Creating query object with conditions:`, conditions);
            const queryObj = {
                conditions: conditions,
                
                // Add another where condition
                where: (field, operator, value) => {
                    console.log(`[MockDB] Chaining .where() on existing query. Adding:`, { field, operator, value });
                    const newConditions = [...conditions, { field, operator, value }];
                    // Return a new query object with updated conditions
                    const nextQueryObj = createQuery(newConditions); 
                    console.log(`[MockDB] Returning new query object from chained where. Has 'get' method?`, !!nextQueryObj.get);
                    console.log(`[MockDB] Returning new query object from chained where. Has 'where' method?`, !!nextQueryObj.where);
                    return nextQueryObj;
                },
                
                // Execute the query
                get: async () => {
                    let results = this.collections[collectionName];
                    
                    // Apply all stored conditions
                    conditions.forEach(cond => {
                        if (cond.operator === '==') {
                            results = results.filter(doc => doc[cond.field] === cond.value);
                        } else if (cond.operator === '>') {
                            results = results.filter(doc => doc[cond.field] > cond.value);
                        } else if (cond.operator === '<') {
                            results = results.filter(doc => doc[cond.field] < cond.value);
                        }
                        // Add more operators if needed
                    });
                    
                    console.log(`[MockDB] Query on ${collectionName} with conditions ${JSON.stringify(conditions)} found ${results.length} results.`);
                    
                    return {
                        empty: results.length === 0,
                        docs: results.map(doc => ({
                            id: doc.id,
                            data: () => ({ ...doc })
                        }))
                    };
                }
            };
            console.log(`[MockDB] Query object created. Has 'get' method?`, !!queryObj.get);
            console.log(`[MockDB] Query object created. Has 'where' method?`, !!queryObj.where);
            return queryObj;
        };

        // This is the object returned when you call db.collection('...')
        const initialCollectionObject = {
            add: async (data) => {
                const id = 'doc-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                const doc = { id, ...data };
                this.collections[collectionName].push(doc);
                console.log(`[MockDB] Added document to ${collectionName} with ID: ${id}`);
                return { id };
            },
            
            doc: (id) => ({
                get: async () => {
                    const doc = this.collections[collectionName].find(doc => doc.id === id);
                    console.log(`[MockDB] Get doc ${id} from ${collectionName}: ${doc ? 'Found' : 'Not Found'}`);
                    return {
                        exists: !!doc,
                        data: () => doc || null,
                        id
                    };
                },
                update: async (data) => {
                    const index = this.collections[collectionName].findIndex(doc => doc.id === id);
                    if (index !== -1) {
                        this.collections[collectionName][index] = { 
                            ...this.collections[collectionName][index], 
                            ...data 
                        };
                        console.log(`[MockDB] Updated document in ${collectionName} with ID: ${id}`);
                    } else {
                         console.warn(`[MockDB] Update failed: Doc ${id} not found in ${collectionName}`);
                    }
                    return;
                },
                delete: async () => {
                    const index = this.collections[collectionName].findIndex(doc => doc.id === id);
                    if (index !== -1) {
                        this.collections[collectionName].splice(index, 1);
                        console.log(`[MockDB] Deleted document from ${collectionName} with ID: ${id}`);
                    } else {
                         console.warn(`[MockDB] Delete failed: Doc ${id} not found in ${collectionName}`);
                    }
                    return;
                }
            }),
            
            // Initial where call starts the query chain
            where: (field, operator, value) => {
                console.log(`[MockDB] Initial .where() called. Condition:`, { field, operator, value });
                const queryObj = createQuery([{ field, operator, value }]);
                console.log(`[MockDB] Returning query object from initial where. Has 'get' method?`, !!queryObj.get);
                console.log(`[MockDB] Returning query object from initial where. Has 'where' method?`, !!queryObj.where);
                return queryObj;
            },
            
            // Add a basic get() directly on the collection for cases without where()
            get: async () => {
                console.log(`[MockDB] Get all from ${collectionName}`);
                let results = this.collections[collectionName];
                return {
                    empty: results.length === 0,
                    docs: results.map(doc => ({
                        id: doc.id,
                        data: () => ({ ...doc })
                    }))
                };
            }
        };
        console.log(`[MockDB] Returning initial collection object. Has 'where' method?`, !!initialCollectionObject.where);
        console.log(`[MockDB] Returning initial collection object. Has 'get' method?`, !!initialCollectionObject.get);
        return initialCollectionObject;
    }
};

// Mock bucket for file storage
const mockBucket = {
    name: 'mock-storage-bucket',
    file: (filePath) => {
        console.log(`[MockStorage] Referencing file: ${filePath}`);
        // Return an object mimicking the Firebase File object
        return {
            createWriteStream: (options) => {
                console.log(`[MockStorage] Creating write stream for ${filePath} with options:`, options);
                // Return a mock stream object
                const mockStream = {
                    write: (chunk) => { /* console.log(`[MockStream] Writing chunk (${chunk.length} bytes)`); */ },
                    end: (chunk) => { 
                        console.log(`[MockStream] End called for ${filePath}. Final chunk size: ${chunk?.length || 0}`);
                        // Simulate completion
                        setTimeout(() => mockStream.emit('finish'), 50); 
                        setTimeout(() => mockStream.emit('response', { /* mock response */ }), 50); // Emit response if needed
                    },
                    on: (event, callback) => {
                        console.log(`[MockStream] Listener attached for event: ${event}`);
                        // Store callbacks to be called later
                        mockStream._listeners = mockStream._listeners || {};
                        mockStream._listeners[event] = mockStream._listeners[event] || [];
                        mockStream._listeners[event].push(callback);
                    },
                    emit: (event, data) => {
                        console.log(`[MockStream] Emitting event: ${event}`);
                        if (mockStream._listeners && mockStream._listeners[event]) {
                            mockStream._listeners[event].forEach(cb => cb(data));
                        }
                    }
                };
                return mockStream;
            },
            getSignedUrl: async (options) => {
                console.log(`[MockStorage] Getting signed URL for ${filePath} with options:`, options);
                // Return a mock URL (doesn't need to be functional)
                return [`https://mock-storage-url.com/${filePath}?mockParam=true`];
            }
        };
    }
};

console.log('Using mock database and storage for development');

// Export mock implementations
module.exports = { 
    db: mockDb, 
    bucket: mockBucket, 
    admin: { 
        firestore: () => mockDb,
        storage: () => ({ bucket: () => mockBucket })
    } 
};
