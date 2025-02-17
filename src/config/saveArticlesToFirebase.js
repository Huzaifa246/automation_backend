import { db, admin } from './firebase'; // Firebase DB and Admin import
export async function saveArticlesToFirebase(articles) {
    try {
        // Create a new document reference for the batch in Firestore
        const batchRef = db.collection('articleBatches').doc(); // Create a new document for this batch
        // Save all the articles in a single document under the 'articles' field
        await batchRef.set({
            articles: articles, // Save the entire batch of articles as an array
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('Batch of articles saved to Firebase successfully');
    }
    catch (error) {
        console.error('Error saving batch of articles to Firebase:', error);
    }
}
