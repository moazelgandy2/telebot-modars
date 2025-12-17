import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { config } from '../config.js';

cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret
});

/**
 * Uploads a Buffer (Image/Video/File) to Cloudinary.
 * @param buffer File buffer
 * @returns Promise<UploadApiResponse> Cloudinary result
 */
export const uploadMedia = async (buffer: Buffer): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "telebot_user_uploads",
                resource_type: "auto" // Auto-detect image/video/raw
            },
            (error, result) => {
                if (error) return reject(error);
                if (!result) return reject(new Error("Cloudinary upload failed (no result)"));
                resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
};

export const getPDFPageUrls = (publicId: string, pageCount: number): string[] => {
    const urls: string[] = [];
    const maxPages = Math.min(pageCount, 5); // Hard cap at 5 pages

    for (let i = 1; i <= maxPages; i++) {
        // Generate URL for specific page (Cloudinary uses page index via dn transformation usually,
        // but for PDFs delivered as images, we append .jpg to the public_id or use pg_ index)
        // Standard Cloudinary PDF->Image format: https://res.cloudinary.com/demo/image/upload/pg_1/sample.jpg

        const url = cloudinary.url(publicId, {
            resource_type: 'image',
            format: 'jpg',
            page: i
        });
        urls.push(url);
    }
    return urls;
};
