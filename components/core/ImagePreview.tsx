"use client";

import NextImage from "next/image";
import { useEffect, useState } from "react";

interface ImagePreviewProps {
  imagePath: string;
}

export default function ImagePreview({ imagePath }: ImagePreviewProps) {
  const [imageExists, setImageExists] = useState(false);

  useEffect(() => {
    // Check if the image exists
    const img = new window.Image();
    img.onload = () => setImageExists(true);
    img.onerror = () => setImageExists(false);
    img.src = `/${imagePath}`;
  }, [imagePath]);

  if (!imageExists) {
    return (
      <div className="flex items-center justify-center h-40 bg-muted rounded-md">
        <p className="text-sm text-muted-foreground">
          Image not found: {imagePath}
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-40 w-full rounded-md overflow-hidden">
      <NextImage
        src={`/${imagePath}`}
        alt="Selected image"
        fill
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}
