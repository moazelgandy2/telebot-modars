import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config.js';

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret
});

/**
 * Uploads a Buffer to Cloudinary and returns the secure URL.
 * @param buffer Image buffer
 * @returns Promise<string> Secure URL
 */
export const uploadImage = async (buffer: Buffer): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "telebot_user_uploads" },
            (error, result) => {
                if (error) return reject(error);
                if (!result) return reject(new Error("Cloudinary upload failed (no result)"));
                resolve(result.secure_url);
            }
        );
        uploadStream.end(buffer);
    });
};
