import { CLUB, INITIAL_OCCUPIED_RESOURCE_IDS, RESOURCES, TARIFFS, ZONES } from "./data.js";
import { clearBookings, loadBookings, saveBookings } from "./storage.js";

const resourceById = new Map(RESOURCES.map(resource => [resource.id, resource]));
const initialOccupied = new Set(INITIAL_OCCUPIED_RESOURCE_IDS);

const zoneOptions = document.querySelector("#zone-options");
const priceOptions = document.querySelector("#price-options");
const dateOptions = document.querySelector("#date-options");
const clubMap = document.querySelector("#club-map");
const emptyMap = document.querySelector("#empty-map");
const visibleCount = document.querySelector("#visible-count");
const selectionEmpty = document.querySelector("#selection-empty");
const selectionContent = document.querySelector("#selection-content");
const selectedZone = document.querySelector("#selected-zone");
const selectedName = document.querySelector("#selected-name");
const selectedStatus = document.querySelector("#selected-status");
const selectedSpecs = document.querySelector("#selected-specs");
const selectedDate = document.querySelector("#selected-date");
const tariffButtons = document.querySelectorAll("[data-tariff]");
const hoursField = document.querySelector("#hours-field");
const hoursInput = document.querySelector("#hours-input");
const bookingTotal = document.querySelector("#booking-total");
const bookingForm = document.querySelector("#booking-form");
const confirmBooking = document.querySelector("#confirm-booking");
const formError = document.querySelector("#form-error");
const appStatus = document.querySelector("#app-status");
const bookingsList = document.querySelector("#bookings-list");
const bookingsEmpty = document.querySelector("#bookings-empty");
const resetBookings = document.querySelector("#reset-bookings");
const storageWarning = document.querySelector("#storage-warning");

const state = {
  zoneFilter: "all",
  priceFilter: "all",
  selectedDateKey: "",
  calendarDayKey: dateKeyFromDate(startOfDay()),
  selectedResourceId: "",
  tariff: "hourly",
  hours: 1,
  bookings: [],
  storageError: "",
  submitting: false
};

function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) || dateKeyFromDate(date) !== dateKey ? null : date;
}

function getUpcomingDateKeys(count = 5) {
  const first = startOfDay();
  first.setDate(first.getDate() + 1);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return dateKeyFromDate(date);
  });
}

function formatDate(dateKey, options = { day: "numeric", month: "long" }) {
  const date = dateFromKey(dateKey);
  if (!date) return "дата не выбрана";
  return new Intl.DateTimeFormat("ru-RU", options).format(date);
}

function formatDateButton(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) return { weekday: "", day: "", month: "", full: "дата не выбрана" };
  return {
    weekday: new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(date).replace(".", ""),
    day: new Intl.DateTimeFormat("ru-RU", { day: "numeric" }).format(date),
    month: new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(date).replace(".", ""),
    full: formatDate(dateKey, { day: "numeric", month: "long", year: "numeric" })
  };
}

function getResource(id) {
  return resourceById.get(id);
}

function getBlockedIdsForResource(resource) {
  if (!resource) return [];
  if (resource.bookingMode === "group") return [resource.id, ...resource.memberIds];
  return [resource.id];
}

function getOccupiedIds() {
  const occupied = new Set(initialOccupied);
  for (const booking of state.bookings) {
    // Старые брони без даты считаем занятыми на всех датах, чтобы не потерять
    // уже сохранённое состояние после обновления интерфейса.
    if (booking.dateKey && booking.dateKey !== state.selectedDateKey) continue;
    getBlockedIdsForResource(getResource(booking.resourceId)).forEach(id => occupied.add(id));
  }
  return occupied;
}

function isOccupied(resource) {
  const occupied = getOccupiedIds();
  return getBlockedIdsForResource(resource).some(id => occupied.has(id));
}

function isInitialOccupied(resource) {
  return getBlockedIdsForResource(resource).some(id => initialOccupied.has(id));
}

function resourceIsVisible(resource) {
  if (!resource) return false;
  const zoneMatches = state.zoneFilter === "all"
    || (state.zoneFilter === "vip" && resource.category === "vip")
    || (state.zoneFilter === "pro" && resource.category === "pro")
    || (state.zoneFilter === resource.category);
  if (!zoneMatches) return false;

  const hourly = resource.hourlyPrice;
  if (state.priceFilter === "up-to-300") return hourly <= 300;
  if (state.priceFilter === "301-1000") return hourly >= 301 && hourly <= 1000;
  if (state.priceFilter === "over-1000") return hourly >= 1001;
  return true;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("ru-RU").format(amount) + " ₽";
}

function formatHours(hours) {
  const remainder100 = hours % 100;
  const remainder10 = hours % 10;
  if (remainder100 >= 11 && remainder100 <= 14) return `${hours} часов`;
  if (remainder10 === 1) return `${hours} час`;
  if (remainder10 >= 2 && remainder10 <= 4) return `${hours} часа`;
  return `${hours} часов`;
}

function setStatus(message) {
  appStatus.textContent = message;
  formError.hidden = true;
  formError.textContent = "";
}

function setError(message) {
  formError.hidden = !message;
  formError.textContent = message;
  appStatus.textContent = "";
}

function getSelectedResource() {
  return getResource(state.selectedResourceId);
}

function getCurrentHours() {
  return state.tariff === "night" ? 10 : state.hours;
}

function getCurrentTotal(resource = getSelectedResource()) {
  if (!resource) return 0;
  return state.tariff === "night"
    ? resource.nightPrice
    : resource.hourlyPrice * getCurrentHours();
}

function bookingLabel(booking) {
  return booking.tariffId === "night"
    ? "Ночной пакет · 22:00–08:00"
    : `Почасовой · ${formatHours(booking.hours)}`;
}

function resourceStatus(resource) {
  if (state.selectedResourceId === resource.id && !isOccupied(resource)) return "Выбрано";
  if (isOccupied(resource)) return isInitialOccupied(resource) ? "Занято изначально" : "Занято";
  return "Свободно";
}

function statusClass(status) {
  if (status === "Выбрано") return "selected";
  if (status.startsWith("Занято")) return "occupied";
  return "free";
}

function resourceAriaLabel(resource) {
  return `${resource.name}, ${resourceStatus(resource)}, ${formatMoney(resource.hourlyPrice)} за час`;
}

function resourceButton(resource, source) {
  const status = resourceStatus(resource);
  const occupied = isOccupied(resource);
  const selected = state.selectedResourceId === resource.id;
  const groupLabel = resource.bookingMode === "group" ? " · вся группа" : "";
  return [
    `<button class="resource-card ${resource.bookingMode === "group" ? "group-card" : "computer-card"} ${statusClass(status)}" type="button" data-resource-id="${resource.id}" data-source="${source}" aria-label="${resourceAriaLabel(resource)}${groupLabel}" aria-pressed="${String(selected)}"${occupied ? " disabled" : ""}>`,
    `<span class="resource-card-top"><span class="resource-code">${resource.id}</span><span class="resource-status">${status}</span></span>`,
    `<strong>${resource.name}</strong>`,
    `<span class="resource-card-detail">${resource.bookingMode === "group" ? "5 компьютеров · бронь целиком" : resource.zoneLabel}</span>`,
    `<span class="resource-card-price">${formatMoney(resource.hourlyPrice)}<small>/час</small></span>`,
    `<span class="resource-card-state">${resource.specs}</span>`,
    `</button>`
  ].join("");
}

function planResourceButton(resource) {
  const status = resourceStatus(resource);
  const occupied = isOccupied(resource);
  const selected = state.selectedResourceId === resource.id;
  const group = resource.bookingMode === "group";
  return [
    `<button class="plan-resource ${group ? "plan-room-resource" : "plan-seat"} ${statusClass(status)}" type="button" data-resource-id="${resource.id}" data-source="map" aria-label="${resourceAriaLabel(resource)}${group ? " · забронировать всю комнату или зону" : " · место на карте"}" aria-pressed="${String(selected)}"${occupied ? " disabled" : ""}>`,
    `<span class="plan-resource-id">${group ? "ROOM" : resource.id}</span>`,
    `<span class="plan-resource-status">${status}</span>`,
    group ? `<span class="plan-room-resource-price">${formatMoney(resource.hourlyPrice)} / час</span>` : "",
    `</button>`
  ].join("");
}

function visibleResourcesForZone(zone) {
  return RESOURCES.filter(resource => resource.zoneId === zone.id && resourceIsVisible(resource));
}

function renderMap() {
  const visibleResources = RESOURCES.filter(resourceIsVisible);
  visibleCount.textContent = `${visibleResources.length} ${visibleResources.length === 1 ? "объект" : "объектов"}`;
  emptyMap.hidden = visibleResources.length > 0;

  clubMap.innerHTML = ZONES.map(zone => {
    const zoneResources = visibleResourcesForZone(zone);
    if (zoneResources.length === 0) return "";
    const groupResource = zone.groupResourceId ? getResource(zone.groupResourceId) : null;
    const computers = zoneResources.filter(resource => resource.bookingMode === "single" && resource.resourceType === "computer");
    const consoleResources = zoneResources.filter(resource => resource.resourceType === "console-room");
    const groupMarkup = groupResource && resourceIsVisible(groupResource)
      ? `<div class="plan-room-booking"><span>Вся зона</span>${planResourceButton(groupResource)}</div>`
      : "";
    const computersMarkup = computers.length
      ? `<div class="plan-seat-grid">${computers.map(planResourceButton).join("")}</div>`
      : consoleResources.map(planResourceButton).join("");
    const freeCount = computers.filter(resource => !isOccupied(resource)).length;
    const capacityText = computers.length
      ? `${freeCount} свободно из ${computers.length}`
      : "1 объект";
    return [
      `<section class="plan-room plan-room-${zone.id}" aria-labelledby="zone-title-${zone.id}">`,
      `<div class="plan-room-heading"><div class="plan-room-title"><span class="plan-room-number">${String(ZONES.indexOf(zone) + 1).padStart(2, "0")}</span><div><h4 id="zone-title-${zone.id}">${zone.label}</h4><p>${zone.description}</p></div></div><span class="plan-room-capacity">${capacityText}</span></div>`,
      groupMarkup,
      computersMarkup,
      `</section>`
    ].join("");
  }).join("");

  clubMap.querySelectorAll("[data-resource-id]").forEach(button => {
    button.addEventListener("click", () => toggleResource(button.dataset.resourceId, button.dataset.source));
  });
}

function renderDateOptions() {
  const dateKeys = getUpcomingDateKeys();
  if (!dateKeys.includes(state.selectedDateKey)) state.selectedDateKey = dateKeys[0];

  dateOptions.innerHTML = dateKeys.map(dateKey => {
    const date = formatDateButton(dateKey);
    const active = dateKey === state.selectedDateKey;
    return [
      `<button class="date-button${active ? " is-active" : ""}" type="button" data-date-key="${dateKey}" aria-pressed="${String(active)}" aria-label="${date.full}">`,
      `<span class="date-button-day">${date.day}</span>`,
      `<span class="date-button-meta"><span>${date.weekday}</span><span>${date.month}</span></span>`,
      `</button>`
    ].join("");
  }).join("");
}

function renderFilters() {
  zoneOptions.querySelectorAll("[data-zone]").forEach(button => {
    const active = button.dataset.zone === state.zoneFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  priceOptions.querySelectorAll("[data-price]").forEach(button => {
    const active = button.dataset.price === state.priceFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function renderSelection() {
  const resource = getSelectedResource();
  const validSelection = resource && resourceIsVisible(resource) && !isOccupied(resource);
  if (!validSelection) {
    if (state.selectedResourceId) state.selectedResourceId = "";
    selectionEmpty.hidden = false;
    selectionContent.hidden = true;
    confirmBooking.disabled = true;
    bookingTotal.textContent = "0 ₽";
    return;
  }

  selectionEmpty.hidden = true;
  selectionContent.hidden = false;
  selectedZone.textContent = resource.zoneLabel;
  selectedName.textContent = resource.name;
  selectedStatus.textContent = "Свободно · можно бронировать";
  selectedStatus.className = "status-pill free";
  selectedSpecs.textContent = resource.specs;
  selectedDate.textContent = `Дата посещения: ${formatDate(state.selectedDateKey)}`;
  tariffButtons.forEach(button => {
    const active = button.dataset.tariff === state.tariff;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  hoursField.hidden = state.tariff === "night";
  bookingTotal.textContent = formatMoney(getCurrentTotal(resource));
  confirmBooking.disabled = state.submitting;
}

function renderBookings() {
  const ordered = [...state.bookings].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  bookingsEmpty.hidden = ordered.length > 0;
  resetBookings.hidden = ordered.length === 0;
  bookingsList.innerHTML = ordered.map(booking => {
    const resource = getResource(booking.resourceId);
    const isGroup = resource.bookingMode === "group";
    return [
      `<li class="booking-card"><div class="booking-card-main">`,
      `<p class="eyebrow">Учебная бронь · ${booking.ticketNumber}</p>`,
      `<h3>${resource.name}</h3>`,
      `<p>${resource.zoneLabel} · ${isGroup ? "5 компьютеров" : resource.resourceType === "console-room" ? "консольная комната" : "1 компьютер"}</p>`,
      `<p class="booking-visit-date">Дата посещения: <strong>${booking.dateKey ? formatDate(booking.dateKey, { day: "numeric", month: "long", year: "numeric" }) : "без даты"}</strong></p>`,
      `<p>${bookingLabel(booking)} · <strong>${formatMoney(booking.total)}</strong></p>`,
      `<p class="booking-date">Оформлено ${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.createdAt))}</p>`,
      `</div><button class="cancel-button" type="button" data-cancel-id="${booking.id}" aria-label="Отменить бронь ${booking.ticketNumber}">Отменить</button></li>`
    ].join("");
  }).join("");

  bookingsList.querySelectorAll("[data-cancel-id]").forEach(button => {
    button.addEventListener("click", () => cancelBooking(button.dataset.cancelId));
  });
}

function renderStorageWarning() {
  storageWarning.hidden = !state.storageError;
  storageWarning.textContent = state.storageError;
}

function render() {
  renderDateOptions();
  renderFilters();
  renderMap();
  renderSelection();
  renderBookings();
  renderStorageWarning();
}

function toggleResource(resourceId, source) {
  const resource = getResource(resourceId);
  if (!resource || isOccupied(resource)) return;
  state.selectedResourceId = state.selectedResourceId === resourceId ? "" : resourceId;
  setStatus(state.selectedResourceId ? `${resource.name} выбрано на ${formatDate(state.selectedDateKey)}. Настрой тариф и подтверди бронь.` : "Выбор ресурса очищен.");
  render();
  if (state.selectedResourceId) {
    const selector = `[data-resource-id="${resourceId}"][data-source="${source}"]`;
    document.querySelector(selector)?.focus();
  }
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTicketNumber() {
  return `DC-${Date.now().toString().slice(-6)}-${String(Math.floor(Math.random() * 90) + 10)}`;
}

function validateBooking(booking) {
  if (!booking || typeof booking !== "object" || Array.isArray(booking)) return false;
  const resource = getResource(booking.resourceId);
  if (!resource) return false;
  if (typeof booking.id !== "string" || !/^[\w-]{10,100}$/.test(booking.id)) return false;
  if (typeof booking.ticketNumber !== "string" || !/^DC-\d{6}-\d{2}$/.test(booking.ticketNumber)) return false;
  if (!(booking.tariffId in TARIFFS)) return false;
  if (!Number.isInteger(booking.hours) || booking.hours < 1 || booking.hours > 12) return false;
  if (booking.tariffId === "night" && booking.hours !== 10) return false;
  if (booking.dateKey !== undefined && dateFromKey(booking.dateKey) === null) return false;
  const expected = booking.tariffId === "night"
    ? resource.nightPrice
    : resource.hourlyPrice * booking.hours;
  if (!Number.isFinite(booking.total) || booking.total !== expected) return false;
  if (typeof booking.createdAt !== "string" || Number.isNaN(Date.parse(booking.createdAt))) return false;
  if (isInitialOccupied(resource)) return false;
  return true;
}

function validateBookingCollection(bookings) {
  if (!bookings.every(validateBooking)) return false;
  if (new Set(bookings.map(booking => booking.id)).size !== bookings.length) return false;
  if (new Set(bookings.map(booking => booking.ticketNumber)).size !== bookings.length) return false;
  const legacyOccupied = new Set(initialOccupied);
  for (const booking of bookings) {
    if (!booking.dateKey) {
      getBlockedIdsForResource(getResource(booking.resourceId)).forEach(id => legacyOccupied.add(id));
    }
  }
  const occupiedByDate = new Map();
  for (const booking of bookings) {
    const resource = getResource(booking.resourceId);
    const dateKey = booking.dateKey || "legacy";
    if (!occupiedByDate.has(dateKey)) {
      occupiedByDate.set(dateKey, dateKey === "legacy" ? new Set(initialOccupied) : new Set(legacyOccupied));
    }
    const occupied = occupiedByDate.get(dateKey);
    const blocked = getBlockedIdsForResource(resource);
    if (blocked.some(id => occupied.has(id))) return false;
    blocked.forEach(id => occupied.add(id));
  }
  return true;
}

function submitBooking(event) {
  event.preventDefault();
  if (state.submitting) return;
  state.submitting = true;
  const resource = getSelectedResource();
  const hours = getCurrentHours();

  if (!resource) {
    state.submitting = false;
    setError("Сначала выбери свободный компьютер, зону или комнату.");
    renderSelection();
    return;
  }
  if (isOccupied(resource)) {
    state.submitting = false;
    state.selectedResourceId = "";
    setError("Этот ресурс уже занят. Выбери другой вариант.");
    render();
    return;
  }
  if (state.tariff === "hourly" && (!Number.isInteger(state.hours) || state.hours < 1 || state.hours > 12)) {
    state.submitting = false;
    setError("Количество часов должно быть целым числом от 1 до 12.");
    renderSelection();
    hoursInput.focus();
    return;
  }

  const booking = {
    id: createId(),
    ticketNumber: createTicketNumber(),
    resourceId: resource.id,
    dateKey: state.selectedDateKey,
    tariffId: state.tariff,
    hours,
    total: getCurrentTotal(resource),
    createdAt: new Date().toISOString()
  };
  const nextBookings = [...state.bookings, booking];
  if (!validateBookingCollection(nextBookings)) {
    state.submitting = false;
    setError("Не удалось проверить бронь: ресурс уже занят или данные некорректны.");
    renderSelection();
    return;
  }
  const result = saveBookings(nextBookings);
  if (!result.ok) {
    state.submitting = false;
    setError(result.error);
    renderSelection();
    return;
  }

  state.bookings = nextBookings;
  state.selectedResourceId = "";
  state.submitting = false;
  state.storageError = "";
  setStatus(`Бронь ${booking.ticketNumber} сохранена на ${formatDate(booking.dateKey)}. Ресурс занят до отмены.`);
  render();
}

function cancelBooking(bookingId) {
  const booking = state.bookings.find(item => item.id === bookingId);
  if (!booking) {
    setError("Эта бронь уже отменена или не найдена.");
    return;
  }
  if (!window.confirm(`Отменить бронь ${booking.ticketNumber}?`)) return;
  const nextBookings = state.bookings.filter(item => item.id !== bookingId);
  const result = saveBookings(nextBookings);
  if (!result.ok) {
    setError(result.error);
    return;
  }
  state.bookings = nextBookings;
  state.selectedResourceId = "";
  state.storageError = "";
  setStatus(`Бронь ${booking.ticketNumber} отменена. Ресурс снова свободен.`);
  render();
}

zoneOptions.addEventListener("click", event => {
  const button = event.target.closest("[data-zone]");
  if (!button) return;
  const previous = state.zoneFilter;
  state.zoneFilter = button.dataset.zone;
  const selected = getSelectedResource();
  if (selected && !resourceIsVisible(selected)) {
    state.selectedResourceId = "";
    setStatus("Фильтр изменён — прежний выбор скрыт и очищен.");
  } else if (previous !== state.zoneFilter) {
    setStatus("Схема и список обновлены по выбранной локации.");
  }
  render();
  button.focus();
});

priceOptions.addEventListener("click", event => {
  const button = event.target.closest("[data-price]");
  if (!button) return;
  const previous = state.priceFilter;
  state.priceFilter = button.dataset.price;
  const selected = getSelectedResource();
  if (selected && !resourceIsVisible(selected)) {
    state.selectedResourceId = "";
    setStatus("Фильтр изменён — прежний выбор скрыт и очищен.");
  } else if (previous !== state.priceFilter) {
    setStatus("Схема и список обновлены по стоимости.");
  }
  render();
  button.focus();
});

dateOptions.addEventListener("click", event => {
  const button = event.target.closest("[data-date-key]");
  if (!button) return;
  const nextDateKey = button.dataset.dateKey;
  if (!getUpcomingDateKeys().includes(nextDateKey)) {
    setError("Эта дата уже прошла. Выбери одну из ближайших доступных дат.");
    render();
    return;
  }
  state.selectedDateKey = nextDateKey;
  setStatus(`Выбрана дата ${formatDate(nextDateKey)}.`);
  render();
  button.focus();
});

tariffButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.tariff = button.dataset.tariff;
    setStatus(state.tariff === "night" ? "Выбран ночной пакет 22:00–08:00." : "Выбран почасовой тариф.");
    renderSelection();
    button.focus();
  });
});

hoursInput.addEventListener("input", () => {
  state.hours = hoursInput.value === "" ? 0 : Number(hoursInput.value);
  bookingTotal.textContent = formatMoney(getCurrentTotal());
});

bookingForm.addEventListener("submit", submitBooking);

resetBookings.addEventListener("click", () => {
  if (!state.bookings.length) return;
  if (!window.confirm("Удалить все свои брони? Начально занятые места останутся занятыми.")) return;
  const result = clearBookings();
  if (!result.ok) {
    setError(result.error);
    return;
  }
  state.bookings = [];
  state.selectedResourceId = "";
  state.storageError = "";
  setStatus("Все свои брони удалены. Начально занятые места не изменились.");
  render();
});

const loaded = loadBookings(validateBooking);
state.bookings = loaded.bookings;
state.storageError = loaded.error;
if (!validateBookingCollection(state.bookings)) {
  state.bookings = [];
  state.storageError = "Сохранённые брони пересекаются или содержат недопустимые данные. Они не загружены.";
}

document.title = `${CLUB.name} — бронирование игровых мест`;
render();

// Обновляем список ближайших дат после наступления нового дня без перезагрузки страницы.
window.setInterval(() => {
  const todayKey = dateKeyFromDate(startOfDay());
  if (todayKey === state.calendarDayKey) return;
  state.calendarDayKey = todayKey;
  render();
}, 60_000);
