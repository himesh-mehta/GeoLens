"use client";

import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
      <div className="text-slate-400 font-medium">Loading Interactive Map...</div>
    </div>
  ),
});

export default MapComponent;
