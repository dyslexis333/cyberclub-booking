export const STORAGE_KEY = "dyscyber-bookings-v1";

export function loadBookings(validate) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { bookings: [], error: "" };

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validate)) {
      return {
        bookings: [],
        error: "Сохранённые брони имеют неверный формат. Повреждённые записи не загружены."
      };
    }
    return { bookings: parsed, error: "" };
  } catch (error) {
    return {
      bookings: [],
      error: error instanceof SyntaxError
        ? "Не удалось прочитать сохранённые брони: данные повреждены."
        : "Браузер не разрешил прочитать сохранённые брони. Страница продолжит работу без них."
    };
  }
}

export function saveBookings(bookings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: "Не удалось сохранить бронь. Проверьте настройки хранения браузера." };
  }
}

export function clearBookings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: "Не удалось удалить брони из хранилища браузера." };
  }
}
