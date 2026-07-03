import type { DataGoKrAdapter, DatasourceKey } from '../core.js';
import { kpxPvGenerationAdapter } from './kpx-pv-gen.js';
import { kpxRecMarketAdapter } from './kpx-rec.js';

const adapters = new Map<DatasourceKey, DataGoKrAdapter>([
  ['kpx-pv-gen', kpxPvGenerationAdapter],
  ['kpx-rec', kpxRecMarketAdapter],
]);

export function getAdapter(key: string): DataGoKrAdapter {
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
