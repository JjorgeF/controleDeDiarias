import React, { useState, useEffect } from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

const LOGO_FORMATS = ['png', 'svg', 'webp', 'jpg', 'jpeg'];

export default function Logo({ className = '', size = 32, animate = false }: LogoProps) {
  const [formatIndex, setFormatIndex] = useState(0);
  const [useFallback, setUseFallback] = useState(false);

  // If size or component updates, reset attempt to find custom logo
  useEffect(() => {
    setFormatIndex(0);
    setUseFallback(false);
  }, []);

  const handleImageError = () => {
    if (formatIndex < LOGO_FORMATS.length - 1) {
      setFormatIndex(prev => prev + 1);
    } else {
      setUseFallback(true);
    }
  };

  const currentFormat = LOGO_FORMATS[formatIndex];
  const customLogoSrc = `/brand/logo-custom.${currentFormat}`;

  // Custom keyframes style for the gentle spin rotation
  const animationStyles = animate ? (
    <style>{`
      @keyframes logo-spin {
        0% { transform: rotate(0deg); }
        77.78% { transform: rotate(280deg); }
        83.33% { transform: rotate(356.25deg); }
        88.89% { transform: rotate(500deg); }
        91.11% { transform: rotate(561.28deg); }
        94.44% { transform: rotate(643.75deg); }
        100% { transform: rotate(720deg); }
      }
      .animate-gentle-spin {
        animation: logo-spin 9s linear infinite;
        transform-origin: center;
        will-change: transform;
      }
    `}</style>
  ) : null;

  if (!useFallback) {
    return (
      <div 
        className={`${className} relative flex items-center justify-center`}
        style={{ width: size, height: size }}
      >
        {animationStyles}
        <img
          src={customLogoSrc}
          alt="Logo"
          onError={handleImageError}
          className={`w-full h-full object-contain ${animate ? 'animate-gentle-spin' : ''}`}
          style={{ 
            maxWidth: '100%', 
            maxHeight: '100%',
            imageRendering: 'crisp-edges'
          }}
        />
      </div>
    );
  }

  // Fallback to beautiful, original inline vector SVG logo
  return (
    <svg 
      viewBox="0 0 512 512" 
      width={size} 
      height={size} 
      className={`${className} ${animate ? 'animate-gentle-spin' : ''}`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ transformBox: 'fill-box' }}
    >
      <style>{`
        @keyframes logo-spin-svg {
          0% { transform: rotate(0deg); }
          77.78% { transform: rotate(280deg); }
          83.33% { transform: rotate(356.25deg); }
          88.89% { transform: rotate(500deg); }
          91.11% { transform: rotate(561.28deg); }
          94.44% { transform: rotate(643.75deg); }
          100% { transform: rotate(720deg); }
        }
        .animate-gentle-spin {
          animation: logo-spin-svg 9s linear infinite;
          transform-origin: center;
          will-change: transform;
        }
      `}</style>
      <g transform="translate(256, 256)">
        {/* Yellow Wing (Left / Bottom-Left) - Rotated 270 degrees */}
        <g transform="rotate(270)">
          {/* Solid Triangle */}
          <path 
            d="M 0 0 L 5 -215 L -118 -100 Z" 
            fill="#fcb913" 
          />
          {/* Stripes */}
          {Array.from({ length: 8 }).map((_, i) => {
            const y = -215 + i * 16;
            const xStart = 15 + i * 24;
            const width = 205 - i * 27;
            return (
              <rect 
                key={i}
                x={xStart} 
                y={y} 
                width={width} 
                height={5} 
                rx={1.5}
                fill="#fcb913" 
              />
            );
          })}
        </g>

        {/* Navy Blue Wing (Bottom / Bottom-Right) - Rotated 180 degrees */}
        <g transform="rotate(180)">
          {/* Solid Triangle */}
          <path 
            d="M 0 0 L 5 -215 L -118 -100 Z" 
            fill="#242867" 
          />
          {/* Stripes */}
          {Array.from({ length: 8 }).map((_, i) => {
            const y = -215 + i * 16;
            const xStart = 15 + i * 24;
            const width = 205 - i * 27;
            return (
              <rect 
                key={i}
                x={xStart} 
                y={y} 
                width={width} 
                height={5} 
                rx={1.5}
                fill="#242867" 
              />
            );
          })}
        </g>

        {/* Green Wing (Right / Top-Right) - Rotated 90 degrees */}
        <g transform="rotate(90)">
          {/* Solid Triangle */}
          <path 
            d="M 0 0 L 5 -215 L -118 -100 Z" 
            fill="#1ca249" 
          />
          {/* Stripes */}
          {Array.from({ length: 8 }).map((_, i) => {
            const y = -215 + i * 16;
            const xStart = 15 + i * 24;
            const width = 205 - i * 27;
            return (
              <rect 
                key={i}
                x={xStart} 
                y={y} 
                width={width} 
                height={5} 
                rx={1.5}
                fill="#1ca249" 
              />
            );
          })}
        </g>

        {/* Purple/Magenta Wing (Top / Top-Left) - Rotated 0 degrees */}
        <g transform="rotate(0)">
          {/* Solid Triangle */}
          <path 
            d="M 0 0 L 5 -215 L -118 -100 Z" 
            fill="#b2127a" 
          />
          {/* Stripes */}
          {Array.from({ length: 8 }).map((_, i) => {
            const y = -215 + i * 16;
            const xStart = 15 + i * 24;
            const width = 205 - i * 27;
            return (
              <rect 
                key={i}
                x={xStart} 
                y={y} 
                width={width} 
                height={5} 
                rx={1.5}
                fill="#b2127a" 
              />
            );
          })}
        </g>

        {/* Central White Circle */}
        <circle cx="0" cy="0" r="54" fill="#ffffff" />
      </g>
    </svg>
  );
}
