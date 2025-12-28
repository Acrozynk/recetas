import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

// Map extensions to content types
const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Get file extension
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    
    // Validate by extension if file.type is not set (common with folder uploads)
    const isValidType = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(extension);
    
    if (!isValidType) {
      console.error("Invalid file type:", { name: file.name, type: file.type, extension });
      return NextResponse.json(
        { error: `Invalid file type: ${file.type || extension}. Please upload a JPEG, PNG, WebP, or GIF image.` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const finalExtension = extension || "jpg";
    const filename = `${timestamp}-${randomString}.${finalExtension}`;

    // Determine content type - prefer detected type, fall back to extension-based
    const contentType = file.type && ALLOWED_TYPES.includes(file.type) 
      ? file.type 
      : EXTENSION_TO_CONTENT_TYPE[extension] || "image/jpeg";

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("recipe-images")
      .upload(filename, buffer, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Supabase storage error:", {
        error,
        filename,
        contentType,
        fileSize: file.size,
      });
      return NextResponse.json(
        { error: `Storage error: ${error.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(data.path);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}

