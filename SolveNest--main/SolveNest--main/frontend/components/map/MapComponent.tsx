"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
  center?: [number, number];
  zoom?: number;
  onPointSelected?: (lat: number, lon: number) => void;
  onPolygonSelected?: (coords: [number, number][]) => void;
  selectedPoint?: [number, number] | null;
  selectedPolygon?: [number, number][] | null;
  drawMode?: 'point' | 'polygon' | 'none';
  layerMode?: 'map' | 'satellite';
}

function MapEvents({ onMapClick }: { onMapClick: (e: any) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
  });
  return null;
}

export default function MapComponent({
  center = [20.5937, 78.9629],
  zoom = 5,
  onPointSelected,
  onPolygonSelected,
  selectedPoint,
  selectedPolygon,
  drawMode = 'none',
  layerMode = 'map'
}: MapProps) {
  const [polygonCoords, setPolygonCoords] = useState<[number, number][]>([]);

  const handleMapClick = (e: any) => {
    if (drawMode === 'point') {
      if (onPointSelected) onPointSelected(e.latlng.lat, e.latlng.lng);
    } else if (drawMode === 'polygon') {
      const newCoords = [...polygonCoords, [e.latlng.lat, e.latlng.lng] as [number, number]];
      setPolygonCoords(newCoords);
      if (newCoords.length >= 3 && onPolygonSelected) {
          onPolygonSelected(newCoords);
      }
    }
  };

  useEffect(() => {
    if (!selectedPolygon) {
      setPolygonCoords([]);
    }
  }, [selectedPolygon]);

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 10 }}>
      {layerMode === 'map' ? (
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      ) : (
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      )}

      <MapEvents onMapClick={handleMapClick} />

      {selectedPoint && (
        <Marker position={selectedPoint}>
          <Popup>Selected Location: {selectedPoint[0].toFixed(4)}, {selectedPoint[1].toFixed(4)}</Popup>
        </Marker>
      )}

      {(selectedPolygon || polygonCoords.length > 0) && (
        <Polygon positions={selectedPolygon || polygonCoords} color="#10b981" />
      )}
    </MapContainer>
  );
}
