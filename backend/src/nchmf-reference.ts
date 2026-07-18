// Lớp đối chiếu/validation với NCHMF (Trung tâm Dự báo Khí tượng Thuỷ văn
// Quốc gia, nchmf.gov.vn) — nguồn dự báo chính thức cấp NHÀ NƯỚC, dùng để
// SO SÁNH với dự báo Open-Meteo, KHÔNG thay thế pipeline ingest hiện tại
// (weather-ingest.ts). Xem docs/dienbien-phase1.md mục 3.
//
// GIỚI HẠN QUAN TRỌNG: NCHMF chỉ công bố 1 trang dự báo / tỉnh (theo thành
// phố trung tâm tỉnh lỵ), KHÔNG có trang riêng theo xã. Đã tìm kiếm nhưng
// KHÔNG có trang cho Tủa Chùa/Mường Nhé — chỉ có trang cho Mường Thanh
// (tức phường Điện Biên Phủ, trung tâm thành phố). Vì vậy module này CHỈ áp
// dụng cho địa điểm có code 'dbp' trong locations.ts.
//
// Trang không có API JSON công khai, chỉ có HTML server-render (đã kiểm tra
// ngày 2026-07-17, không cần JS/AJAX). Không có class/id ổn định theo tài
// liệu công khai nào — các selector dưới đây được suy ra bằng cách tải trực
// tiếp trang thật và xem cấu trúc DOM thực tế. NCHMF có thể đổi giao diện bất
// kỳ lúc nào mà không báo trước — khi đó parser dưới đây sẽ ném lỗi rõ ràng
// (KHÔNG âm thầm trả về 0/null, khớp quy ước "không bịa dữ liệu" của dự án —
// xem thresholds.py, dienbien-phase1.md).

import 'dotenv/config';
import * as cheerio from 'cheerio';

/** Trang dự báo NCHMF cho Mường Thanh (Điện Biên Phủ) — chỉ có ở cấp tỉnh lỵ. */
export const NCHMF_MUONG_THANH_URL =
  'https://nchmf.gov.vn/kttvsite/vi-VN/1/muong-thanh-dien-bien-w38.html';

const NCHMF_FETCH_TIMEOUT_MS = Number(process.env.NCHMF_FETCH_TIMEOUT_MS ?? 8000);

// Là 1 dự án demo hackathon sinh viên — KHÔNG giả danh trình duyệt/bot lạ,
// khai báo rõ danh tính để nchmf.gov.vn có thể chặn nếu không muốn bị gọi.
const USER_AGENT = 'Forestgump-DienBien-Hackathon-Demo/1.0';

/** Dự báo 1 ngày trong danh sách "Thời tiết 10 ngày tới" của NCHMF. */
export interface NchmfDayForecast {
  /** YYYY-MM-DD (giờ địa phương, suy từ định dạng DD/MM/YYYY trên trang). */
  date: string;
  tempMinC: number;
  tempMaxC: number;
  condition: string;
}

/** Dữ liệu tham chiếu NCHMF cho 1 lần fetch trang Mường Thanh. */
export interface NchmfReference {
  currentTempC: number;
  currentHumidityPct: number;
  /** ISO 8601, giờ Việt Nam (+07:00), suy từ "Cập nhật: HH:MM DD/MM/YYYY". */
  currentUpdatedAt: string;
  /** Dự báo "hôm nay" — NCHMF tách riêng nhiệt độ ban ngày/ban đêm, không gộp min/max 1 chỗ. */
  today: {
    /** YYYY-MM-DD. */
    date: string;
    /** Nhiệt độ khối "Dự báo ngày hôm nay". */
    tempMaxC: number;
    /** Nhiệt độ khối "Dự báo đêm hôm nay". */
    tempMinC: number;
  };
  /** Danh sách 10 ngày tới, KHÔNG bao gồm "hôm nay" (NCHMF bắt đầu từ ngày mai). */
  tenDayForecast: NchmfDayForecast[];
  /** Thời điểm module này gọi NCHMF, ISO 8601. */
  fetchedAt: string;
}

/** Nhiệt độ dạng "24°C" hoặc ": 24°C" -> 24. */
function parseTempC(text: string): number {
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*°?C/);
  if (!m || m[1] === undefined) {
    throw new Error(`[NCHMF] Không đọc được nhiệt độ từ chuỗi "${text}"`);
  }
  return Number(m[1]);
}

/** Độ ẩm dạng "94" hoặc ": 94" -> 94. */
function parseHumidityPct(text: string): number {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  if (!m || m[1] === undefined) {
    throw new Error(`[NCHMF] Không đọc được độ ẩm từ chuỗi "${text}"`);
  }
  return Number(m[1]);
}

/** "18/07/2026" -> "2026-07-18". */
function parseDdMmYyyy(text: string): string {
  const m = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m || m[1] === undefined || m[2] === undefined || m[3] === undefined) {
    throw new Error(`[NCHMF] Không đọc được ngày từ chuỗi "${text}"`);
  }
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

/** "Cập nhật: 22h  17/07/2026" hoặc "Cập nhật: 04h30 17/07/2026" -> ISO + ngày YYYY-MM-DD. */
function parseUpdatedAt(text: string): { iso: string; date: string } {
  const m = text.match(/(\d{1,2})h(\d{2})?\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m || m[1] === undefined || m[3] === undefined || m[4] === undefined || m[5] === undefined) {
    throw new Error(`[NCHMF] Không đọc được mốc "Cập nhật" từ chuỗi "${text}"`);
  }
  const hour = m[1].padStart(2, '0');
  const minute = (m[2] ?? '00').padStart(2, '0');
  const date = `${m[5]}-${m[4]}-${m[3]}`;
  return { iso: `${date}T${hour}:${minute}:00+07:00`, date };
}

/**
 * Đọc 1 khối "text-weather-location" (Thời tiết hiện tại / Dự báo ngày hôm
 * nay / Dự báo đêm hôm nay) — cả 3 khối cùng cấu trúc: tiêu đề (<a>), mốc
 * "Cập nhật" và danh sách nhãn/giá trị "Nhiệt độ" / "Độ ẩm" / ...
 */
function readLabelValueBlock($: cheerio.CheerioAPI, block: cheerio.Cheerio<any>) {
  const label = block.children('a').first().text().trim();
  const updatedText = block.find('.time-update').first().text().trim();
  const fields = new Map<string, string>();
  block.find('.list-info-wt li').each((_, li) => {
    const $li = $(li);
    const key = $li.find('.uk-width-1-4').first().text().trim();
    const value = $li
      .find('.uk-width-3-4')
      .first()
      .text()
      .replace(/^:\s*/, '')
      .trim();
    if (key) fields.set(key, value);
  });
  return { label, updatedText, fields };
}

/** Parse HTML trang Mường Thanh thành NchmfReference. Ném lỗi rõ ràng nếu thiếu bất kỳ phần nào. */
export function parseNchmfHtml(html: string): NchmfReference {
  const $ = cheerio.load(html);

  const blocks = $('.text-weather-location');
  if (blocks.length === 0) {
    throw new Error(
      '[NCHMF] Không tìm thấy khối ".text-weather-location" nào — trang có thể đã đổi cấu trúc'
    );
  }

  let current: { tempC: number; humidityPct: number; updatedAtIso: string } | undefined;
  let todayTempMaxC: number | undefined;
  let todayDate: string | undefined;
  let tonightTempMinC: number | undefined;

  blocks.each((_, el) => {
    const { label, updatedText, fields } = readLabelValueBlock($, $(el));

    if (label === 'Thời tiết hiện tại') {
      const tempText = fields.get('Nhiệt độ');
      const humidityText = fields.get('Độ ẩm');
      if (!tempText || !humidityText) {
        throw new Error('[NCHMF] Khối "Thời tiết hiện tại" thiếu "Nhiệt độ" hoặc "Độ ẩm"');
      }
      current = {
        tempC: parseTempC(tempText),
        humidityPct: parseHumidityPct(humidityText),
        updatedAtIso: parseUpdatedAt(updatedText).iso,
      };
    } else if (label === 'Dự báo ngày hôm nay') {
      const tempText = fields.get('Nhiệt độ');
      if (!tempText) {
        throw new Error('[NCHMF] Khối "Dự báo ngày hôm nay" thiếu "Nhiệt độ"');
      }
      todayTempMaxC = parseTempC(tempText);
      todayDate = parseUpdatedAt(updatedText).date;
    } else if (label === 'Dự báo đêm hôm nay') {
      const tempText = fields.get('Nhiệt độ');
      if (!tempText) {
        throw new Error('[NCHMF] Khối "Dự báo đêm hôm nay" thiếu "Nhiệt độ"');
      }
      tonightTempMinC = parseTempC(tempText);
    }
  });

  if (!current || todayTempMaxC === undefined || todayDate === undefined || tonightTempMinC === undefined) {
    throw new Error(
      '[NCHMF] Thiếu 1 trong 3 khối "Thời tiết hiện tại" / "Dự báo ngày hôm nay" / "Dự báo đêm hôm nay"'
    );
  }

  const dayItems = $('.ten-days-weather .item-days-wt');
  if (dayItems.length === 0) {
    throw new Error(
      '[NCHMF] Không tìm thấy danh sách "Thời tiết 10 ngày tới" (".ten-days-weather .item-days-wt")'
    );
  }

  const tenDayForecast: NchmfDayForecast[] = dayItems.toArray().map((el) => {
    const $item = $(el);
    const dateText = $item.find('.date-wt span').first().text().trim();
    const tempMaxText = $item
      .find('.temp-days-wt:has(img[src*="temperature_Hi"]) .large-temp')
      .first()
      .text()
      .trim();
    const tempMinText = $item
      .find('.temp-days-wt:has(img[src*="temperature_Lo"]) .small-temp')
      .first()
      .text()
      .trim();
    const condition = $item.find('.text-temp').first().text().trim();

    if (!dateText || !tempMaxText || !tempMinText || !condition) {
      throw new Error(
        `[NCHMF] Thiếu dữ liệu trong 1 mục của danh sách 10 ngày (ngày đọc được: "${dateText}")`
      );
    }

    return {
      date: parseDdMmYyyy(dateText),
      tempMaxC: parseTempC(tempMaxText),
      tempMinC: parseTempC(tempMinText),
      condition,
    };
  });

  return {
    currentTempC: current.tempC,
    currentHumidityPct: current.humidityPct,
    currentUpdatedAt: current.updatedAtIso,
    today: { date: todayDate, tempMaxC: todayTempMaxC, tempMinC: tonightTempMinC },
    tenDayForecast,
    fetchedAt: new Date().toISOString(),
  };
}

type CacheEntry =
  | { kind: 'success'; value: NchmfReference; cachedAt: number }
  | { kind: 'failure'; error: Error; cachedAt: number };

const SUCCESS_CACHE_TTL_MS = 30 * 60 * 1000; // NCHMF chỉ cập nhật ~3 lần/ngày (04h30/15h30/22h).
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000; // Tránh spam lại site khi đang lỗi/đổi cấu trúc.

let cache: CacheEntry | undefined;

/** Gọi trực tiếp NCHMF (không qua cache) — dùng nội bộ bởi fetchNchmfReference(). */
async function fetchNchmfReferenceUncached(): Promise<NchmfReference> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NCHMF_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(NCHMF_MUONG_THANH_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      throw new Error(`[NCHMF] Trang trả về status ${res.status}`);
    }
    const html = await res.text();
    return parseNchmfHtml(html);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Lấy dữ liệu tham chiếu NCHMF cho Mường Thanh (địa điểm 'dbp'), có cache
 * trong bộ nhớ tiến trình: 30 phút cho kết quả thành công, 5 phút cho lỗi
 * (tránh dội request vào site chính phủ khi đang lỗi/đổi cấu trúc). Ném lỗi
 * rõ ràng nếu fetch/parse thất bại — không âm thầm trả về dữ liệu rỗng.
 */
export async function fetchNchmfReference(): Promise<NchmfReference> {
  const now = Date.now();
  if (cache) {
    const ttl = cache.kind === 'success' ? SUCCESS_CACHE_TTL_MS : FAILURE_CACHE_TTL_MS;
    if (now - cache.cachedAt < ttl) {
      if (cache.kind === 'success') return cache.value;
      throw cache.error;
    }
  }

  try {
    const value = await fetchNchmfReferenceUncached();
    cache = { kind: 'success', value, cachedAt: now };
    console.log(
      `[NCHMF] Đã lấy dữ liệu tham chiếu (cập nhật lúc ${value.currentUpdatedAt}, ${value.tenDayForecast.length} ngày)`
    );
    return value;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    cache = { kind: 'failure', error, cachedAt: now };
    console.error('[NCHMF] Lấy dữ liệu tham chiếu thất bại:', error.message);
    throw error;
  }
}
