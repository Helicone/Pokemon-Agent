"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import dynamic from "next/dynamic";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { GbaContext, GbaProvider } from "react-gbajs";
import { useEmulator } from "./EmulatorContext";

// Create a loading component for the dynamic import
const LoadingEmulator = () => (
  <div className="w-full h-full flex items-center justify-center bg-muted rounded-md">
    <div className="h-full w-full flex flex-col items-center">
      <div className="animate-spin rounded-full h-full w-full border-b-2 border-primary mb-2"></div>
      <p>Loading emulator...</p>
    </div>
  </div>
);

// Import ReactGbaJs dynamically to ensure it's only loaded on the client
// We create a separate file for this component to avoid the direct import in this file
const ReactGbaJsDynamic = dynamic(() => import("./ReactGbaJsWrapper"), {
  ssr: false,
  loading: () => <LoadingEmulator />,
});

// Inner component that uses the GBA context
function GbaEmulatorInner() {
  const { play, saveState } = useContext(GbaContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedState, setHasSavedState] = useState(false);
  const { setIsGameRunning } = useEmulator();

  // Use refs to track values that shouldn't trigger re-renders immediately
  const fpsRef = useRef(0);
  const errorLogsRef = useRef<string[]>([]);

  // Check if there's a saved state on component mount
  useEffect(() => {
    const savedState = localStorage.getItem("gbaGameState");
    setHasSavedState(!!savedState);
  }, []);

  // Update FPS state from ref in an effect
  useEffect(() => {
    // Create a timer to periodically update FPS from the ref
    const fpsTimer = setInterval(() => {
      if (fpsRef.current !== fps) {
        setFps(fpsRef.current);
      }
    }, 500); // Update FPS every 500ms

    return () => {
      clearInterval(fpsTimer);
    };
  }, [fps]); // No dependencies to ensure it only runs once

  // Process any error logs in an effect
  useEffect(() => {
    if (errorLogsRef.current.length > 0) {
      // Log all errors that occurred
      errorLogsRef.current.forEach((errorMsg) => {
        console.error(`GBA Error: ${errorMsg}`);
      });
      // Clear the logs after processing
      errorLogsRef.current = [];
    }
  });

  // Load the ROM from the public folder
  const loadRom = useCallback(async () => {
    try {
      const response = await fetch("/roms/emerald.gba");
      if (!response.ok) {
        throw new Error("Failed to load ROM");
      }

      // Get the ROM as an ArrayBuffer
      const romBuffer = await response.arrayBuffer();

      // Create a Uint8Array from the ArrayBuffer to ensure compatibility
      const romData = new Uint8Array(romBuffer);

      // Pass the ROM data to the emulator
      play({ newRomBuffer: romData });
      setIsPlaying(true);
      setIsGameRunning(true);
    } catch (error: unknown) {
      console.error("Error loading ROM:", error);
      // Handle the error properly with type checking
      if (error instanceof Error) {
        setError(`Error loading ROM: ${error.message}`);
      } else {
        setError("An unknown error occurred while loading the ROM");
      }
      setIsGameRunning(false);
    }
  }, [play, setIsGameRunning]);

  // Show error in an alert if there is one
  useEffect(() => {
    if (error) {
      alert(error);
      setError(null);
    }
  }, [error]);

  const handleSaveState = useCallback(() => {
    try {
      const state = saveState();
      localStorage.setItem("gbaGameState", JSON.stringify(state));
      setHasSavedState(true);
      alert("Game state saved!");
    } catch (error) {
      console.error("Error saving state:", error);
      setError("Failed to save game state");
    }
  }, [saveState]);

  const handleLoadState = useCallback(() => {
    try {
      const savedState = localStorage.getItem("gbaGameState");
      if (savedState) {
        const state = JSON.parse(savedState);
        play({ restoreState: state });
        setIsPlaying(true);
        setIsGameRunning(true);
      } else {
        alert("No saved state found!");
      }
    } catch (error: unknown) {
      console.error("Error loading state:", error);
      if (error instanceof Error) {
        setError(`Error loading state: ${error.message}`);
      } else {
        setError("An unknown error occurred while loading the state");
      }
      setIsGameRunning(false);
    }
  }, [play, setIsGameRunning]);

  // Handle FPS reporting safely by updating the ref instead of state directly
  const handleFpsReported = useCallback((newFps: number) => {
    fpsRef.current = newFps;
  }, []);

  // Handle log messages safely by storing in a ref
  const handleLogReceived = useCallback((level: string, message: string) => {
    if (level === "error") {
      errorLogsRef.current.push(message);
    }
  }, []);

  // Update game running state when component unmounts
  useEffect(() => {
    return () => {
      setIsGameRunning(false);
    };
  }, [setIsGameRunning]);

  return (
    <div className="h-full flex flex-col justify-between items-center gap-4">
      <div className="h-full w-full flex flex-col items-center">
        <ReactGbaJsDynamic
          scale={3}
          volume={0.5}
          onFpsReported={handleFpsReported}
          onLogReceived={handleLogReceived}
          watchLogLevels={{ error: true, warn: true }}
        />
      </div>
      <div className="text-sm text-gray-500">FPS: {fps}</div>

      <div className="flex gap-2">
        <Button variant="action" onClick={loadRom} disabled={isPlaying}>
          Start Game
        </Button>
        <Button onClick={handleSaveState} disabled={!isPlaying}>
          Save Game
        </Button>
        <Button onClick={handleLoadState} disabled={!hasSavedState}>
          Load Save
        </Button>
      </div>
    </div>
  );
}

// Main component with client-side rendering handling built in
export default function GbaEmulator() {
  const [isMounted, setIsMounted] = useState(false);

  // Only show the component after it's mounted on the client
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // If not mounted yet, show a placeholder
  if (!isMounted) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pokémon Emerald</CardTitle>
          <CardDescription>GBA Emulator</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <div className="w-full h-[320px] flex items-center justify-center bg-muted rounded-md">
            <p>Initializing emulator...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render the emulator when mounted
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Pokémon Emerald</CardTitle>
        <CardDescription>GBA Emulator</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <GbaProvider>
          <GbaEmulatorInner />
        </GbaProvider>
      </CardContent>
    </Card>
  );
}
