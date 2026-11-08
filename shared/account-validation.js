export const normalizeLoginValue = value => typeof value === 'string' ? value.trim().normalize('NFKC').toLowerCase() : '';

export function loginError(value) {
  const login = normalizeLoginValue(value);
  if (!login) return 'Введи логин.';
  if (login.length < 3) return 'В логине должно быть минимум 3 символа.';
  if (login.length > 40) return 'Логин не должен быть длиннее 40 символов.';
  if (!/^[\p{L}\p{N}_.-]+$/u.test(login)) return 'Используй буквы, цифры или символы _ . -';
  return null;
}

export function validateAccount(values, action) {
  const errors = {};
  const issue = loginError(values?.login);
  if (issue) errors.login = issue;
  const password = values?.password;
  if (typeof password !== 'string' || !password.length) errors.password = 'Введи пароль.';
  else if (action === 'register' && password.length < 12) errors.password = 'Пароль должен содержать минимум 12 символов.';
  else if (password.length > 1024) errors.password = 'Пароль не должен быть длиннее 1024 символов.';
  if (action === 'register') {
    if (!values?.confirmPassword) errors.confirmPassword = 'Повтори пароль.';
    else if (values.confirmPassword !== password) errors.confirmPassword = 'Пароли не совпадают. Проверь оба поля.';
  }
  return errors;
}
