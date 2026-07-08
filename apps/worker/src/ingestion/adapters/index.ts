import type { DatasourceKey, IngestionAdapter } from '../core.js';
import { kmaSolarIrradianceAdapter } from './kma-solar-irradiance.js';
import { kmaVilageFcstAdapter } from './kma-vilage-fcst.js';
import { kpxPvGenerationAdapter } from './kpx-pv-gen.js';
import { kpxRecMarketAdapter } from './kpx-rec.js';
import { kpxSmpAdapter } from './kpx-smp.js';
import { kpxSupplyAdapter } from './kpx-supply.js';

const adapters = new Map<DatasourceKey, IngestionAdapter>([
  ['kpx-pv-gen', kpxPvGenerationAdapter],
  ['kpx-rec', kpxRecMarketAdapter],
  ['kpx-smp', kpxSmpAdapter],
  ['kpx-supply', kpxSupplyAdapter],
  ['kma-vilage-fcst', kmaVilageFcstAdapter],
  ['kma-solar-irradiance', kmaSolarIrradianceAdapter],
]);

export function getAdapter(key: string): IngestionAdapter {
  const adapter = adapters.get(key as DatasourceKey);

  if (!adapter) {
    throw new Error(
      `Unsupported datasource "${key}". Supported: ${listDatasourceKeys().join(', ')}`,
    );
  }

  return adapter;
}

export function listDatasourceKeys(): DatasourceKey[] {
  return [...adapters.keys()];
}
