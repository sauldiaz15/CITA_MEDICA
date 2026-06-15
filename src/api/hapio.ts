/**
 * Hapio API Service — Public Booking Client
 */

const API_KEY  = import.meta.env.VITE_HAPIO_API_KEY as string;
const BASE_URL = import.meta.env.VITE_HAPIO_BASE_URL as string;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  name: string;
  enabled: boolean;
  metadata?: any;
}

export interface Service {
  id: string;
  name: string;
  duration?: string | null;
  enabled?: boolean;
}

export interface BookableSlot {
  starts_at: string;
  ends_at: string;
}

export interface BookingPayload {
  resource_id: string;
  service_id: string;
  location_id: string;
  starts_at: string;
  ends_at: string;
  metadata?: any;
}

export interface Booking extends BookingPayload {
  id: string;
  status: string;
}

export class HapioError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'HapioError';
  }
}

// ─── Fetch Helper ─────────────────────────────────────────────────────────────

async function hapioFetch(path: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    clearTimeout(timer);

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        body?.message ||
        (body?.errors ? Object.values(body.errors as Record<string,string[]>).flat()[0] : null) ||
        `Error ${res.status}`;
      throw new HapioError(msg as string, res.status);
    }

    return body;
  } catch (err: any) {
    clearTimeout(timer);
    if (err instanceof HapioError) throw err;
    if (err.name === 'AbortError')
      throw new HapioError('La solicitud tardó demasiado. Intenta de nuevo.', 408);
    throw new HapioError('No se pudo conectar. Verifica tu conexión.', 0);
  }
}

// ─── Recurring Schedule Types ─────────────────────────────────────────────────

export interface RecurringSchedule {
  id: string;
  resource_id: string;
  location_id: string;
  start_date: string;         // YYYY-MM-DD
  end_date?: string | null;   // YYYY-MM-DD | null = sin fin
  interval?: number;          // semanas
  metadata?: {
    services?: string[];      // IDs de servicios disponibles en este turno
    [key: string]: any;
  };
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/** Fetch a single resource by ID */
export async function getResource(id: string): Promise<Resource> {
  const res = await hapioFetch(`/resources/${id}`);
  return res.data || res;
}

/** Fetch all recurring schedules for a resource */
export async function getRecurringSchedules(resourceId: string): Promise<RecurringSchedule[]> {
  const res = await hapioFetch(`/resources/${resourceId}/recurring-schedules`);
  return res.data || res;
}

/** Fetch all services linked to a resource (with full service details) */
export async function getResourceServices(resourceId: string): Promise<Service[]> {
  // The endpoint returns association objects { resource_id, service_id },
  // not full Service objects — so we fetch each service's details individually.
  const res = await hapioFetch(`/resources/${resourceId}/services`);
  const associations: { service_id: string }[] = res.data || res;

  const services = await Promise.all(
    associations.map((a) =>
      hapioFetch(`/services/${a.service_id}`).then((r) => r.data || r)
    )
  );
  return services;
}

/** Fetch a single service by ID */
export async function getService(serviceId: string): Promise<Service> {
  const res = await hapioFetch(`/services/${serviceId}`);
  return res.data || res;
}

/** Fetch available bookable slots for a service, filtered by resource */
export async function getBookableSlots(
  serviceId: string,
  params: Record<string, string>
): Promise<BookableSlot[]> {
  const query = new URLSearchParams(params).toString();
  const res = await hapioFetch(`/services/${serviceId}/bookable-slots?${query}`);
  return res.data || res;
}

/** Fetch all locations */
export async function getLocations(): Promise<{ id: string; name: string; time_zone: string }[]> {
  const res = await hapioFetch('/locations');
  return res.data || res;
}

/** Fetch a single location by ID */
export async function getLocation(id: string): Promise<{ id: string; name: string; time_zone: string }> {
  const res = await hapioFetch(`/locations/${id}`);
  return res.data || res;
}

/** Create a booking with patient metadata */
export async function createBooking(payload: BookingPayload): Promise<Booking> {
  const res = await hapioFetch('/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.data || res;
}
