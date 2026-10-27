import { localizedRecord } from "@/i18n/runtime";

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Her okunuşta seçili dile çevrilir */
export const ValidationMessages = localizedRecord({
  required: "shell.validation.required",
  emailInvalid: "shell.validation.emailInvalid",
  passwordMin: "shell.validation.passwordMin",
  passwordMismatch: "shell.validation.passwordMismatch",
  nameMin: "shell.validation.nameMin",
  companyMin: "shell.validation.companyMin",
  phoneInvalid: "shell.validation.phoneInvalid",
  urlInvalid: "shell.validation.urlInvalid",
  addressMin: "shell.validation.addressMin",
  taxRequired: "shell.validation.taxRequired",
  authorizedMin: "shell.validation.authorizedMin",
  titleRequired: "shell.validation.titleRequired",
  numberInvalid: "shell.validation.numberInvalid",
  positiveNumber: "shell.validation.positiveNumber",
  cityRequired: "shell.validation.cityRequired",
  dateRequired: "shell.validation.dateRequired",
});

export function isNonEmpty(value: string, min = 1): boolean {
  return value.trim().length >= min;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPassword(value: string, min = 6): boolean {
  return value.length >= min;
}

export function isValidPhone(value: string): boolean {
  if (!value.trim()) return true;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function required(value: string, message = ValidationMessages.required): string | undefined {
  if (!isNonEmpty(value)) return message;
  return undefined;
}

export function validateLogin(input: {
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.email)) errors.email = ValidationMessages.required;
  else if (!isValidEmail(input.email)) errors.email = ValidationMessages.emailInvalid;
  if (!isNonEmpty(input.password)) errors.password = ValidationMessages.required;
  else if (!isValidPassword(input.password))
    errors.password = ValidationMessages.passwordMin;
  return errors;
}

export function validateRegister(input: {
  email: string;
  password: string;
  confirmPassword?: string;
  name: string;
  companyName: string;
}): FieldErrors {
  const errors = validateLogin(input);
  if (!isNonEmpty(input.name)) errors.name = ValidationMessages.required;
  else if (!isNonEmpty(input.name, 2)) errors.name = ValidationMessages.nameMin;
  if (!isNonEmpty(input.companyName))
    errors.companyName = ValidationMessages.required;
  else if (!isNonEmpty(input.companyName, 2))
    errors.companyName = ValidationMessages.companyMin;
  if (input.confirmPassword !== undefined) {
    if (!isNonEmpty(input.confirmPassword))
      errors.confirmPassword = ValidationMessages.required;
    else if (input.password !== input.confirmPassword)
      errors.confirmPassword = ValidationMessages.passwordMismatch;
  }
  return errors;
}

export function validateUserCreate(input: {
  email: string;
  password: string;
  name: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.name)) errors.name = ValidationMessages.required;
  else if (!isNonEmpty(input.name, 2)) errors.name = ValidationMessages.nameMin;
  if (!isNonEmpty(input.email)) errors.email = ValidationMessages.required;
  else if (!isValidEmail(input.email)) errors.email = ValidationMessages.emailInvalid;
  if (!isNonEmpty(input.password)) errors.password = ValidationMessages.required;
  else if (!isValidPassword(input.password)) errors.password = ValidationMessages.passwordMin;
  return errors;
}

export function validateProfile(input: {
  name: string;
  phone?: string;
  companyName?: string;
  taxNumber?: string;
  authorizedPerson?: string;
  orgPhone?: string;
  address?: string;
  avatarUrl?: string;
  requireOrg?: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.name)) errors.name = ValidationMessages.required;
  else if (!isNonEmpty(input.name, 2)) errors.name = ValidationMessages.nameMin;

  if (input.phone && !isValidPhone(input.phone))
    errors.phone = ValidationMessages.phoneInvalid;
  if (input.avatarUrl && !isValidUrl(input.avatarUrl))
    errors.avatarUrl = ValidationMessages.urlInvalid;

  if (input.requireOrg) {
    if (!isNonEmpty(input.companyName || ""))
      errors.companyName = ValidationMessages.required;
    else if (!isNonEmpty(input.companyName || "", 2))
      errors.companyName = ValidationMessages.companyMin;

    if (!isNonEmpty(input.taxNumber || ""))
      errors.taxNumber = ValidationMessages.taxRequired;

    if (!isNonEmpty(input.authorizedPerson || ""))
      errors.authorizedPerson = ValidationMessages.required;
    else if (!isNonEmpty(input.authorizedPerson || "", 2))
      errors.authorizedPerson = ValidationMessages.authorizedMin;

    if (!isNonEmpty(input.orgPhone || ""))
      errors.orgPhone = ValidationMessages.required;
    else if (!isValidPhone(input.orgPhone || ""))
      errors.orgPhone = ValidationMessages.phoneInvalid;

    if (!isNonEmpty(input.address || ""))
      errors.address = ValidationMessages.required;
    else if (!isNonEmpty(input.address || "", 5))
      errors.address = ValidationMessages.addressMin;
  }
  return errors;
}

export function validateStoreForm(input: {
  name: string;
  city: string;
  address: string;
  openingDate: string;
  grossM2: string;
  floorCount: string;
  phone?: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.name)) errors.name = ValidationMessages.required;
  if (!isNonEmpty(input.city)) errors.city = ValidationMessages.cityRequired;
  if (!isNonEmpty(input.address)) errors.address = ValidationMessages.required;
  else if (!isNonEmpty(input.address, 5))
    errors.address = ValidationMessages.addressMin;
  if (!isNonEmpty(input.openingDate))
    errors.openingDate = ValidationMessages.dateRequired;

  if (!isNonEmpty(input.grossM2)) errors.grossM2 = ValidationMessages.required;
  else if (Number.isNaN(Number(input.grossM2)) || Number(input.grossM2) < 0)
    errors.grossM2 = ValidationMessages.positiveNumber;

  if (!isNonEmpty(input.floorCount))
    errors.floorCount = ValidationMessages.required;
  else if (
    Number.isNaN(Number(input.floorCount)) ||
    Number(input.floorCount) < 1
  )
    errors.floorCount = ValidationMessages.positiveNumber;

  if (input.phone && !isValidPhone(input.phone))
    errors.phone = ValidationMessages.phoneInvalid;

  return errors;
}

export function validateTicketForm(input: {
  title: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.title)) errors.title = ValidationMessages.titleRequired;
  return errors;
}

export function validateContractForm(input: {
  title: string;
  amount?: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.title)) errors.title = ValidationMessages.titleRequired;
  if (
    input.amount !== undefined &&
    input.amount !== "" &&
    (Number.isNaN(Number(input.amount)) || Number(input.amount) < 0)
  ) {
    errors.amount = ValidationMessages.positiveNumber;
  }
  return errors;
}

export function validateInvoiceForm(input: {
  invoiceNumber: string;
  amount?: string;
  taxAmount?: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!isNonEmpty(input.invoiceNumber))
    errors.invoiceNumber = ValidationMessages.required;
  if (
    input.amount !== undefined &&
    input.amount !== "" &&
    (Number.isNaN(Number(input.amount)) || Number(input.amount) < 0)
  ) {
    errors.amount = ValidationMessages.positiveNumber;
  }
  if (
    input.taxAmount !== undefined &&
    input.taxAmount !== "" &&
    (Number.isNaN(Number(input.taxAmount)) || Number(input.taxAmount) < 0)
  ) {
    errors.taxAmount = ValidationMessages.positiveNumber;
  }
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Merge: keep only keys that are still invalid after a field change */
export function clearFieldError(
  errors: FieldErrors,
  key: string
): FieldErrors {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}
