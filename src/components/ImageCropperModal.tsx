import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export default function ImageCropperModal({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete
}: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef(1);

  // Reset controls when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
      setIsProcessing(false);
    }
  }, [isOpen, imageSrc]);

  // Handle Drag Start (Mouse & Touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      positionStartRef.current = { ...position };
      initialTouchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistanceRef.current = dist;
      initialZoomRef.current = zoom;
    }
  };

  // Handle Drag Move (Mouse & Touch)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy
    });
  }, [isDragging]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy
      });
    } else if (e.touches.length === 2 && initialTouchDistanceRef.current !== null) {
      // Pinch to zoom move
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / initialTouchDistanceRef.current;
      const newZoom = Math.min(Math.max(initialZoomRef.current * factor, 1), 3);
      setZoom(newZoom);
    }
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    initialTouchDistanceRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  // Handle Rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Generate cropped result
  const handleCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;
    try {
      setIsProcessing(true);
      const outputSize = 350; // Output high quality avatar dimension
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imageRef.current;
      const cropAreaSize = 260; // Size of the circular crop box in UI (px)

      // Calculate relative scale between natural image size and display size
      const displayedWidth = img.width * zoom;
      const displayedHeight = img.height * zoom;

      // Draw background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outputSize, outputSize);

      ctx.save();
      // Move origin to center of output canvas
      ctx.translate(outputSize / 2, outputSize / 2);

      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Scale factor from crop area in UI (260px) to output canvas (350px)
      const scaleToOutput = outputSize / cropAreaSize;

      // Position offset relative to center of crop area
      const offsetX = position.x * scaleToOutput;
      const offsetY = position.y * scaleToOutput;

      // Render image scaled and centered
      const renderWidth = displayedWidth * scaleToOutput;
      const renderHeight = displayedHeight * scaleToOutput;

      ctx.drawImage(
        img,
        -renderWidth / 2 + offsetX,
        -renderHeight / 2 + offsetY,
        renderWidth,
        renderHeight
      );

      ctx.restore();

      // Export as high quality JPEG/WebP dataUrl
      let dataUrl = '';
      try {
        dataUrl = canvas.toDataURL('image/webp', 0.88);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        }
      } catch {
        dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      }

      onCropComplete(dataUrl);
      onClose();
    } catch (err) {
      console.error('Error during image crop:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-brand-card border border-brand-border/60 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/40 bg-slate-900/40">
          <h3 className="font-bold text-base text-amber-400 dark:text-[#f2d861] flex items-center gap-2">
            <Move size={18} className="text-amber-400 dark:text-[#f2d861]" />
            Ajustar Foto de Perfil
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Crop Viewport */}
        <div className="p-4 flex flex-col items-center">
          <p className="text-xs text-slate-300 text-center mb-3">
            Arraste e dê zoom para posicionar o rosto no círculo.
          </p>

          <div
            ref={containerRef}
            className="relative w-[280px] h-[280px] bg-slate-950 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none border border-slate-800 flex items-center justify-center touch-none shadow-inner"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Movable & Zoomable Image */}
            <div
              className="absolute flex items-center justify-center transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
            >
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Foto para ajustar"
                className="max-w-[260px] max-h-[260px] object-contain pointer-events-none"
                draggable={false}
              />
            </div>

            {/* Dark Overlay with Circular Cutout (Visual Crop Mask) */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
              {/* Outer dark vignette mask using box-shadow */}
              <div 
                className="w-[240px] h-[240px] rounded-full border-2 border-amber-400 dark:border-[#f2d861] shadow-[0_0_0_9999px_rgba(15,23,42,0.75)]"
              />
            </div>
          </div>

          {/* Controls: Zoom & Rotate */}
          <div className="w-full max-w-[280px] mt-4 flex flex-col gap-3">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              <button
                onClick={() => setZoom(prev => Math.max(prev - 0.2, 1))}
                className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors"
                title="Reduzir zoom"
              >
                <ZoomOut size={18} />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-amber-400 dark:accent-[#f2d861] cursor-pointer"
              />
              <button
                onClick={() => setZoom(prev => Math.min(prev + 0.2, 3))}
                className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors"
                title="Aumentar zoom"
              >
                <ZoomIn size={18} />
              </button>
            </div>

            {/* Rotate & Reset Action Row */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                <RotateCw size={14} />
                <span>Girar 90°</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPosition({ x: 0, y: 0 });
                  setRotation(0);
                }}
                className="text-slate-400 hover:text-slate-200 underline"
              >
                Centralizar
              </button>
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-brand-border/40 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCrop}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 dark:bg-[#f2d861] dark:text-slate-950 dark:hover:bg-[#f8e384] transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            <Check size={16} />
            <span>{isProcessing ? 'Processando...' : 'Confirmar e Salvar'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
