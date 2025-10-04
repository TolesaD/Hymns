const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );
        this.bucketName = process.env.SUPABASE_BUCKET_NAME || 'akotet'; // Changed to 'akotet'
        this.enabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    }

    async uploadFile(fileBuffer, fileName, mimeType = 'audio/mpeg') {
        try {
            if (!this.enabled) {
                throw new Error('Supabase is not configured');
            }

            console.log('📤 Uploading file to Supabase:', fileName);
            console.log('📁 Using bucket:', this.bucketName);
            
            const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .upload(`hymns/${Date.now()}-${fileName}`, fileBuffer, {
                    contentType: mimeType,
                    upsert: false
                });

            if (error) {
                console.error('❌ Supabase upload error:', error);
                throw new Error(`Upload failed: ${error.message}`);
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from(this.bucketName)
                .getPublicUrl(data.path);

            console.log('✅ File uploaded successfully:', urlData.publicUrl);
            return {
                filePath: data.path,
                publicUrl: urlData.publicUrl,
                fileName: fileName
            };
            
        } catch (error) {
            console.error('💥 Supabase service error:', error);
            throw error;
        }
    }

    async deleteFile(filePath) {
        try {
            if (!this.enabled) return;

            const { error } = await this.supabase.storage
                .from(this.bucketName)
                .remove([filePath]);

            if (error) {
                console.error('❌ Supabase delete error:', error);
            } else {
                console.log('✅ File deleted from Supabase:', filePath);
            }
        } catch (error) {
            console.error('💥 Supabase delete error:', error);
        }
    }

    async updateFile(oldFilePath, newFileBuffer, fileName, mimeType = 'audio/mpeg') {
        try {
            // Delete old file if it exists
            if (oldFilePath) {
                await this.deleteFile(oldFilePath);
            }

            // Upload new file
            return await this.uploadFile(newFileBuffer, fileName, mimeType);
        } catch (error) {
            console.error('💥 Supabase update error:', error);
            throw error;
        }
    }

    // Check if Supabase is properly configured
    isConfigured() {
        return this.enabled;
    }

    // Get configuration status
    getStatus() {
        return {
            enabled: this.enabled,
            configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
            bucketName: this.bucketName,
            hasCredentials: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
        };
    }
}

module.exports = new SupabaseService();