/**
 * Centralized HTTP error → user-friendly message mapping.
 * Used by all RTK Query error handlers (Phase 2+).
 */

export interface FetchError {
  status: number | 'FETCH_ERROR' | 'PARSING_ERROR' | 'TIMEOUT_ERROR' | 'CUSTOM_ERROR';
  data?: unknown;
}

export interface SerializedError {
  message?: string;
}

const HTTP_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Некорректный запрос',
  401: 'Необходима авторизация',
  403: 'Нет доступа к ресурсу',
  404: 'Объект не найден',
  409: 'Конфликт: объект уже существует или изменён',
  422: 'Некорректные данные запроса',
  429: 'Слишком много запросов, попробуйте позже',
  500: 'Ошибка сервера',
  502: 'Сервер недоступен',
  503: 'Сервис временно недоступен',
};

export function getErrorMessage(error: FetchError | SerializedError): string {
  if ('status' in error) {
    if (error.status === 'FETCH_ERROR') return 'Нет соединения с сервером';
    if (error.status === 'TIMEOUT_ERROR') return 'Сервер не ответил вовремя';
    if (error.status === 'PARSING_ERROR') return 'Неожиданный формат ответа от сервера';
    if (typeof error.status === 'number') {
      return HTTP_MESSAGES[error.status] ?? `Ошибка ${error.status}`;
    }
  }
  if ('message' in error && error.message) {
    return error.message;
  }
  return 'Что-то пошло не так';
}
