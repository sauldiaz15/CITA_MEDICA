/**
 * Google Sheets — Patient Lookup & Registration
 * Calls the deployed Google Apps Script Web App as a proxy.
 *
 * Set VITE_SHEETS_SCRIPT_URL in .env to the deployed Web App URL.
 */

const SCRIPT_URL = import.meta.env.VITE_SHEETS_SCRIPT_URL as string;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PatientFound {
  found: true;
  telefono: string;
  nombre: string;
  email: string;
  fecha_nac: string;
}

export interface PatientNotFound {
  found: false;
}

export type PatientLookupResult = PatientFound | PatientNotFound;

export interface RegisterPayload {
  telefono: string;
  nombre: string;
  email?: string;
  fecha_nac: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * Busca un paciente por número de teléfono en Google Sheets.
 */
export async function lookupPatientByPhone(telefono: string): Promise<PatientLookupResult> {
  if (!SCRIPT_URL) {
    console.warn('[sheets] VITE_SHEETS_SCRIPT_URL no configurada — lookup omitido.');
    return { found: false };
  }

  const url = `${SCRIPT_URL}?action=lookup&telefono=${encodeURIComponent(telefono)}`;

  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    throw new Error(`Error al consultar pacientes (HTTP ${res.status})`);
  }

  const data: PatientLookupResult = await res.json();
  return data;
}

/**
 * Registra un nuevo paciente en Google Sheets.
 */
export async function registerPatient(payload: RegisterPayload): Promise<void> {
  if (!SCRIPT_URL) {
    throw new Error('VITE_SHEETS_SCRIPT_URL no configurada.');
  }

  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // Evita el CORS preflight (OPTIONS)
    body: JSON.stringify({ action: 'register', ...payload }),
  });

  if (!res.ok) {
    throw new Error(`Error en el servidor de Google (HTTP ${res.status})`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'No se pudo registrar el paciente en Sheets.');
  }
}
