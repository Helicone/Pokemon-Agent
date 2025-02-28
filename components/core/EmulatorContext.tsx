"use client";

import { createContext, ReactNode, useContext, useRef, useState } from "react";

interface EmulatorContextType {
  // Screenshot handling
  screenshotDataUrl: string | null;
  takeScreenshot: () => Promise<string | null>;
  isScreenshotReady: () => boolean;
  getLatestScreenshot: () => string | null;

  // Keyboard controls
  pressKey: (key: string) => Promise<void>;

  // Game state
  isGameRunning: boolean;
  setIsGameRunning: (isRunning: boolean) => void;

  // Canvas registration
  registerCanvas: (canvas: HTMLCanvasElement) => void;
}

const defaultContext: EmulatorContextType = {
  screenshotDataUrl: null,
  takeScreenshot: () => Promise.resolve(null),
  isScreenshotReady: () => false,
  getLatestScreenshot: () => null,
  pressKey: () => Promise.resolve(),
  isGameRunning: false,
  setIsGameRunning: () => {},
  registerCanvas: () => {},
};

const EmulatorContext = createContext<EmulatorContextType>(defaultContext);

export const useEmulator = () => useContext(EmulatorContext);

export function EmulatorProvider({ children }: { children: ReactNode }) {
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(
    null
  );
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [emulatorCanvas, setEmulatorCanvas] =
    useState<HTMLCanvasElement | null>(null);

  // Use a ref to store the latest screenshot data URL for direct access
  // This bypasses React's state update cycle
  const latestScreenshotRef = useRef<string | null>(null);

  // Function to take a screenshot of the emulator
  const takeScreenshot = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!emulatorCanvas) {
        console.error("Emulator canvas not found when taking screenshot");
        resolve(null);
        return;
      }

      try {
        // Make sure the canvas is valid before taking a screenshot
        if (emulatorCanvas.width === 0 || emulatorCanvas.height === 0) {
          console.error("Canvas dimensions are invalid (0x0)");
          resolve(null);
          return;
        }

        // For the first screenshot, we might need to ensure the canvas is fully rendered
        if (screenshotDataUrl === null) {
          console.log("Taking first screenshot, ensuring canvas is ready");
        }

        // Convert canvas to data URL
        const dataUrl = emulatorCanvas.toDataURL("image/png");

        // Verify the data URL is valid
        if (!dataUrl || dataUrl === "data:,") {
          console.error("Generated data URL is invalid");
          resolve(null);
          return;
        }

        // Check if the data URL is different from the previous one
        // This helps ensure we're not using a stale canvas
        if (dataUrl === screenshotDataUrl) {
          console.log("Screenshot unchanged from previous");
        }

        // Store in ref for immediate access
        latestScreenshotRef.current = dataUrl;

        // Update state for React components
        setScreenshotDataUrl(dataUrl);
        console.log("Screenshot taken successfully");

        // Resolve with the data URL
        resolve(dataUrl);
      } catch (error) {
        console.error("Error taking screenshot:", error);
        resolve(null);
      }
    });
  };

  // Function to register the emulator canvas
  const registerCanvas = (canvas: HTMLCanvasElement) => {
    setEmulatorCanvas(canvas);
  };

  // Function to simulate key press
  const pressKey = (key: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isGameRunning) {
        console.warn("Game is not running, key press ignored");
        resolve();
        return;
      }

      // Map the key to the corresponding keyboard event
      let keyCode: number;
      let keyValue: string;
      switch (key) {
        case "up":
          keyCode = 38; // Arrow Up keyCode
          keyValue = "ArrowUp";
          break;
        case "down":
          keyCode = 40; // Arrow Down keyCode
          keyValue = "ArrowDown";
          break;
        case "left":
          keyCode = 37; // Arrow Left keyCode
          keyValue = "ArrowLeft";
          break;
        case "right":
          keyCode = 39; // Arrow Right keyCode
          keyValue = "ArrowRight";
          break;
        case "a":
          keyCode = 90; // Z keyCode
          keyValue = "z";
          break;
        case "b":
          keyCode = 88; // X keyCode
          keyValue = "x";
          break;
        default:
          console.warn(`Unknown key: ${key}`);
          resolve();
          return;
      }

      // Create keyboard events with necessary properties
      interface KeyboardEventInitWithDeprecated extends KeyboardEventInit {
        keyCode?: number;
        which?: number;
      }

      const keyEventOptions: KeyboardEventInitWithDeprecated = {
        key: keyValue,
        code: keyValue === "z" ? "KeyZ" : keyValue === "x" ? "KeyX" : keyValue,
        bubbles: true,
        cancelable: true,
        view: window,
      };

      // Add deprecated properties that are still needed by some libraries
      keyEventOptions.keyCode = keyCode;
      keyEventOptions.which = keyCode;

      const keyDownEvent = new KeyboardEvent("keydown", keyEventOptions);
      const keyUpEvent = new KeyboardEvent("keyup", keyEventOptions);

      // Dispatch to both document and window for maximum compatibility
      document.dispatchEvent(keyDownEvent);
      window.dispatchEvent(keyDownEvent);

      // Wait a short time and dispatch keyup event
      setTimeout(() => {
        document.dispatchEvent(keyUpEvent);
        window.dispatchEvent(keyUpEvent);

        // Wait a bit longer for the game to process the key press and update the screen
        setTimeout(() => {
          resolve();
        }, 300); // Additional delay to ensure game state is updated
      }, 100);
    });
  };

  // Function to check if a screenshot is ready
  const isScreenshotReady = (): boolean => {
    // Check both the React state and the ref
    return (
      !!emulatorCanvas && (!!screenshotDataUrl || !!latestScreenshotRef.current)
    );
  };

  // Function to get the latest screenshot, bypassing React state if needed
  const getLatestScreenshot = (): string | null => {
    return screenshotDataUrl || latestScreenshotRef.current;
  };

  return (
    <EmulatorContext.Provider
      value={{
        screenshotDataUrl,
        takeScreenshot,
        isScreenshotReady,
        getLatestScreenshot,
        pressKey,
        isGameRunning,
        setIsGameRunning,
        registerCanvas, // Expose this for the GbaEmulator component
      }}
    >
      {children}
    </EmulatorContext.Provider>
  );
}
