"use server";

import { promises as fsPromises } from "fs";
import path from "path";

/**
 * Server action to convert an image from the public directory to a base64 data URL
 */
export async function getImageAsBase64(imagePath: string): Promise<string> {
  try {
    // Get the full path to the image in the public directory
    const fullPath = path.join(process.cwd(), "public", imagePath);

    // Read the image file
    const imageBuffer = await fsPromises.readFile(fullPath);

    // Convert to base64
    const base64Image = imageBuffer.toString("base64");

    // Determine MIME type based on file extension
    const extension = path.extname(imagePath).toLowerCase();
    let mimeType = "image/jpeg"; // Default

    if (extension === ".png") {
      mimeType = "image/png";
    } else if (extension === ".gif") {
      mimeType = "image/gif";
    } else if (extension === ".webp") {
      mimeType = "image/webp";
    }

    // Return as data URL
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error converting image to base64:", error);
    throw new Error(`Failed to convert image to base64: ${errorMessage}`);
  }
}
