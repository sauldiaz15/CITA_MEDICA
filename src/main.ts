import './style.css';
import {
  getResource, getRecurringSchedules, getResourceServices, getService,
  getBookableSlots, getLocation, getLocations, createBooking,
  type BookableSlot, type Service, type RecurringSchedule,
} from './api/hapio';
import { lookupPatientByPhone, registerPatient } from './api/sheets';

// ── State ─────────────────────────────────────────────────────────────────────
interface State {
  step: 1 | 2 | 3 | 4;
  resourceId: string;
  resourceName: string;
  serviceId: string;
  serviceName: string;
  locationId: string;
  locationName: string;
  locationTimezone: string;
  locations: { id: string; name: string; time_zone: string }[];
  allSchedules: RecurringSchedule[];
  // Step 2 — Patient data
  telefono: string;
  nombre: string;
  email: string;
  fechaNac: string;
  // Step 2 — Lookup state
  lookupLoading: boolean;
  lookupDone: boolean;
  patientFound: boolean;
  // Step 3
  selectedDate: Date | null;
  selectedSlot: BookableSlot | null;
  calendarMonth: Date;
  slots: BookableSlot[];
  slotsLoading: boolean;
  // Disponibilidad del mes
  availableDates: Set<string>;
  availableDatesLoaded: boolean;
  availableDatesLoading: boolean;
}

const state: State = {
  step: 1,
  resourceId: '',
  resourceName: 'Cargando…',
  serviceId: '',
  serviceName: '',
  locationId: '',
  locationName: '',
  locationTimezone: 'UTC',
  locations: [],
  allSchedules: [],
  telefono: '', nombre: '', email: '', fechaNac: '',
  lookupLoading: false, lookupDone: false, patientFound: false,
  selectedDate: null,
  selectedSlot: null,
  calendarMonth: new Date(),
  slots: [],
  slotsLoading: false,
  availableDates: new Set(),
  availableDatesLoaded: false,
  availableDatesLoading: false,
};

// ── Icons (inline SVG strings) ────────────────────────────────────────────────
const icons = {
  back: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><polyline points="15 18 9 12 15 6"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>`,
  chevL: `&#8249;`,
  chevR: `&#8250;`,
  person: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  cal: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  steth: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>`,
  phone: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  mail: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>`,
  warn: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  cross: `<svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-7 3a1 1 0 0 1 1 1v5a1 1 0 0 1-2 0V7a1 1 0 0 1 1-1zm0 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>`,
  pin: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  svc: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,

};

// ── Helpers ───────────────────────────────────────────────────────────────────
const app = document.getElementById('app')!;

function fmt(date: Date) {
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtTime(iso: string) {
  // Extract HH:MM directly from the ISO string to avoid browser timezone conversion.
  // The API returns times already in the resource's local timezone (e.g. -04:00 La Paz).
  // Using new Date() would shift 09:00-04:00 → 10:00 in Argentina (-03:00).
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : iso;
}

function isToday(d: Date) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

// ── Step indicator ────────────────────────────────────────────────────────────
function stepsHTML(current: 1 | 2 | 3 | 4) {
  const labels = ['Datos', 'Sede', 'Fecha', 'Listo'];
  return labels.map((lbl, i) => {
    const n = i + 1;
    const cls = n < current ? 'step completed' : n === current ? 'step active' : 'step';
    const inner = n < current ? icons.check : `${n}`;
    return `<div class="${cls}"><div class="step-circle">${inner}</div><span class="step-label">${lbl}</span></div>`;
  }).join('');
}

function headerHTML(showBack = false) {
  return `
    <div class="wizard-header">
      ${showBack ? `<button class="btn-back" id="btn-back">${icons.back} Volver</button>` : ''}
      <div class="header-clinic">
        <div class="header-icon">${icons.cross}</div>
        <div>
          <div class="header-name">${state.resourceName}</div>
          <div class="header-subtitle">Agenda tu cita médica</div>
        </div>
      </div>
      <div class="steps">${stepsHTML(state.step)}</div>
    </div>`;
}

function footerHTML() {
  return `<div class="wizard-footer">Powered by MediCita · Seguro y privado</div>`;
}

// ── STEP 1 — Phone Lookup + Patient Data ───────────────────────────────────────
function renderStep1() {
  app.innerHTML = `
    <div class="wizard-card">
      ${headerHTML(false)}
      <div class="wizard-body">
        <h1 class="step-title">Verificá tu número</h1>
        <p class="step-desc">Ingresá tu WhatsApp para buscar tu registro.</p>
        <div id="step1-alert"></div>
        <div class="form-group">
          <label class="form-label" for="inp-telefono">WhatsApp / Teléfono</label>
          <div class="lookup-row">
            <input class="form-input" id="inp-telefono" type="tel"
              placeholder="Ej: +54 9 11 1234-5678"
              value="${state.telefono}" autocomplete="tel" />
            <button class="btn-lookup" id="btn-buscar">Buscar</button>
          </div>
          <span class="form-error" id="err-telefono">Ingresá un número válido (mínimo 7 dígitos).</span>
        </div>
        <div id="lookup-result"></div>
      </div>
      ${footerHTML()}
    </div>`;

  document.getElementById('btn-buscar')!.addEventListener('click', doLookup);
  document.getElementById('inp-telefono')!.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') doLookup();
  });

  if (state.telefono && !state.lookupDone) doLookup();
  else if (state.lookupDone) renderLookupResult();
}

// ── STEP 2 — Location Selection ────────────────────────────────────────────────
function renderStep2() {
  const locationBtns = state.locations.map((loc, i) => `
    <button class="location-option ${state.locationId === loc.id ? 'selected' : ''}"
      id="loc-btn-${i}" data-locid="${loc.id}" data-locname="${loc.name}" data-tz="${loc.time_zone}">
      <div class="location-option-icon">${icons.pin}</div>
      <span class="location-option-name">${loc.name}</span>
      <div class="location-option-check">${icons.check}</div>
    </button>`).join('');

  app.innerHTML = `
    <div class="wizard-card">
      ${headerHTML(true)}
      <div class="wizard-body">
        <h1 class="step-title">¿Dónde querés atenderte?</h1>
        <p class="step-desc">Elegí la sede donde se realizará tu cita.</p>
        <div id="step2-loc-alert"></div>
        <div class="location-list">${locationBtns}</div>
        <button class="btn-primary" id="btn-next2" ${state.locationId ? '' : 'disabled'}>Continuar →</button>
      </div>
      ${footerHTML()}
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => { state.step = 1; renderStep1(); });

  state.locations.forEach((loc, i) => {
    document.getElementById(`loc-btn-${i}`)!.addEventListener('click', () => {
      document.querySelectorAll('.location-option').forEach(el => el.classList.remove('selected'));
      document.getElementById(`loc-btn-${i}`)!.classList.add('selected');
      state.locationId       = loc.id;
      state.locationName     = loc.name;
      state.locationTimezone = loc.time_zone || 'UTC';
      const btn = document.getElementById('btn-next2') as HTMLButtonElement;
      if (btn) btn.disabled = false;
    });
  });

  document.getElementById('btn-next2')!.addEventListener('click', selectLocationAndContinue);
}

async function selectLocationAndContinue() {
  if (!state.locationId) return;
  const btn = document.getElementById('btn-next2') as HTMLButtonElement;
  btn.classList.add('loading'); btn.disabled = true;

  try {
    const schedulesForLoc = state.allSchedules.filter(s => (s.location_id || (s as any).location?.id) === state.locationId);
    const activeSchedule  = findActiveSchedule(schedulesForLoc.length ? schedulesForLoc : state.allSchedules);
    const metaSvcIds: string[] = activeSchedule?.metadata?.services ?? [];

    let services: Service[] = [];
    if (metaSvcIds.length > 0) {
      const fetched = await Promise.allSettled(metaSvcIds.map(id => getService(id)));
      services = fetched
        .filter((r): r is PromiseFulfilledResult<Service> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(s => s.enabled !== false);
    }
    if (services.length === 0) {
      const global = await getResourceServices(state.resourceId);
      services = global.filter((s: Service) => s.enabled !== false);
    }
    const svc = services.find(s => s.duration !== 'P1D') || services[0];
    if (!svc) throw new Error('Esta sede no tiene servicios disponibles.');

    state.serviceId   = svc.id;
    state.serviceName = svc.name;
    state.step = 3;
    renderStep3();
  } catch (err: any) {
    btn.classList.remove('loading'); btn.disabled = false;
    const alertEl = document.getElementById('step2-loc-alert');
    if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">${icons.warn} ${err.message}</div>`;
  }
}


async function doLookup() {
  const input = document.getElementById('inp-telefono') as HTMLInputElement | null;
  const tel = (input?.value ?? state.telefono).trim();

  const errEl = document.getElementById('err-telefono')!;
  const inpEl = document.getElementById('inp-telefono') as HTMLElement | null;

  if (tel.replace(/\D/g, '').length < 7) {
    errEl.classList.add('visible');
    inpEl?.classList.add('error');
    return;
  }
  errEl.classList.remove('visible');
  inpEl?.classList.remove('error');

  state.telefono = tel;
  state.lookupLoading = true;
  state.lookupDone = false;
  renderLookupResult();

  try {
    const result = await lookupPatientByPhone(tel);
    if (result.found) {
      state.nombre      = result.nombre;
      state.email       = result.email;
      state.fechaNac    = result.fecha_nac;
      state.patientFound = true;
    } else {
      state.nombre = ''; state.email = ''; state.fechaNac = '';
      state.patientFound = false;
    }
    state.lookupDone = true;
  } catch (err: any) {
    console.error('[lookup]', err);
    const alertEl = document.getElementById('step1-alert');
    if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">${icons.warn} ${err.message || 'Error al buscar. Intenta de nuevo.'}</div>`;
    state.lookupDone = false;
  } finally {
    state.lookupLoading = false;
    renderLookupResult();
  }
}

function renderLookupResult() {
  const el = document.getElementById('lookup-result');
  if (!el) return;

  if (state.lookupLoading) {
    el.innerHTML = `<div class="slots-loading"><div class="mini-spinner"></div> Buscando registro…</div>`;
    return;
  }

  if (!state.lookupDone) { el.innerHTML = ''; return; }

  if (state.patientFound) {
    el.innerHTML = `
      <div class="lookup-found-badge">${icons.check} Paciente encontrado</div>
      <div class="summary-card" style="margin-top:12px">
        <div class="summary-row">
          <div class="summary-icon">${icons.person}</div>
          <div class="summary-info"><div class="summary-key">Nombre</div><div class="summary-val">${state.nombre}</div></div>
        </div>
        ${state.email ? `<div class="summary-row">
          <div class="summary-icon">${icons.mail}</div>
          <div class="summary-info"><div class="summary-key">Email</div><div class="summary-val">${state.email}</div></div>
        </div>` : ''}
        <div class="summary-row">
          <div class="summary-icon">${icons.cal}</div>
          <div class="summary-info"><div class="summary-key">Fecha de nacimiento</div><div class="summary-val">${fmtBirthdate(state.fechaNac)}</div></div>
        </div>
      </div>
      <button class="btn-primary" id="btn-continuar" style="margin-top:16px">Continuar →</button>
      <button class="btn-secondary" id="btn-no-soy" style="margin-top:8px">No soy yo / Cambiar número</button>`;

    document.getElementById('btn-continuar')!.addEventListener('click', () => { state.step = 2; renderStep2(); });
    document.getElementById('btn-no-soy')!.addEventListener('click', () => {
      state.telefono = ''; state.lookupDone = false; state.patientFound = false;
      state.nombre = ''; state.email = ''; state.fechaNac = '';
      renderStep1();
    });

  } else {
    el.innerHTML = `
      <div class="alert alert-info" style="margin-bottom:16px">${icons.warn} No encontramos tu número. Completá tus datos para registrarte.</div>
      <div class="form-group">
        <label class="form-label" for="inp-nombre">Nombre completo *</label>
        <input class="form-input" id="inp-nombre" type="text"
          placeholder="Ej: María García" value="${state.nombre}" autocomplete="name" />
        <span class="form-error" id="err-nombre">Ingresá tu nombre completo.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-email">Email <span class="label-optional">(opcional)</span></label>
        <input class="form-input" id="inp-email" type="email"
          placeholder="Ej: maria@email.com" value="${state.email}" autocomplete="email" />
        <span class="form-error" id="err-email">Ingresá un email válido.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="inp-fechanac">Fecha de nacimiento *</label>
        <input class="form-input" id="inp-fechanac" type="date" value="${state.fechaNac}" />
        <span class="form-error" id="err-fechanac">Ingresá tu fecha de nacimiento.</span>
      </div>
      <button class="btn-primary" id="btn-registrar">Registrarme y continuar →</button>`;

    document.getElementById('btn-registrar')!.addEventListener('click', validateAndRegister);
  }
}

async function validateAndRegister() {
  const nombre   = (document.getElementById('inp-nombre')   as HTMLInputElement).value.trim();
  const email    = (document.getElementById('inp-email')    as HTMLInputElement).value.trim();
  const fechaNac = (document.getElementById('inp-fechanac') as HTMLInputElement).value.trim();

  let valid = true;
  const setErr = (id: string, inputId: string, show: boolean) => {
    document.getElementById(id)!.classList.toggle('visible', show);
    (document.getElementById(inputId) as HTMLElement).classList.toggle('error', show);
    if (show) valid = false;
  };
  setErr('err-nombre',   'inp-nombre',   nombre.length < 3);
  if (email) setErr('err-email', 'inp-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  setErr('err-fechanac', 'inp-fechanac', !fechaNac);
  if (!valid) return;

  state.nombre = nombre; state.email = email; state.fechaNac = fechaNac;

  const btn = document.getElementById('btn-registrar') as HTMLButtonElement;
  btn.classList.add('loading'); btn.disabled = true;

  try {
    await registerPatient({ telefono: state.telefono, nombre, email, fecha_nac: fechaNac });
    state.step = 2;
    renderStep2();
  } catch (err: any) {
    console.error('[register]', err);
    btn.classList.remove('loading');
    btn.disabled = false;
    const alertEl = document.getElementById('step1-alert');
    if (alertEl) {
      alertEl.innerHTML = `<div class="alert alert-error">${icons.warn} No se pudo registrar: ${err.message || 'Intenta de nuevo.'}</div>`;
    }
  }
}

/** Formatea la fecha a DD/MM/YYYY eliminando zonas horarias o formatos largos */
function fmtBirthdate(dateStr: string): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();

  // Si es una fecha con zona horaria o fecha larga de JS (ej: "Thu Mar 30 2006..." o contiene GMT)
  if (str.includes('GMT') || /^[a-zA-Z]{3}\s[a-zA-Z]{3}/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  }

  // Formato estándar YYYY-MM-DD
  if (str.includes('-')) {
    const [y, m, d] = str.split('-');
    return d && m && y ? `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}` : str;
  }

  // Formato ya formateado u otro (ej: DD/MM/YYYY)
  return str;
}

// ── STEP 3 — Calendar + Slots ─────────────────────────────────────────────────

function renderStep3() {
  app.innerHTML = `
    <div class="wizard-card">
      ${headerHTML(true)}
      <div class="wizard-body">
        <h1 class="step-title">Elegí fecha y hora</h1>
        <p class="step-desc">Seleccioná el día y horario disponible.</p>
        <div id="step3-alert"></div>
        <div class="calendar-wrapper" id="calendar"></div>
        <div class="slots-section" id="slots-section"></div>
        <button class="btn-primary" id="btn-next3" disabled>Siguiente →</button>
      </div>
      ${footerHTML()}
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => { state.step = 2; renderStep2(); });
  document.getElementById('btn-next3')!.addEventListener('click', () => { state.step = 4; renderStep4(); });

  // Reset disponibilidad del mes y cargar
  state.availableDates = new Set();
  state.availableDatesLoaded = false;
  renderCalendar();
  loadAvailableDates();
}

function renderCalendar() {
  const cal = document.getElementById('calendar')!;
  const m = state.calendarMonth;
  const year = m.getFullYear();
  const month = m.getMonth();
  const monthName = m.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const startOffset = (firstDay === 0) ? 6 : firstDay - 1; // Mon-based
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');

  const isPrevDisabled = new Date(year, month, 1) <= new Date(today.getFullYear(), today.getMonth(), 1);

  let dayCells = '';
  for (let i = 0; i < startOffset; i++) dayCells += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isPast = date < today;
    // Solo marcar como no-disponible cuando ya terminó el fetch del mes
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const isUnavailable = !isPast && state.availableDatesLoaded && !state.availableDates.has(dateStr);
    const isSel = state.selectedDate && isSameDay(date, state.selectedDate);
    const isTod = isToday(date);
    let cls = 'cal-day';
    if (isPast) cls += ' past';
    if (isUnavailable) cls += ' unavailable';
    if (isSel && !isUnavailable) cls += ' selected';
    if (isTod && !isSel && !isUnavailable) cls += ' today';
    dayCells += `<button class="${cls}" data-date="${date.toISOString()}" ${isPast || isUnavailable ? 'disabled' : ''}>${d}</button>`;
  }

  // Indicador de carga de disponibilidad del mes
  const availLoadingBadge = state.availableDatesLoading
    ? `<span class="cal-loading-badge"><span class="mini-spinner" style="width:10px;height:10px;border-width:1.5px;"></span> Verificando…</span>`
    : '';

  cal.innerHTML = `
    <div class="calendar-nav">
      <button class="cal-btn" id="cal-prev" ${isPrevDisabled ? 'disabled' : ''}>${icons.chevL}</button>
      <span class="cal-month">${monthName} ${availLoadingBadge}</span>
      <button class="cal-btn" id="cal-next">${icons.chevR}</button>
    </div>
    <div class="cal-grid">
      ${['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(day => `<div class="cal-weekday">${day}</div>`).join('')}
      ${dayCells}
    </div>`;

  document.getElementById('cal-prev')!.addEventListener('click', () => {
    state.calendarMonth = new Date(year, month - 1, 1);
    state.availableDates = new Set();
    state.availableDatesLoaded = false;
    renderCalendar();
    loadAvailableDates();
  });
  document.getElementById('cal-next')!.addEventListener('click', () => {
    state.calendarMonth = new Date(year, month + 1, 1);
    state.availableDates = new Set();
    state.availableDatesLoaded = false;
    renderCalendar();
    loadAvailableDates();
  });

  cal.querySelectorAll('.cal-day:not([disabled]):not(.empty)').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedDate = new Date((btn as HTMLElement).dataset.date!);
      state.selectedSlot = null;
      renderCalendar();
      loadSlots();
    });
  });

  renderSlots(); // refresh slot area when re-rendering calendar
}

/**
 * Format a Date to Hapio-required RFC3339 format with the location's timezone offset.
 * Example: 2026-06-05T00:00:00-04:00 (America/Caracas)
 * Hapio rejects UTC +00:00 from JS's toISOString() — it must match the resource location timezone.
 */
function toHapioISO(date: Date, tz: string = state.locationTimezone): string {
  // Get the UTC offset for the given timezone at the given date
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(p => [p.type, p.value])
  );
  // Compute offset minutes between UTC and the target timezone
  const localStr = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  const localDate = new Date(localStr + 'Z'); // treat as UTC to get diff
  const offsetMs = localDate.getTime() - date.getTime();
  const offsetMin = Math.round(offsetMs / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${localStr}${sign}${hh}:${mm}`;
}

/**
 * Carga todos los slots del mes actual en un solo request.
 * Extrae qué fechas (YYYY-MM-DD) tienen al menos 1 slot disponible
 * y las guarda en state.availableDates para pintar el calendario.
 */
async function loadAvailableDates() {
  if (!state.serviceId || !state.resourceId || !state.locationId) return;

  state.availableDatesLoading = true;
  state.availableDatesLoaded = false;
  state.availableDates = new Set();
  renderCalendar();

  const m = state.calendarMonth;
  const year = m.getFullYear();
  const month = m.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();

  const dayStart = new Date(`${year}-${pad(month + 1)}-01T00:00:00Z`);
  const dayEnd   = new Date(`${year}-${pad(month + 1)}-${pad(lastDay)}T23:59:59Z`);

  try {
    const slots = await getBookableSlots(state.serviceId, {
      from: toHapioISO(dayStart),
      to:   toHapioISO(dayEnd),
      resource_id: state.resourceId,
      location: state.locationId,
    });
    // Extraer fecha local desde el string ISO del slot (e.g. "2026-06-05T09:00:00-04:00" → "2026-06-05")
    const dates = new Set(slots.map(s => s.starts_at.substring(0, 10)));
    state.availableDates = dates;
    console.log(`[loadAvailableDates] ${dates.size} días con disponibilidad en ${year}-${pad(month + 1)}`);
  } catch (err) {
    console.error('[loadAvailableDates] Error al cargar disponibilidad del mes:', err);
    // En caso de error dejamos el set vacío pero marcamos como cargado
    // para no bloquear la UI
  } finally {
    state.availableDatesLoading = false;
    state.availableDatesLoaded = true;
    renderCalendar();
  }
}

async function loadSlots() {
  if (!state.selectedDate || !state.serviceId) {
    console.warn('[loadSlots] Missing date or serviceId', { date: state.selectedDate, serviceId: state.serviceId });
    return;
  }
  state.slotsLoading = true;
  state.slots = [];
  renderSlots();

  // Build the day range in the LOCATION'S timezone, not the browser's local timezone.
  // state.selectedDate is a Date object constructed from a YYYY-MM-DD string — extract the
  // date parts without any local-timezone shifting by using UTC methods (calendar buttons store
  // dates via new Date(year, month, d) which is local midnight).
  const d = state.selectedDate;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  // Create start/end as Date objects interpreted in UTC, then toHapioISO will reinterpret
  // them in the location timezone to get the correct offset string.
  const dayStart = new Date(`${dateStr}T00:00:00Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59Z`);

  const params = {
    from: toHapioISO(dayStart),
    to: toHapioISO(dayEnd),
    resource_id: state.resourceId,
    location: state.locationId,
  };
  console.log('[loadSlots] Fetching slots with params:', params, 'serviceId:', state.serviceId);

  try {
    const slots = await getBookableSlots(state.serviceId, params);
    console.log('[loadSlots] Received slots:', slots);
    state.slots = slots;
  } catch (err) {
    console.error('[loadSlots] Error:', err);
    state.slots = [];
  } finally {
    state.slotsLoading = false;
    renderSlots();
  }
}

function renderSlots() {
  const el = document.getElementById('slots-section');
  if (!el) return;

  if (!state.selectedDate) {
    el.innerHTML = '';
    return;
  }

  if (state.slotsLoading) {
    el.innerHTML = `<div class="slots-label">Horarios disponibles</div>
      <div class="slots-loading"><div class="mini-spinner"></div> Cargando horarios…</div>`;
    return;
  }

  if (!state.slots.length) {
    el.innerHTML = `<div class="slots-label">Horarios disponibles</div>
      <div class="slots-empty">No hay horarios disponibles para este día.</div>`;
    updateNextBtn();
    return;
  }

  const btns = state.slots.map(s => {
    const isSel = state.selectedSlot?.starts_at === s.starts_at;
    return `<button class="slot-btn${isSel ? ' selected' : ''}" data-start="${s.starts_at}" data-end="${s.ends_at}">${fmtTime(s.starts_at)}</button>`;
  }).join('');

  el.innerHTML = `<div class="slots-label">Horarios disponibles</div><div class="slots-grid">${btns}</div>`;

  el.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedSlot = {
        starts_at: (btn as HTMLElement).dataset.start!,
        ends_at: (btn as HTMLElement).dataset.end!,
      };
      renderSlots();
      updateNextBtn();
    });
  });

  updateNextBtn();
}

function updateNextBtn() {
  const btn = document.getElementById('btn-next3') as HTMLButtonElement | null;
  if (btn) btn.disabled = !state.selectedSlot;
}

// ── STEP 4 — Confirm & Submit ─────────────────────────────────────────────────
function renderStep4() {
  const dateStr = state.selectedDate ? fmt(state.selectedDate) : '';
  const timeStr = state.selectedSlot ? fmtTime(state.selectedSlot.starts_at) : '';

  app.innerHTML = `
    <div class="wizard-card">
      ${headerHTML(true)}
      <div class="wizard-body">
        <div class="confirm-icon">${icons.check}</div>
        <h1 class="confirm-title">Confirmá tu cita</h1>
        <p class="confirm-subtitle">Revisá los datos antes de agendar.</p>
        <div id="step4-alert"></div>
        <div class="summary-card">
          <div class="summary-row">
            <div class="summary-icon">${icons.person}</div>
            <div class="summary-info"><div class="summary-key">Paciente</div><div class="summary-val">${state.nombre}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.phone}</div>
            <div class="summary-info"><div class="summary-key">WhatsApp</div><div class="summary-val">${state.telefono}</div></div>
          </div>
          ${state.email ? `<div class="summary-row">
            <div class="summary-icon">${icons.mail}</div>
            <div class="summary-info"><div class="summary-key">Email</div><div class="summary-val">${state.email}</div></div>
          </div>` : ''}
          <div class="summary-row">
            <div class="summary-icon">${icons.pin}</div>
            <div class="summary-info"><div class="summary-key">Localización</div><div class="summary-val">${state.locationName}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.cal}</div>
            <div class="summary-info"><div class="summary-key">Fecha</div><div class="summary-val" style="text-transform:capitalize">${dateStr}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.clock}</div>
            <div class="summary-info"><div class="summary-key">Hora</div><div class="summary-val">${timeStr}</div></div>
          </div>
        </div>
        <button class="btn-primary" id="btn-confirm">Confirmar cita</button>
        <button class="btn-secondary" id="btn-back4">← Modificar fecha</button>
      </div>
      ${footerHTML()}
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => { state.step = 3; renderStep3(); });
  document.getElementById('btn-back4')!.addEventListener('click', () => { state.step = 3; renderStep3(); });
  document.getElementById('btn-confirm')!.addEventListener('click', submitBooking);
}

async function submitBooking() {
  const btn = document.getElementById('btn-confirm') as HTMLButtonElement;
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await createBooking({
      resource_id: state.resourceId,
      service_id: state.serviceId,
      location_id: state.locationId,
      starts_at: state.selectedSlot!.starts_at,
      ends_at: state.selectedSlot!.ends_at,
      metadata: {
        customer: {
          name: state.nombre,
          phone: state.telefono,
          email: state.email,
          birthdate: state.fechaNac,
        },
      },
    });
    renderSuccess();
  } catch (err: any) {
    btn.classList.remove('loading');
    btn.disabled = false;
    const alertEl = document.getElementById('step4-alert')!;
    alertEl.innerHTML = `<div class="alert alert-error">${icons.warn} ${err.message || 'No se pudo confirmar la cita. Intenta de nuevo.'}</div>`;
  }
}

// ── SUCCESS ───────────────────────────────────────────────────────────────────
function renderSuccess() {
  const dateStr = state.selectedDate ? fmt(state.selectedDate) : '';
  const timeStr = state.selectedSlot ? fmtTime(state.selectedSlot.starts_at) : '';

  app.innerHTML = `
    <div class="wizard-card">
      <div class="wizard-header">
        <div class="header-clinic">
          <div class="header-icon">${icons.cross}</div>
          <div>
            <div class="header-name">${state.resourceName}</div>
            <div class="header-subtitle">Agenda tu cita médica</div>
          </div>
        </div>
        <div class="steps">${stepsHTML(3)}</div>
      </div>
      <div class="wizard-body">
        <div class="confirm-icon">${icons.check}</div>
        <h1 class="confirm-title">¡Cita agendada!</h1>
        <p class="confirm-subtitle">Te esperamos. Recibirás un recordatorio.</p>
        <div class="summary-card">
          <div class="summary-row">
            <div class="summary-icon">${icons.person}</div>
            <div class="summary-info"><div class="summary-key">Paciente</div><div class="summary-val">${state.nombre}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.phone}</div>
            <div class="summary-info"><div class="summary-key">WhatsApp</div><div class="summary-val">${state.telefono}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.svc}</div>
            <div class="summary-info"><div class="summary-key">Servicio</div><div class="summary-val">${state.serviceName}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.pin}</div>
            <div class="summary-info"><div class="summary-key">Localización</div><div class="summary-val">${state.locationName}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.cal}</div>
            <div class="summary-info"><div class="summary-key">Fecha</div><div class="summary-val" style="text-transform:capitalize">${dateStr}</div></div>
          </div>
          <div class="summary-row">
            <div class="summary-icon">${icons.clock}</div>
            <div class="summary-info"><div class="summary-key">Hora</div><div class="summary-val">${timeStr}</div></div>
          </div>
        </div>
        <button class="btn-secondary" id="btn-new">Salir</button>
      </div>
      ${footerHTML()}
    </div>`;

  document.getElementById('btn-new')!.addEventListener('click', () => window.close());
}

// ── ERROR SCREEN ──────────────────────────────────────────────────────────────
function renderError(msg: string) {
  app.innerHTML = `
    <div class="wizard-card">
      <div class="wizard-body error-screen">
        <div class="error-icon">${icons.warn}</div>
        <div class="error-title">No se pudo cargar</div>
        <p class="error-msg">${msg}</p>
        <button class="btn-primary" style="margin-top:20px" onclick="location.reload()">Reintentar</button>
      </div>
    </div>`;
}

// ── INIT ──────────────────────────────────────────────────────────────────────

/**
 * Determina si un RecurringSchedule está activo en la fecha dada.
 */
function isScheduleActiveOn(schedule: RecurringSchedule, date: Date): boolean {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (dateStr < schedule.start_date) return false;
  if (schedule.end_date && dateStr > schedule.end_date) return false;
  return true;
}

/**
 * Busca el RecurringSchedule activo HOY para una lista de schedules.
 * Prioriza el que tenga metadata.services. Fallback al primero futuro.
 */
function findActiveSchedule(schedules: RecurringSchedule[]): RecurringSchedule | null {
  if (!schedules.length) return null;
  const today = new Date();
  const activeToday = schedules.filter(s => isScheduleActiveOn(s, today));
  if (activeToday.length > 0) {
    return activeToday.find(s => s.metadata?.services?.length) ?? activeToday[0];
  }
  const future = schedules
    .filter(s => !s.end_date || s.end_date >= today.toISOString().substring(0, 10))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return future[0] ?? schedules[0];
}

async function init() {
  app.innerHTML = `<div class="loading-screen"><div class="spinner"></div><span class="loading-text">Cargando…</span></div>`;

  const params = new URLSearchParams(window.location.search);
  const resourceId = params.get('recurso') || params.get('resource_id') || params.get('r');
  const telefonoParam = params.get('telefono') || params.get('phone') || params.get('t');
  if (telefonoParam) state.telefono = telefonoParam;

  if (!resourceId) {
    renderError('No se especificó un médico o recurso.<br>Accedé al formulario desde el link de tu chatbot.');
    return;
  }

  state.resourceId = resourceId;

  try {
    const [resource, allLocations, schedules] = await Promise.all([
      getResource(resourceId),
      getLocations(),
      getRecurringSchedules(resourceId),
    ]);

    state.resourceName = resource.name;
    state.allSchedules = schedules;

    // Filtrar solo las sedes donde el médico tiene turnos configurados
    const scheduleLocIds = new Set(schedules.map((s: RecurringSchedule) => s.location_id || (s as any).location?.id).filter(Boolean));
    state.locations = allLocations.filter((loc: { id: string }) => scheduleLocIds.has(loc.id));

    // Fallback: si no hay schedules, mostrar todas las sedes
    if (state.locations.length === 0) state.locations = allLocations;

    if (state.locations.length === 0) {
      renderError('Este médico no tiene sedes configuradas. Contactá a la clínica.');
      return;
    }

    // Si solo hay una sede, pre-seleccionarla automáticamente
    if (state.locations.length === 1) {
      const only = state.locations[0];
      state.locationId       = only.id;
      state.locationName     = only.name;
      state.locationTimezone = only.time_zone || 'UTC';
    }

    console.log('[init] Sedes disponibles:', state.locations.map((l: { name: string }) => l.name));
    renderStep1();
  } catch (err: any) {
    renderError(err.message || 'Error inesperado. Por favor, intentá de nuevo más tarde.');
  }
}

init();
