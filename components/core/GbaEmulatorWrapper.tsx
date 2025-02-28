"use client";

import dynamic from "next/dynamic";

// Loading component for the dynamic import
const LoadingEmulator = () => (
  <div className="w-full h-[400px] flex items-center justify-center bg-muted rounded-md">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
      <p>Loading emulator...</p>
    </div>
  </div>
);

// Dynamically import the GbaEmulator component with SSR disabled
const GbaEmulator = dynamic(() => import("./GbaEmulator"), {
  ssr: false,
  loading: () => <LoadingEmulator />,
});

export default function GbaEmulatorWrapper() {
  return <GbaEmulator />;
}
