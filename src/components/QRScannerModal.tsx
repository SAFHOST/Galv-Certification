import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Image as ImageIcon, X, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (certId: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanned }) => {
  const [mode, setMode] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    if (mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  const startCamera = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraError('Camera access unavailable or permission denied. You can upload a photo of the QR code or enter the Certificate ID below.');
      setMode('upload');
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const scanVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleExtractedData(code.data);
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  const handleExtractedData = (rawText: string) => {
    stopCamera();
    // Parse URL e.g. "https://.../verify/MYF-QC-25-116" or direct ID
    let extractedId = rawText.trim();
    if (extractedId.includes('/verify/')) {
      const parts = extractedId.split('/verify/');
      extractedId = decodeURIComponent(parts[1].split('?')[0].split('#')[0]);
    }
    onScanned(extractedId);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleExtractedData(code.data);
        } else {
          setCameraError('No valid QR code was detected in the uploaded image. Please try a clearer photo or enter ID manually.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleExtractedData(manualInput);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">Field QR Code Scanner</h3>
            <p className="text-xs text-slate-500">Scan on-site industrial certificate to verify authenticity</p>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Mode Selector */}
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex gap-2">
          <button
            onClick={() => setMode('camera')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'camera' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Live Camera
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'upload' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Upload Photo
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
              mode === 'manual' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manual ID
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {mode === 'camera' && (
            <div className="flex flex-col items-center">
              <div className="relative w-full aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-300 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Target Finder Overlay */}
                <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-full h-0.5 bg-emerald-400/60 animate-pulse" />
                </div>

                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-white text-xs">
                    Initializing camera...
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500 text-center">
                Align the QR code from the top-right header of the certificate inside the frame.
              </p>
            </div>
          )}

          {mode === 'upload' && (
            <div className="flex flex-col items-center">
              <label className="w-full border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                <ImageIcon className="w-10 h-10 text-slate-400 mb-2" />
                <span className="text-sm font-semibold text-slate-700">Select Certificate Image</span>
                <span className="text-xs text-slate-500 mt-1">PNG, JPG, or screenshot of QR code</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {cameraError && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>{cameraError}</span>
                </div>
              )}
            </div>
          )}

          {mode === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Certificate Reference ID
                </label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g. MYF-QC-25-116"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono uppercase"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  You can also paste the full verification link from a QR code.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualInput('MYF-QC-25-116')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Fill Sample (MYF-QC-25-116)
                </button>
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg cursor-pointer"
                >
                  Verify Record
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
