import * as Print from 'expo-print';
import type { HealthEntry, Pet, WeightEntry } from '../types';
import { healthSummaryHtml } from './healthHtml';

export { healthSummaryHtml } from './healthHtml';

export async function generateHealthSummaryPdf(
  pet: Pet,
  weights: WeightEntry[],
  health: HealthEntry[],
): Promise<string> {
  const html = healthSummaryHtml(pet, weights, health);
  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}
