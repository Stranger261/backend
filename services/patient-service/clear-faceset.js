// Create a test script: clear-faceset.js
import FaceProcessingService from './src/services/faceProcessing.service.js';

const faceService = new FaceProcessingService();

async function clearFaceSet() {
  try {
    const details = await faceService.getFaceSetDetails();
    console.log(`FaceSet has ${details.face_count} faces`);

    if (details.face_count === 0) {
      console.log('Already empty');
      return;
    }

    const allFaces = details.face_tokens || [];
    console.log(`Removing ${allFaces.length} faces...`);

    for (const faceToken of allFaces) {
      await faceService.removeFaceFromFaceSet(faceToken);
      console.log('✅ Removed 1 face');
    }

    console.log('✅ FaceSet cleared!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearFaceSet();
