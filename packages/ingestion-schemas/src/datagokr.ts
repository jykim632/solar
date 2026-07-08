import { z } from 'zod';

/**
 * data.go.kr (공공데이터포털) standard JSON envelope.
 *
 * Most KPX datasets wrap payloads as `response.body.items.item[]` with a
 * `response.header.resultCode` ("00" = success). External numbers often
 * arrive as strings, so adapters coerce in staging — here we only assert
 * the envelope shape needed to detect a usable response before persisting.
 *
 * `item` is kept as `unknown[]`: dataset-specific row schemas live next to
 * each adapter, validated after raw storage. This guards only the envelope.
 */
export const DataGoKrHeaderSchema = z.object({
  resultCode: z.string(),
  resultMsg: z.string(),
});

export const DataGoKrBodySchema = z.object({
  items: z
    .object({
      item: z.array(z.unknown()).default([]),
    })
    .nullable()
    .optional(),
  numOfRows: z.coerce.number().int().optional(),
  pageNo: z.coerce.number().int().optional(),
  totalCount: z.coerce.number().int().optional(),
});

export const DataGoKrEnvelopeSchema = z.object({
  response: z.object({
    header: DataGoKrHeaderSchema,
    body: DataGoKrBodySchema.optional(),
  }),
});

export type DataGoKrEnvelope = z.infer<typeof DataGoKrEnvelopeSchema>;

/** data.go.kr success marker (`resultCode === "00"`). */
export const DATA_GO_KR_OK = '00';
