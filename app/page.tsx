'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  ImagePlus,
  RotateCcw,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CameraOption {
  id: string;
  label: string;
}

interface ScanOutcome {
  status: 'granted' | 'duplicate' | 'invalid' | 'error';
  title: string;
  message: string;
  ticket?: Record<string, any>;
}

function parseScannedHash(raw: string): string {
  const clean = raw.trim();
  if (!clean) return '';

  try {
    const obj = JSON.parse(clean);
    if (obj && typeof obj === 'object') {
      const candidate =
        obj.ticket_hash || obj.ticketHash || obj.hash || obj.reg_no || obj.regNo;
      if (candidate) return String(candidate).trim();
    }
  } catch {
    // Plain text ticket_hash string
  }

  return clean;
}

async function discoverAllCameras(): Promise<CameraOption[]> {
  const map = new Map<string, string>();

  try {
    const qrCams = await Html5Qrcode.getCameras();
    (qrCams || []).forEach((cam, idx) => {
      if (cam?.id) {
        map.set(cam.id, cam.label?.trim() || `Camera ${map.size + 1 || idx + 1}`);
      }
    });
  } catch {
    // Ignore and fall back to mediaDevices
  }

  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoInputs = devices.filter((d) => d.kind === 'videoinput');

      // If labels are empty, briefly open a stream to unlock camera labels on Safari/Chrome
      const hasMissingLabels =
        videoInputs.length === 0 || videoInputs.some((d) => !d.label);

      if (hasMissingLabels && navigator.mediaDevices.getUserMedia) {
        try {
          const probeStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          probeStream.getTracks().forEach((t) => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
          videoInputs = devices.filter((d) => d.kind === 'videoinput');
        } catch {
          // Probe blocked; keep whatever devices were already enumerated
        }
      }

      videoInputs.forEach((dev, idx) => {
        if (!dev.deviceId) return;
        const existing = map.get(dev.deviceId);
        const cleanLabel =
          dev.label?.trim() ||
          existing ||
          `Camera ${map.size + 1 || idx + 1}`;
        map.set(dev.deviceId, cleanLabel);
      });
    } catch {
      // Ignore enumeration errors
    }
  }

  return Array.from(map.entries()).map(([id, label]) => {
    const isIphoneOrContinuity = /iphone|continuity|ios|camo|epoccam/i.test(label);
    return {
      id,
      label: isIphoneOrContinuity && !/iphone/i.test(label) ? `${label} (iPhone)` : label,
    };
  });
}

export default function GateScannerPage() {
  const readerElementId = 'anavitra-gate-qr-reader';
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const processingRef = useRef(false);
  const switchingRef = useRef(false);
  const recentScanRef = useRef<{ hash: string; timestamp: number }>({
    hash: '',
    timestamp: 0,
  });

  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [switchingCamera, setSwitchingCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [volunteerName, setVolunteerName] = useState<string>('Gate Volunteer 1');
  const [lastHash, setLastHash] = useState<string>('');
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  const playTone = useCallback((ok: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(ok ? 880 : 280, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (ok ? 0.1 : 0.22));
    } catch {
      // Ignore browser autoplay block
    }
  }, []);

  const checkAndMarkTicket = useCallback(
    async (decodedPayload: string) => {
      const hash = parseScannedHash(decodedPayload);
      if (!hash || processingRef.current) return;

      const now = Date.now();
      if (
        recentScanRef.current.hash === hash &&
        now - recentScanRef.current.timestamp < 1800
      ) {
        return;
      }

      processingRef.current = true;
      recentScanRef.current = { hash, timestamp: now };
      setLastHash(hash);

      const scannerVolunteer = volunteerName.trim() || 'Gate Volunteer 1';

      try {
        let { data: rows, error: lookupError } = await supabase
          .from('student_tickets')
          .select('*')
          .eq('ticket_hash', hash)
          .limit(1);

        if (lookupError) {
          throw new Error(lookupError.message);
        }

        if (!rows || rows.length === 0) {
          const { data: ilikeRows, error: ilikeError } = await supabase
            .from('student_tickets')
            .select('*')
            .ilike('ticket_hash', hash)
            .limit(1);

          if (ilikeError) {
            throw new Error(ilikeError.message);
          }
          rows = ilikeRows;
        }

        const ticket = rows?.[0];

        if (!ticket) {
          playTone(false);
          setOutcome({
            status: 'invalid',
            title: 'INVALID ENTRY',
            message: `ticket_hash "${hash}" was not found in student_tickets.`,
          });
          return;
        }

        if (ticket.is_scanned) {
          const formattedTime = ticket.scanned_at
            ? new Date(ticket.scanned_at).toLocaleString()
            : 'earlier';
          playTone(false);
          setOutcome({
            status: 'duplicate',
            title: 'ALREADY SCANNED — DUPLICATE ENTRY',
            message: `Checked in at ${formattedTime} by ${
              ticket.scanned_by || 'Gate Scanner'
            }.`,
            ticket,
          });
          return;
        }

        const targetHash = ticket.ticket_hash || hash;
        const scanTimestamp = new Date().toISOString();
        const { data: updatedRows, error: updateError } = await supabase
          .from('student_tickets')
          .update({
            is_scanned: true,
            scanned_at: scanTimestamp,
            scanned_by: scannerVolunteer,
          })
          .eq('ticket_hash', targetHash)
          .select('*');

        if (updateError) {
          throw new Error(updateError.message);
        }

        const checkedInTicket = updatedRows?.[0] || {
          ...ticket,
          ticket_hash: targetHash,
          is_scanned: true,
          scanned_at: scanTimestamp,
          scanned_by: scannerVolunteer,
        };

        playTone(true);
        setOutcome({
          status: 'granted',
          title: 'ACCESS GRANTED — CHECKED IN',
          message: `Scanned at ${new Date(scanTimestamp).toLocaleTimeString()} by ${scannerVolunteer}.`,
          ticket: checkedInTicket,
        });
      } catch (err: any) {
        playTone(false);
        setOutcome({
          status: 'error',
          title: 'SCANNER DATABASE ERROR',
          message: err?.message || 'Failed to verify ticket against database.',
        });
      } finally {
        processingRef.current = false;
      }
    },
    [volunteerName, playTone]
  );

  const ensureScanner = useCallback(() => {
    if (!qrInstanceRef.current && document.getElementById(readerElementId)) {
      qrInstanceRef.current = new Html5Qrcode(readerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });
    }
    return qrInstanceRef.current;
  }, []);

  const launchCamera = useCallback(
    async (cameraId?: string) => {
      const scanner = ensureScanner();
      if (!scanner) return;

      if (scanner.isScanning) {
        await scanner.stop();
      }

      const source = cameraId || { facingMode: 'environment' };
      await scanner.start(
        source,
        { fps: 20 },
        (decodedText) => {
          checkAndMarkTicket(decodedText);
        },
        () => {}
      );

      setCameraError('');
      setCameraActive(true);

      const allCams = await discoverAllCameras();
      if (allCams.length > 0) {
        setCameras(allCams);
      }
    },
    [ensureScanner, checkAndMarkTicket]
  );

  const refreshCamerasOnly = useCallback(async () => {
    const allCams = await discoverAllCameras();
    if (allCams.length > 0) {
      setCameras(allCams);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setCameraError('');
    try {
      const list = await discoverAllCameras();
      setCameras(list);

      const preferred =
        list.find((c) => /iphone|continuity|back|rear|environment/i.test(c.label)) ||
        list[0];
      const chosenId = preferred?.id || '';
      if (chosenId) setActiveCameraId(chosenId);

      await launchCamera(chosenId || undefined);
      await refreshCamerasOnly();
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission blocked. Allow camera access in browser settings and click Start Camera.'
          : err?.message || 'Unable to start camera.'
      );
    }
  }, [launchCamera, refreshCamerasOnly]);

  useEffect(() => {
    startScanner();

    const onDeviceChange = () => {
      refreshCamerasOnly();
    };
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      const scanner = qrInstanceRef.current;
      if (scanner?.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [startScanner, refreshCamerasOnly]);

  const handleCameraChange = async (nextId: string) => {
    if (!nextId || nextId === activeCameraId || switchingRef.current) return;
    switchingRef.current = true;
    setSwitchingCamera(true);
    setActiveCameraId(nextId);

    try {
      await launchCamera(nextId);
    } catch (err: any) {
      setCameraError(err?.message || 'Could not switch camera.');
    } finally {
      setSwitchingCamera(false);
      switchingRef.current = false;
    }
  };

  const handleCycleCamera = async () => {
    if (cameras.length < 2) return;
    const idx = cameras.findIndex((c) => c.id === activeCameraId);
    const next = cameras[(idx + 1) % cameras.length];
    await handleCameraChange(next.id);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const scanner = ensureScanner();
      if (!scanner) return;
      const decoded = await scanner.scanFile(file, true);
      await checkAndMarkTicket(decoded);
    } catch (err: any) {
      setOutcome({
        status: 'invalid',
        title: 'UNREADABLE QR IMAGE',
        message: err?.message || 'Could not decode a QR code from that image.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F4F6F9] font-sans flex flex-col justify-between">
      <div className="h-2 bg-gradient-to-r from-[#D4AF37] via-[#FF5722] to-[#9C27B0]" />

      <header className="border-b border-white/10 bg-[#121212]/90 backdrop-blur-md">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#1A1A1A] border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center shadow">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-base text-[#D4AF37] tracking-wide">
                AnaVITra &apos;26 Gate Scanner
              </span>
              <p className="text-[11px] text-slate-400">Hostel Event Committee (HEC)</p>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#242424] border border-white/15 text-slate-200 transition cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-[#D4AF37]" />
              Scan Image
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto w-full px-4 py-6 flex-1 space-y-5">
        <div className="rounded-3xl bg-[#161616] border border-[#D4AF37]/30 p-4 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37]">
              <Camera className="w-4 h-4" />
              <span>
                {switchingCamera
                  ? 'Switching camera...'
                  : cameraActive
                  ? 'Live Gate Scanner Active'
                  : 'Scanner Standby'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshCamerasOnly}
                disabled={switchingCamera}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-xl bg-[#0B0B0B] hover:bg-[#222] border border-white/15 text-slate-300 transition cursor-pointer"
              >
                Detect Cams
              </button>

              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleCycleCamera}
                  disabled={switchingCamera}
                  className="flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl bg-[#0B0B0B] hover:bg-[#222] border border-[#D4AF37]/40 text-[#D4AF37] transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${switchingCamera ? 'animate-spin' : ''}`} />
                  Swap Camera
                </button>
              )}
            </div>
          </div>

          {cameras.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Camera Source ({cameras.length} available)
              </label>
              <select
                value={activeCameraId}
                onChange={(e) => handleCameraChange(e.target.value)}
                disabled={switchingCamera}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B0B0B] border border-white/10 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                {cameras.map((cam, idx) => (
                  <option key={`${cam.id || 'cam'}-${idx}`} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Volunteer / Counter Name
            </label>
            <input
              type="text"
              value={volunteerName}
              onChange={(e) => setVolunteerName(e.target.value)}
              placeholder="Gate Volunteer 1"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-[#0B0B0B] border border-white/10 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
          </div>
        </div>

        <div className="rounded-3xl bg-[#161616] border border-white/10 p-4 shadow-xl">
          <div className="relative rounded-2xl overflow-hidden bg-black border border-[#D4AF37]/30 min-h-[300px] flex items-center justify-center">
            <div id={readerElementId} className="w-full" />

            {!cameraActive && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <Camera className="w-8 h-8 text-[#D4AF37]" />
                <p className="text-xs text-slate-300 max-w-xs">
                  {cameraError || 'Click Start Camera to begin scanning passes.'}
                </p>
                <button
                  type="button"
                  onClick={startScanner}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-black font-black text-xs cursor-pointer"
                >
                  Start Camera
                </button>
              </div>
            )}

            {switchingCamera && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-xs font-black text-[#D4AF37]">
                Switching Camera...
              </div>
            )}
          </div>

          {lastHash && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400 font-mono break-all">
                Decoded Hash: {lastHash}
              </p>
              <button
                type="button"
                onClick={() => {
                  recentScanRef.current = { hash: '', timestamp: 0 };
                  setOutcome(null);
                  setLastHash('');
                }}
                className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[#D4AF37] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>
          )}
        </div>

        {outcome && (
          <div
            className={`rounded-3xl p-5 border shadow-lg space-y-2 ${
              outcome.status === 'granted'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : outcome.status === 'duplicate'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-red-950/40 border-red-500/40 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-sm">
              {outcome.status === 'granted' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              )}
              {outcome.status === 'duplicate' && (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              {(outcome.status === 'invalid' || outcome.status === 'error') && (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span>{outcome.title}</span>
            </div>

            <p className="text-xs opacity-90">{outcome.message}</p>

            {outcome.ticket && (
              <div className="pt-2.5 border-t border-white/10 text-xs space-y-1 font-bold">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{outcome.ticket.full_name || outcome.ticket.name || 'Student'}</span>
                  <span className="font-mono text-[#D4AF37]">{outcome.ticket.reg_no}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-[11px] opacity-80 font-mono">
                  <span>Volunteer: {outcome.ticket.scanned_by || volunteerName}</span>
                  <span>
                    {outcome.ticket.scanned_at
                      ? new Date(outcome.ticket.scanned_at).toLocaleTimeString()
                      : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-4 text-center text-[11px] text-slate-500">
        AnaVITra &apos;26 &bull; Hostel Event Committee
      </footer>
    </div>
  );
}
