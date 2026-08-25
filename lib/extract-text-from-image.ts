/** OCR en el dispositivo (sin API externa). Carga tesseract.js bajo demanda. */
export async function extractTextFromImageFile(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("spa+eng", 1, {
    logger: (message) => {
      if (!onProgress) return;
      const progress =
        typeof message.progress === "number" ? message.progress : 0;
      onProgress(progress, message.status || "processing");
    },
  });

  try {
    const { data } = await worker.recognize(file);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export function isSupportedImageType(file: File): boolean {
  return (
    file.type.startsWith("image/") &&
    !file.type.includes("heic") &&
    !file.type.includes("heif")
  );
}
