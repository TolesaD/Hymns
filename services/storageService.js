const B2 = require('backblaze-b2');
const fs = require('fs');
const path = require('path');

class StorageService {
    constructor() {
        this.b2 = new B2({
            applicationKeyId: process.env.B2_KEY_ID,
            applicationKey: process.env.B2_APPLICATION_KEY
        });
        this.bucketName = process.env.B2_BUCKET_NAME;
        this.bucketId = process.env.B2_BUCKET_ID;
        this.authorized = false;
        this.enabled = !!(process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY);
    }

    async authorize() {
        if (!this.enabled) {
            throw new Error('Backblaze B2 storage is not configured. Please check your environment variables.');
        }
        
        if (!this.authorized) {
            try {
                await this.b2.authorize();
                this.authorized = true;
                console.log('Backblaze B2 authorized successfully');
            } catch (error) {
                console.error('B2 authorization error:', error.message);
                throw new Error('Failed to authenticate with Backblaze B2. Please check your credentials.');
            }
        }
    }

    async uploadFile(filePath, fileName) {
        try {
            // Check if B2 is enabled and configured
            if (!this.enabled) {
                throw new Error('Backblaze B2 is not configured. Using local storage fallback.');
            }

            await this.authorize();
            
            // Get upload URL
            const response = await this.b2.getUploadUrl({
                bucketId: this.bucketId
            });
            
            // Read file
            const fileData = fs.readFileSync(filePath);
            
            // Upload file
            const uploadResponse = await this.b2.uploadFile({
                uploadUrl: response.data.uploadUrl,
                uploadAuthToken: response.data.authorizationToken,
                fileName: `hymns/${Date.now()}-${fileName}`,
                data: fileData,
                contentLength: fileData.length
            });
            
            // Construct public URL
            const publicUrl = `https://f005.backblazeb2.com/file/${this.bucketName}/${uploadResponse.data.fileName}`;
            
            console.log('File uploaded successfully to Backblaze B2:', publicUrl);
            return {
                fileId: uploadResponse.data.fileId,
                fileName: uploadResponse.data.fileName,
                publicUrl: publicUrl
            };
            
        } catch (error) {
            console.error('Backblaze B2 upload error:', error.message);
            
            // Fallback to local storage
            console.log('Falling back to local storage...');
            return this.localUploadFallback(filePath, fileName);
        }
    }

    // Local storage fallback
    localUploadFallback(filePath, fileName) {
        try {
            // Create uploads directory if it doesn't exist
            const uploadsDir = path.join(__dirname, '../public/uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            // Generate unique filename
            const uniqueFileName = `hymn-${Date.now()}-${fileName}`;
            const destinationPath = path.join(uploadsDir, uniqueFileName);
            
            // Copy file to uploads directory
            fs.copyFileSync(filePath, destinationPath);
            
            // Return local URL
            const publicUrl = `/uploads/${uniqueFileName}`;
            
            console.log('File saved locally:', publicUrl);
            return {
                fileId: uniqueFileName,
                fileName: uniqueFileName,
                publicUrl: publicUrl,
                isLocal: true // Flag to indicate local storage
            };
            
        } catch (error) {
            console.error('Local storage fallback error:', error);
            throw new Error('Failed to upload file to both Backblaze B2 and local storage.');
        }
    }

    async deleteFile(fileName) {
        try {
            if (!this.enabled) {
                console.log('Backblaze B2 not configured, skipping file deletion');
                return;
            }

            await this.authorize();
            
            // Get file info first
            const files = await this.b2.listFileNames({
                bucketId: this.bucketId,
                startFileName: fileName,
                maxFileCount: 1
            });
            
            if (files.data.files.length > 0) {
                await this.b2.deleteFileVersion({
                    fileId: files.data.files[0].fileId,
                    fileName: fileName
                });
                console.log('File deleted successfully from Backblaze B2:', fileName);
            }
            
        } catch (error) {
            console.error('File deletion error:', error.message);
            // Don't throw error for deletion failures
        }
    }

    // Check if B2 is properly configured
    isConfigured() {
        return this.enabled;
    }

    // Get configuration status
    getStatus() {
        return {
            enabled: this.enabled,
            configured: !!(process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY && 
                          process.env.B2_BUCKET_ID && process.env.B2_BUCKET_NAME),
            bucketName: this.bucketName,
            hasCredentials: !!(process.env.B2_KEY_ID && process.env.B2_APPLICATION_KEY)
        };
    }
}

module.exports = new StorageService();