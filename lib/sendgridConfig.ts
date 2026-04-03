// Values come from EXPO_PUBLIC_* at build time (.env locally, EAS Environment variables in the cloud).
export const SENDGRID_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_SENDGRID_API_KEY ?? '',
  fromEmail: process.env.EXPO_PUBLIC_SENDGRID_FROM_EMAIL ?? '',
};
