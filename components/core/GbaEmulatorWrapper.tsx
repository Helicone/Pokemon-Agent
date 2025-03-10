"use client";

import dynamic from "next/dynamic";
import RetroLoadingScreen from "./RetroLoadingScreen";

// Dynamically import the GbaEmulator component with SSR disabled
const GbaEmulator = dynamic(() => import("./GbaEmulator"), {
  ssr: false,
  loading: () => <RetroLoadingScreen />,
});

export default function GbaEmulatorWrapper() {
  return <GbaEmulator />;
}
