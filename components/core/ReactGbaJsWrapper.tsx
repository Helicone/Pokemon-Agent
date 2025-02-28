"use client";

import React, { useEffect, useRef } from "react";
import ReactGbaJs from "react-gbajs";
import { useEmulator } from "./EmulatorContext";

interface ReactGbaJsWrapperProps {
  scale?: number;
  volume?: number;
  onFpsReported?: (fps: number) => void;
  onLogReceived?: (level: string, message: string) => void;
  watchLogLevels?: {
    error?: boolean;
    warn?: boolean;
    info?: boolean;
    debug?: boolean;
  };
}

// This wrapper component exists to isolate the direct import of ReactGbaJs
// which needs to be client-side only
const ReactGbaJsWrapper: React.FC<ReactGbaJsWrapperProps> = ({
  scale = 1,
  volume = 1,
  onFpsReported,
  onLogReceived,
  watchLogLevels,
}) => {
  const { registerCanvas } = useEmulator();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRegistered = useRef<boolean>(false);

  // Find and register the canvas element after the component mounts
  useEffect(() => {
    if (containerRef.current) {
      // Try to find the canvas immediately
      const findAndRegisterCanvas = () => {
        if (canvasRegistered.current) {
          return true; // Already registered
        }

        const canvas = containerRef.current?.querySelector("canvas");
        if (canvas) {
          registerCanvas(canvas as HTMLCanvasElement);
          console.log("GBA canvas registered successfully");
          canvasRegistered.current = true;
          return true;
        }
        return false;
      };

      // Try immediately first
      if (findAndRegisterCanvas()) {
        return; // Canvas found and registered
      }

      // If not found immediately, set up a retry mechanism
      let attempts = 0;
      const maxAttempts = 15; // Increased for better reliability
      const interval = setInterval(() => {
        attempts++;
        if (findAndRegisterCanvas() || attempts >= maxAttempts) {
          clearInterval(interval);
          if (
            attempts >= maxAttempts &&
            !containerRef.current?.querySelector("canvas")
          ) {
            console.error(
              "Could not find GBA canvas element after multiple attempts"
            );
          }
        }
      }, 150); // Check more frequently

      return () => clearInterval(interval);
    }
  }, [registerCanvas]);

  return (
    <div ref={containerRef}>
      <ReactGbaJs
        scale={scale}
        volume={volume}
        onFpsReported={onFpsReported}
        onLogReceived={onLogReceived}
        watchLogLevels={watchLogLevels}
      />
    </div>
  );
};

export default ReactGbaJsWrapper;
