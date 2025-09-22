// utils/b2.js - Backblaze B2 integration for private buckets (simplified version)
const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.B2_ACCOUNT_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

let authData = null;
let isInitialized = false;

// Initialize B2 connection
async function initializeB2() {
  if (isInitialized) return;
  
  try {
    const response = await b2.authorize();
    authData = response.data;
    isInitialized = true;
    console.log("Backblaze B2 authorized successfully.");
  } catch (err) {
    console.error('Error authorizing B2:', err);
    throw err;
  }
}

// Upload a file to B2
async function uploadFile(fileBuffer, fileName, folder = 'audio') {
  if (!isInitialized) await initializeB2();
  
  try {
    const uploadUrlResponse = await b2.getUploadUrl({ 
      bucketId: authData.allowed.bucketId 
    });
    
    const fullFileName = `${folder}/${fileName}`;
    
    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrlResponse.data.uploadUrl,
      uploadAuthToken: uploadUrlResponse.data.authorizationToken,
      fileName: fullFileName,
      data: fileBuffer,
    });
    
    console.log('File uploaded successfully to B2:', fullFileName);
    return fullFileName; // Return the path that can be stored in MongoDB
  } catch (err) {
    console.error('B2 upload failed:', err);
    throw err;
  }
}

// Generate signed URL for private files using backblaze-b2's built-in method
async function getSignedUrl(fileName, expirySeconds = 3600) {
  if (!isInitialized) await initializeB2();
  
  try {
    // Use the backblaze-b2 package's built-in method for generating download authorization
    const response = await b2.getDownloadAuthorization({
      bucketId: authData.allowed.bucketId,
      fileNamePrefix: fileName,
      validDurationInSeconds: expirySeconds
    });
    
    const authToken = response.data.authorizationToken;
    const downloadUrl = `${authData.downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}?Authorization=${authToken}`;
    
    return downloadUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    throw err;
  }
}

// Delete a file from B2
async function deleteFile(fileName) {
  if (!isInitialized) await initializeB2();
  
  try {
    // First get the file ID
    const listResponse = await b2.listFileNames({
      bucketId: authData.allowed.bucketId,
      startFileName: fileName,
      maxFileCount: 1
    });
    
    if (listResponse.data.files.length > 0) {
      const fileId = listResponse.data.files[0].fileId;
      
      await b2.deleteFileVersion({
        fileId: fileId,
        fileName: fileName
      });
      
      console.log('File deleted from B2:', fileName);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('B2 delete failed:', err);
    throw err;
  }
}

module.exports = { initializeB2, uploadFile, getSignedUrl, deleteFile };