// Client gọi Satellite Engine (service FastAPI riêng, port 8010 mặc định —
// xem satellite_engine/app.py) — module ảnh vệ tinh (segmentation), tách
// biệt hoàn toàn với ai_engine (dự báo độ mặn/thời tiết). Forward thẳng
// multipart body của request gốc, không parse lại file GeoTIFF ở backend.

import 'dotenv/config';
import { satellitePredictResponseSchema, type SatellitePredictResponse } from './schemas.js';

const SATELLITE_ENGINE_BASE_URL = process.env.SATELLITE_ENGINE_BASE_URL ?? 'http://localhost:8010';
const SATELLITE_ENGINE_TIMEOUT_MS = Number(process.env.SATELLITE_ENGINE_TIMEOUT_MS ?? 30000);

export class SatelliteEngineUnavailableError extends Error {}

export async function checkSatelliteHealth(): Promise<{ status: string; device: string; model_loaded: boolean }> {
  const res = await fetch(`${SATELLITE_ENGINE_BASE_URL}/health`);
  if (!res.ok) {
    throw new SatelliteEngineUnavailableError(`Satellite Engine /health trả về status ${res.status}`);
  }
  return res.json();
}

/**
 * Forward file GeoTIFF (multipart/form-data, nguyên trạng) sang Satellite
 * Engine POST /predict. `contentType` PHẢI giữ nguyên header gốc (chứa
 * boundary) để FastAPI parse đúng multipart.
 */
export async function forwardSatellitePredict(body: Buffer, contentType: string): Promise<SatellitePredictResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SATELLITE_ENGINE_TIMEOUT_MS);

  try {
    const res = await fetch(`${SATELLITE_ENGINE_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      signal: controller.signal,
      body: new Uint8Array(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new SatelliteEngineUnavailableError(
        `Satellite Engine /predict trả về status ${res.status}${detail ? `: ${detail}` : ''}`
      );
    }

    const parsed = satellitePredictResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new Error(`Sai định dạng phản hồi Satellite Engine /predict: ${parsed.error.issues[0]?.message}`);
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new SatelliteEngineUnavailableError('Satellite Engine timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
