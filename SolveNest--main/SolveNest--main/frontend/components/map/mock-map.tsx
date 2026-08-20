"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { Location } from '@/services/eo-service';

interface MockMapProps {
  selectedLocation: Location | null;
  onSelectLocation: (location: Location) => void;
  locations: Location[];
}

export const MockMap: React.FC<MockMapProps> = ({
  selectedLocation,
  onSelectLocation,
  locations
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const mapRef = useRef<HTMLDivElement>(null);

  // When a location is selected, center the map pan on it
  useEffect(() => {
    if (selectedLocation) {
      // Calculate target pan to center the marker (selectedLocation.x, selectedLocation.y) in the view
      // Coordinates are 0-100 percentages. Center is 50.
      const targetPanX = (50 - selectedLocation.x) * 4 * zoom;
      const targetPanY = (50 - selectedLocation.y) * 4 * zoom;
      setPan({ x: targetPanX, y: targetPanY });
    }
  }, [selectedLocation, zoom]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 1));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Dragging handlers (Pan)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative w-full h-[350px] md:h-[450px] bg-brand-blue-50 border border-brand-neutral-200 rounded-brand-md overflow-hidden select-none shadow-brand-sm">
      {/* Map Control Buttons */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 bg-white p-1.5 rounded-brand-md border border-brand-neutral-200 shadow-brand-sm">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-brand-neutral-100 rounded text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="h-4.5 w-4.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-brand-neutral-100 rounded text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="h-4.5 w-4.5" />
        </button>
        <div className="border-t border-brand-neutral-100 my-1" />
        <button
          onClick={handleReset}
          className="p-2 hover:bg-brand-neutral-100 rounded text-brand-neutral-700 hover:text-brand-neutral-900 transition-colors"
          title="Reset Map View"
          aria-label="Reset View"
        >
          <RotateCcw className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Map Vector Canvas */}
      <div
        ref={mapRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={clsx(
          "w-full h-full cursor-grab transition-transform duration-200 ease-out",
          { "cursor-grabbing": isDragging }
        )}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center'
        }}
      >
        <svg
          viewBox="0 0 400 400"
          className="w-full h-full min-w-[400px] min-h-[400px] text-brand-neutral-200"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Map Grid Background lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Styled Geographic Features (Vector Landmass Shapes) */}
          {/* Large land mass 1 */}
          <path
            d="M 50,50 Q 80,40 120,60 T 220,50 T 320,80 T 350,180 Q 320,240 280,260 T 150,220 T 60,180 Z"
            fill="#f4fbf7"
            stroke="#bbf7d0"
            strokeWidth="1.5"
          />
          {/* Large land mass 2 */}
          <path
            d="M 120,200 Q 180,180 240,240 T 340,300 T 300,380 Q 220,390 140,350 T 80,280 Z"
            fill="#fafdf6"
            stroke="#d1fae5"
            strokeWidth="1.5"
          />

          {/* Simple Vector River Line */}
          <path
            d="M 0,150 Q 100,140 180,170 T 300,160 T 400,210"
            fill="none"
            stroke="#bae6fd"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 0,150 Q 100,140 180,170 T 300,160 T 400,210"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Simple Vector Road Lines */}
          <path
            d="M 150,0 Q 170,120 160,220 T 180,400"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="3"
            strokeDasharray="4,4"
          />
          <path
            d="M 0,280 Q 200,270 400,290"
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="3"
            strokeDasharray="4,4"
          />

          {/* Render Preset Location Markers */}
          {locations.map((loc) => {
            // Map percentage coordinates (0-100) to SVG canvas coordinates (0-400)
            const markerX = (loc.x / 100) * 400;
            const markerY = (loc.y / 100) * 400;
            const isSelected = selectedLocation?.id === loc.id;

            return (
              <g
                key={loc.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLocation(loc);
                }}
                className="cursor-pointer group"
              >
                {/* Highlight Circle for Hover / Selection */}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r={isSelected ? "18" : "12"}
                  className={clsx(
                    "transition-all duration-300 fill-transparent stroke-2",
                    {
                      "stroke-brand-green-700 fill-brand-green-100/40": isSelected,
                      "stroke-transparent group-hover:stroke-brand-green-600/40 group-hover:fill-brand-green-50/20": !isSelected
                    }
                  )}
                />
                {/* Main Marker Circle */}
                <circle
                  cx={markerX}
                  cy={markerY}
                  r="6"
                  className={clsx(
                    "transition-colors duration-200",
                    {
                      "fill-brand-green-700": isSelected,
                      "fill-brand-neutral-700 group-hover:fill-brand-green-600": !isSelected
                    }
                  )}
                />
                {/* Marker Tooltip label */}
                <text
                  x={markerX}
                  y={markerY - 14}
                  textAnchor="middle"
                  className={clsx(
                    "text-[10px] font-semibold transition-opacity select-none",
                    {
                      "fill-brand-green-700 opacity-100 font-bold": isSelected,
                      "fill-brand-neutral-700 opacity-0 group-hover:opacity-100": !isSelected
                    }
                  )}
                >
                  {loc.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Location Banner (Static map indicator overlay) */}
      {selectedLocation && (
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-brand-neutral-200 px-3 py-2 rounded-brand-md flex items-center gap-2 shadow-brand-sm text-xs font-semibold text-brand-neutral-900 pointer-events-none">
          <MapPin className="h-4 w-4 text-brand-green-700" />
          <span>{selectedLocation.name} Selected</span>
        </div>
      )}
    </div>
  );
};
