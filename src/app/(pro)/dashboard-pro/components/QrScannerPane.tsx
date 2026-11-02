"use client";

import { useEffect, useRef } from "react";

export interface QrScannerPaneProps {
  active: boolean;
  onScan: (raw: string) => void;
  onCameraUnavailable: () => void;
}

/**
 * Camera + QR decoding for the counter screen.
 *
 * The camera starts once per `active` period. Callbacks are read through refs
 * so a parent re-render (plan, café, role loading…) never stops and restarts
 * the camera: on phones a restart can leave a black video, or make the second
 * getUserMedia fail and drop the counter into manual entry.
 */
export default function QrScannerPane({
  active,
  onScan,
  onCameraUnavailable,
}: QrScannerPaneProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const onUnavailableRef = useRef(onCameraUnavailable);

  useEffect(() => {
    onScanRef.current = onScan;
    onUnavailableRef.current = onCameraUnavailable;
  }, [onScan, onCameraUnavailable]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let scanner: import("qr-scanner").default | null = null;

    const dispose = () => {
      if (!scanner) return;
      scanner.stop();
      scanner.destroy();
      scanner = null;
    };

    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;

        const hasCamera = await QrScanner.hasCamera();
        if (cancelled) return;
        if (!hasCamera) {
          onUnavailableRef.current();
          return;
        }

        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (!cancelled) onScanRef.current(result.data);
          },
          {
            preferredCamera: "environment",
            highlightScanRegion: false,
            maxScansPerSecond: 3,
            returnDetailedScanResult: true,
          }
        );
        await scanner.start();
        // Unmounted while the camera was opening: release it right away.
        if (cancelled) dispose();
      } catch {
        dispose();
        if (!cancelled) onUnavailableRef.current();
      }
    })();

    return () => {
      cancelled = true;
      dispose();
    };
  }, [active]);

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
