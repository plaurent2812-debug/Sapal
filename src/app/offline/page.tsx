"use client";

import Image from "next/image";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <Image
        src="/logo.png"
        alt="SAPAL Signalisation"
        width={200}
        height={64}
        className="h-16 w-auto object-contain mb-10"
      />
      <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <line x1="2" x2="22" y1="2" y2="22" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
          <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
          <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
          <path d="M5 13a10 10 0 0 1 5.24-2.76" />
          <line x1="12" x2="12.01" y1="20" y2="20" />
        </svg>
      </div>
      <h1 className="font-heading text-3xl md:text-4xl mb-4 tracking-tight">
        Vous êtes hors ligne
      </h1>
      <p className="text-muted-foreground text-lg mb-8 max-w-md">
        Vérifiez votre connexion internet et réessayez.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-fill bg-accent text-accent-foreground hover:bg-accent/90 transition-all px-8 py-3.5 font-bold rounded-lg cursor-pointer shadow-lg shadow-accent/20"
      >
        Réessayer
      </button>
    </div>
  );
}
