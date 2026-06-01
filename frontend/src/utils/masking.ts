export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 3) return email;
  return email.substring(0, 3) + "***" + email.substring(at);
}

export function maskPhone(phone: string): string {
  if (phone.length <= 3) return phone;
  return phone.substring(0, 3) + "***";
}
