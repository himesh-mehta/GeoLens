import { BackendAPI } from '@/lib/api-client';

export interface Location {
  id: string;
  name: string;
  region: string;
  // X and Y are percentage values (0-100) representing positions on map canvas
  x: number;
  y: number;
  availableDates: string[];
  coordinates?: string;
  samples?: number;
}

export interface ImageryDate {
  id: string;
  label: string;
  isAvailable: boolean;
}

export interface ImageryMetadata {
  locationId: string;
  dateId: string;
  imageUrl: string;
  resolution: string;
  sensor: string;
}

// 12 Indian Regions from SIH EO/ML Dataset (plus legacy demo aliases)
const DEFAULT_LOCATIONS: Location[] = [
  {
    id: "jaipur",
    name: "Jaipur",
    region: "Rajasthan",
    x: 32,
    y: 35,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "26.9124° N, 75.7873° E",
    samples: 500
  },
  {
    id: "pune",
    name: "Pune",
    region: "Maharashtra",
    x: 35,
    y: 62,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "18.5204° N, 73.8567° E",
    samples: 500
  },
  {
    id: "mumbai",
    name: "Mumbai",
    region: "Maharashtra",
    x: 28,
    y: 58,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "19.0760° N, 72.8777° E",
    samples: 500
  },
  {
    id: "bengaluru",
    name: "Bengaluru",
    region: "Karnataka",
    x: 42,
    y: 80,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "12.9716° N, 77.5946° E",
    samples: 500
  },
  {
    id: "ahmedabad",
    name: "Ahmedabad",
    region: "Gujarat",
    x: 25,
    y: 45,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "23.0225° N, 72.5714° E",
    samples: 500
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    region: "Telangana",
    x: 48,
    y: 65,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "17.3850° N, 78.4867° E",
    samples: 500
  },
  {
    id: "chennai",
    name: "Chennai",
    region: "Tamil Nadu",
    x: 52,
    y: 82,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "13.0827° N, 80.2707° E",
    samples: 500
  },
  {
    id: "kolkata",
    name: "Kolkata",
    region: "West Bengal",
    x: 78,
    y: 50,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "22.5726° N, 88.3639° E",
    samples: 500
  },
  {
    id: "nagpur",
    name: "Nagpur",
    region: "Maharashtra",
    x: 52,
    y: 52,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "21.1458° N, 79.0882° E",
    samples: 500
  },
  {
    id: "nashik",
    name: "Nashik",
    region: "Maharashtra",
    x: 32,
    y: 55,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "19.9975° N, 73.7898° E",
    samples: 500
  },
  {
    id: "kochi",
    name: "Kochi",
    region: "Kerala",
    x: 38,
    y: 90,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "9.9312° N, 76.2673° E",
    samples: 500
  },
  {
    id: "guwahati",
    name: "Guwahati",
    region: "Assam",
    x: 88,
    y: 38,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "26.1445° N, 91.7362° E",
    samples: 500
  },
  {
    id: "kolhapur",
    name: "Kolhapur",
    region: "Maharashtra",
    x: 34,
    y: 72,
    availableDates: ["2018", "2024", "may-2022", "may-2025"],
    coordinates: "16.7050° N, 74.2433° E",
    samples: 500
  }
];

const FALLBACK_DATES: ImageryDate[] = [
  { id: "2018", label: "2018 Validated", isAvailable: true },
  { id: "2024", label: "2024 Validated", isAvailable: true },
  { id: "2022", label: "2022 Inference", isAvailable: true },
  { id: "2020", label: "2020 Inference", isAvailable: true },
];

// Helper to generate dynamic top-down satellite/EO-style vector visualizations
function generateDemoSatelliteSvg(locationName: string, dateLabel: string, isBaseline: boolean): string {
  const vegColor = isBaseline ? '#059669' : '#b45309';
  const vegLabel = isBaseline ? 'High Canopy (Vegetation)' : 'Moderate/Reduced Canopy';
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
      <rect width="600" height="400" fill="#0b1120" />
      <defs>
        <pattern id="scan-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <rect width="30" height="30" fill="none" stroke="#1e293b" stroke-width="0.75" />
        </pattern>
      </defs>
      <rect width="600" height="400" fill="url(#scan-grid)" />
      
      <!-- Water body (River / Reservoir) -->
      <path d="M 0,180 C 150,170 250,220 350,200 T 600,230" fill="none" stroke="#0284c7" stroke-width="${isBaseline ? '24' : '18'}" stroke-linecap="round" opacity="0.85" />
      
      <!-- Forest / Vegetation Areas -->
      <path d="M 50,50 L 200,40 L 180,120 L 70,140 Z" fill="${vegColor}" opacity="0.65" stroke="${vegColor}" stroke-width="2" />
      <path d="M 400,60 L 520,80 L 480,150 L 380,110 Z" fill="${vegColor}" opacity="0.65" stroke="${vegColor}" stroke-width="2" />
      ${isBaseline ? `
      <path d="M 280,80 L 350,70 L 340,130 L 260,110 Z" fill="${vegColor}" opacity="0.65" stroke="${vegColor}" stroke-width="2" />
      <path d="M 100,260 L 220,280 L 190,350 L 80,330 Z" fill="${vegColor}" opacity="0.65" stroke="${vegColor}" stroke-width="2" />
      ` : ''}
      
      <!-- Built-up Urban Structures -->
      <rect x="55" y="225" width="40" height="30" fill="#64748b" rx="2" opacity="0.85" />
      <rect x="105" y="215" width="30" height="35" fill="#64748b" rx="2" opacity="0.85" />
      <rect x="420" y="240" width="50" height="40" fill="#64748b" rx="2" opacity="0.85" />
      <rect x="480" y="250" width="35" height="30" fill="#64748b" rx="2" opacity="0.85" />
      ${!isBaseline ? `
      <!-- Expanded built-up in current year -->
      <rect x="370" y="260" width="40" height="30" fill="#e11d48" rx="2" opacity="0.8" stroke="#f43f5e" stroke-width="1.5" />
      <rect x="440" y="295" width="45" height="35" fill="#e11d48" rx="2" opacity="0.8" stroke="#f43f5e" stroke-width="1.5" />
      <rect x="145" y="205" width="35" height="30" fill="#e11d48" rx="2" opacity="0.8" stroke="#f43f5e" stroke-width="1.5" />
      ` : ''}
      
      <!-- Header Overlay with Scientific Disclaimer -->
      <rect x="15" y="15" width="270" height="80" fill="#0f172a" rx="6" opacity="0.92" stroke="#334155" stroke-width="1" />
      <text x="25" y="32" fill="#38bdf8" font-family="monospace" font-size="10" font-weight="bold">SIH EO MULTIMODAL PLATFORM</text>
      <text x="25" y="48" fill="#f59e0b" font-family="sans-serif" font-size="11" font-weight="bold">DEMO / FEATURE-DERIVED</text>
      <text x="25" y="65" fill="#cbd5e1" font-family="sans-serif" font-size="10">Region: ${locationName}</text>
      <text x="25" y="80" fill="#94a3b8" font-family="sans-serif" font-size="9.5">Period: ${dateLabel}</text>
      
      <!-- Legend -->
      <g transform="translate(15, 295)">
        <rect width="210" height="90" fill="#0f172a" stroke="#334155" stroke-width="1" rx="6" opacity="0.92" />
        <text x="10" y="18" fill="#f8fafc" font-family="sans-serif" font-size="10" font-weight="bold">Land-Cover Spectral Layers</text>
        
        <circle cx="15" cy="35" r="5" fill="${vegColor}" opacity="0.8" />
        <text x="28" y="38" fill="#cbd5e1" font-family="sans-serif" font-size="9">${vegLabel}</text>
        
        <rect x="10" y="48" width="10" height="10" fill="#e11d48" opacity="0.85" />
        <text x="28" y="56" fill="#cbd5e1" font-family="sans-serif" font-size="9">Built-up / Urban Expansion</text>
        
        <rect x="10" y="65" width="10" height="6" fill="#0284c7" opacity="0.85" />
        <text x="28" y="71" fill="#cbd5e1" font-family="sans-serif" font-size="9">Water Bodies</text>
      </g>
    </svg>
  `;
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const eoService = {
  /**
   * Search for a location in the database
   */
  searchLocation: async (query: string): Promise<Location | null> => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return null;
    
    const all = await eoService.getAllLocations();
    return all.find(
      loc => loc.name.toLowerCase().includes(cleanQuery) || 
             loc.region.toLowerCase().includes(cleanQuery) ||
             loc.id.toLowerCase() === cleanQuery
    ) || null;
  },

  /**
   * Get a location by its ID
   */
  getLocationById: async (id: string): Promise<Location | null> => {
    const cleanId = id.toLowerCase().trim();
    
    // Support custom coordinates created from map clicks
    if (cleanId.startsWith('custom-')) {
      const parts = cleanId.split('-');
      if (parts.length >= 3) {
        const lat = parseFloat(parts[1]);
        const lon = parseFloat(parts[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
          return {
            id: cleanId,
            name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            region: 'Custom Location',
            x: 0,
            y: 0,
            availableDates: ["2018", "2024", "may-2022"],
            coordinates: `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`
          };
        }
      }
    }

    const all = await eoService.getAllLocations();
    return all.find(loc => loc.id === cleanId) || null;
  },

  /**
   * Get all 12 locations from ML backend or default list
   */
  getAllLocations: async (): Promise<Location[]> => {
    try {
      const backendData = await BackendAPI.getRegions();
      if (backendData && backendData.regions && backendData.regions.length > 0) {
        // Map backend regions to Location objects
        return DEFAULT_LOCATIONS;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_LOCATIONS;
  },

  /**
   * Get available imagery dates list
   */
  getAvailableDates: async (locationId: string): Promise<ImageryDate[]> => {
    try {
      const backendYears = await BackendAPI.getYears();
      if (backendYears && Array.isArray(backendYears)) {
        return backendYears.map((y: any) => ({
          id: String(y.year),
          label: `${y.year} ${y.status === 'validated' ? 'Validated' : 'Inference'}`,
          isAvailable: y.prediction_available
        }));
      }
    } catch (e) {
      console.warn("Failed to fetch dynamic years:", e);
    }
    return FALLBACK_DATES;
  },

  /**
   * Get the imagery URL/path for a location and date
   */
  getImagery: async (locationId: string, dateId: string): Promise<string | null> => {
    const loc = await eoService.getLocationById(locationId);
    const locName = loc ? loc.name : locationId.charAt(0).toUpperCase() + locationId.slice(1);
    
    const isBaseline = dateId === "2018" || dateId.includes("2018");
    const dateLabel = dateId;
    
    return generateDemoSatelliteSvg(locName, dateLabel, isBaseline);
  }
};
