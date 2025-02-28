import { EmulatorProvider } from "@/components/core/EmulatorContext";
import GbaEmulatorWrapper from "@/components/core/GbaEmulatorWrapper";
import PlayerAgent from "@/components/core/PlayerAgent";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="h-screen flex flex-col items-center justify-center bg-zinc-950 gap-4">
      <EmulatorProvider>
        <div className="w-full max-w-6xl items-center justify-center flex flex-row gap-4">
          {/* Player Agent */}
          <PlayerAgent />
          {/* Emulator */}
          <GbaEmulatorWrapper />
        </div>
      </EmulatorProvider>
      <Link
        href="https://www.helicone.ai"
        className="flex flex-row items-center gap-2 border border-zinc-800 rounded-md py-2.5 px-6 hover:bg-zinc-950 transition-all duration-100"
      >
        <h2 className="text-zinc-100 text-sm">Powered by:</h2>
        <Image
          src="/images/logo.png"
          alt="Helicone Logo"
          width={50}
          height={50}
        />
      </Link>
    </main>
  );
}
