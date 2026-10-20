export const ENV = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5122',
  googleClientId:
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
    '820182799917-5gpg8ji7tbji6hjsh8jsp27brkft5ha2.apps.googleusercontent.com',
  appName: 'SaviBite',
} as const;
