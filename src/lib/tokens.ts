import * as Crypto from 'expo-crypto';

export async function secureRandomToken(bytes = 24): Promise<string> {
  const random = await Crypto.getRandomBytesAsync(bytes);
  return Array.from(random, (value) => value.toString(16).padStart(2, '0')).join('');
}
