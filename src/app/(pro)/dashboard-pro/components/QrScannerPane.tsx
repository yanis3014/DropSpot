"use client";

import { useEffect, useRef } from "react";

export interface QrScannerPaneProps {
  active: boolean;
  onScan: (raw: string) => void;
  onCameraUnavailable: () => void;
}

export default function QrScannerPane({
  active,
  onScan,
  onCameraUnavailable,
}: QrScannerPaneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<import("qr-scanner").default | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;

        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          onCameraUnavailable();
          return;
        }

        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            onScan(result.data);
          },
          {
            preferredCamera: "environment",
            highlightScanRegion: false,
            maxScansPerSecond: 3,
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        onCameraUnavailable();
      }
    })();

    return () => {
      cancelled = true;
      void scannerRef.current?.stop();
      void scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [active, onScan, onCameraUnavailable]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      playsInline
      aria-hidden
    />
  );
}
