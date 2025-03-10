"use client";

import React from "react";

interface RetroLoadingScreenProps {
  title?: string;
  message?: string;
  height?: string;
}

export const RetroLoadingScreen: React.FC<RetroLoadingScreenProps> = ({
  title = "GAME BOY ADVANCE",
  message = "NOW LOADING...",
  height = "400px",
}) => (
  <div
    className="w-full flex items-center justify-center bg-black rounded-md"
    style={{ imageRendering: "pixelated", height }}
  >
    <div className="flex flex-col items-center text-center">
      <div className="border-4 border-white p-6 bg-black">
        <h2
          className="text-white font-bold text-xl mb-4"
          style={{ fontFamily: "monospace" }}
        >
          {title}
        </h2>
        <div className="flex justify-center mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-4 h-4 mx-1 bg-white animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                boxShadow: "0 0 5px #fff",
              }}
            />
          ))}
        </div>
        <p className="text-white" style={{ fontFamily: "monospace" }}>
          {message}
        </p>
      </div>
    </div>
  </div>
);

export default RetroLoadingScreen;
