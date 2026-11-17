export interface GoogleBusinessConfig {
  businessName: string;
  address: string;
  placeId: string;
  locationId: string;
  apiKey: string;
  reviewUrl: string;
  mapsUrl: string;
  rating: number;
  reviewCount: number;
  isCustomUrlSet: boolean;
  updatedAt?: string;
}

const STORAGE_KEY_CONFIG = 'lume_google_business_config_v1';
const STORAGE_KEY_REVIEWS = 'lume_real_reviews_v1';

export const DEFAULT_GOOGLE_CONFIG: GoogleBusinessConfig = {
  businessName: 'Lume Nails',
  address: 'Seu estúdio de beleza',
  placeId: '',
  locationId: '',
  apiKey: '',
  // Direct Google search & review link for Lume Nails
  reviewUrl: 'https://www.google.com/maps/search/?api=1&query=Lume+Nails+Seu+estúdio+de+beleza',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Seu+estúdio+de+beleza',
  rating: 5.0,
  reviewCount: 0,
  isCustomUrlSet: false,
};

export function getGoogleBusinessConfig(): GoogleBusinessConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      return { ...DEFAULT_GOOGLE_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to parse Google Business config', e);
  }
  return DEFAULT_GOOGLE_CONFIG;
}

export function saveGoogleBusinessConfig(config: GoogleBusinessConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Google Business config', e);
  }
}

export function buildGoogleDirectReviewUrl(placeIdOrUrl: string): string {
  if (!placeIdOrUrl) return DEFAULT_GOOGLE_CONFIG.reviewUrl;
  const trimmed = placeIdOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // If it's a Place ID (e.g. ChIJ...)
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(trimmed)}`;
}

export function getQrCodeUrl(targetUrl: string, size = 260): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    targetUrl
  )}&margin=10`;
}
