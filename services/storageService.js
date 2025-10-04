const SupabaseService = require('./supabaseService');
const fs = require('fs');
const path = require('path');

class StorageService {
    constructor() {
        this.supabase = SupabaseService;
        this.enabled = this.supabase.isConfigured();
    }

    async uploadFile(filePath, fileName, mimeType = 'audio/mpeg') {
        try {
            // Check if Supabase is enabled and configured
            if (!this.enabled) {
                console.log('Supabase storage is not configured. Using local storage fallback.');
                return this.localUploadFallback(filePath, fileName);
            }

            console.log('📤 Attempting to upload file to Supabase...');
            
            // Read file as buffer
            const fileBuffer = fs.readFileSync(filePath);
            
            // Upload to Supabase
            const result = await this.supabase.uploadFile(fileBuffer, fileName, mimeType);
            
            console.log('✅ File uploaded successfully to Supabase:', result.publicUrl);
            return {
                fileId: result.filePath,
                fileName: result.fileName,
                publicUrl: result.publicUrl,
                filePath: result.filePath
            };
            
        } catch (error) {
            console.error('❌ Supabase upload error:', error.message);
            
            // Fallback to local storage
            console.log('🔄 Falling back to local storage...');
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
            
            console.log('📁 File saved locally:', publicUrl);
            return {
                fileId: uniqueFileName,
                fileName: uniqueFileName,
                publicUrl: publicUrl,
                filePath: uniqueFileName,
                isLocal: true // Flag to indicate local storage
            };
            
        } catch (error) {
            console.error('💥 Local storage fallback error:', error);
            throw new Error('Failed to upload file to both Supabase and local storage.');
        }
    }

    async deleteFile(filePath) {
        try {
            if (!this.enabled) {
                console.log('Supabase not configured, attempting local file deletion');
                return this.localDeleteFallback(filePath);
            }

            await this.supabase.deleteFile(filePath);
            
        } catch (error) {
            console.error('File deletion error:', error.message);
            // Try local deletion as fallback
            await this.localDeleteFallback(filePath);
        }
    }

    // Local deletion fallback
    async localDeleteFallback(filePath) {
        try {
            if (filePath && !filePath.startsWith('hymns/')) {
                const localFilePath = path.join(__dirname, '../public/uploads', filePath);
                if (fs.existsSync(localFilePath)) {
                    fs.unlinkSync(localFilePath);
                    console.log('🗑️ Local file deleted:', filePath);
                }
            }
        } catch (error) {
            console.error('Local file deletion error:', error.message);
        }
    }

    async updateFile(oldFilePath, newFilePath, fileName, mimeType = 'audio/mpeg') {
        try {
            if (!this.enabled) {
                console.log('Supabase not configured, using local storage for update');
                return this.localUploadFallback(newFilePath, fileName);
            }

            // Read new file as buffer
            const newFileBuffer = fs.readFileSync(newFilePath);
            
            // Update in Supabase
            const result = await this.supabase.updateFile(oldFilePath, newFileBuffer, fileName, mimeType);
            
            return {
                fileId: result.filePath,
                fileName: result.fileName,
                publicUrl: result.publicUrl,
                filePath: result.filePath
            };
            
        } catch (error) {
            console.error('Update file error:', error.message);
            return this.localUploadFallback(newFilePath, fileName);
        }
    }

    // Check if storage is properly configured
    isConfigured() {
        return this.enabled;
    }

    // Get configuration status
    getStatus() {
        const supabaseStatus = this.supabase.getStatus();
        return {
            enabled: this.enabled,
            configured: supabaseStatus.configured,
            storageType: 'supabase',
            bucketName: supabaseStatus.bucketName,
            hasCredentials: supabaseStatus.hasCredentials
        };
    }
}

module.exports = new StorageService();