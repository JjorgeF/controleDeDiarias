import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  animate?: boolean;
}

export default function Logo({ className, size = 32, animate = false }: LogoProps) {
  return (
    <svg 
      viewBox="0 0 512 512" 
      width={size} 
      height={size} 
      className={`${className || ''} ${animate ? 'animate-gentle-spin' : ''}`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ transformBox: 'fill-box' }}
    >
      <style>{`
        @keyframes logo-spin {
          0% {
            transform: rotate(0deg);
          }
          77.78% { /* 7s - Base gentle rotation at 40 deg/s */
            transform: rotate(280deg);
          }
          83.33% { /* 7.5s - Smoothly accelerating */
            transform: rotate(356.25deg);
          }
          88.89% { /* 8s - Peak gust speed of the spin */
            transform: rotate(500deg);
          }
          91.11% { /* 8.2s - Decelerating back down */
            transform: rotate(561.28deg);
          }
          94.44% { /* 8.5s - Continuing smooth deceleration */
            transform: rotate(643.75deg);
          }
          100% { /* 9s - Back to base speed of 40 deg/s, perfectly looping to 0% */
            transform: rotate(720deg);
          }
        }
        .animate-gentle-spin {
          animation: logo-spin 9s linear infinite;
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
