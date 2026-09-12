// Keep the backend's structured detail; callers decide how to present limits.
export function apiError(status, data, fallback = "Не удалось выполнить запрос. Попробуйте ещё раз.") {
  const detail = data?.detail;
  const error = new Error(status === 401 ? "Сессия истекла. Войдите снова." :
    typeof detail === "string" ? detail : detail?.message || fallback);
  error.status = status;
  error.detail = detail;
  error.code = typeof detail?.code === "string" ? detail.code.toLowerCase() : "";
  return error;
}
