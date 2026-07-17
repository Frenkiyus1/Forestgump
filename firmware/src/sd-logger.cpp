#include "sd-logger.h"
#include "config.h"
#include "net-log.h"
#include <SPI.h>
#include <SD.h>

static SPIClass spiSd(VSPI);
static bool sdReady = false;

bool sdBegin() {
	spiSd.begin(PIN_SD_SCK, PIN_SD_MISO, PIN_SD_MOSI, PIN_SD_CS);
	// Ép tần số SPI 400kHz để loại trừ lỗi dây dài/nhiễu (mặc định 25MHz hay fail).
	if (!SD.begin(PIN_SD_CS, spiSd, 400000)) {
		LOG.println(F("[SD] Không mount được thẻ - kiểm tra: dây nối, nguồn 5V, định dạng FAT32"));
		sdReady = false;
		return false;
	}

	// In loại & dung lượng thẻ để xác nhận đọc được phần cứng.
	const uint8_t cardType = SD.cardType();
	if (cardType == CARD_NONE) {
		LOG.println(F("[SD] Có SPI nhưng không nhận diện được thẻ (CARD_NONE)"));
		sdReady = false;
		return false;
	}
	const char* typeName =
		cardType == CARD_MMC  ? "MMC" :
		cardType == CARD_SD   ? "SDSC" :
		cardType == CARD_SDHC ? "SDHC" : "UNKNOWN";
	LOG.printf("[SD] Loại thẻ: %s | Dung lượng: %lluMB\n",
	              typeName, SD.cardSize() / (1024ULL * 1024ULL));
	sdReady = true;

	// Ghi header một lần nếu file mới.
	if (!SD.exists(SD_LOG_PATH)) {
		File f = SD.open(SD_LOG_PATH, FILE_WRITE);
		if (f) {
			f.println(F("uptime_ms,temp,ec,level,vbat,sent"));
			f.close();
		}
	}
	LOG.println(F("[SD] Sẵn sàng"));
	return true;
}

void sdLog(const SensorReading& r, bool sent) {
	if (!sdReady) return;

	File f = SD.open(SD_LOG_PATH, FILE_APPEND);
	if (!f) {
		LOG.println(F("[SD] Mở file để ghi thất bại"));
		return;
	}

	// uptime_ms thay cho RTC (chưa có module thời gian thực trên sơ đồ).
	f.printf("%lu,%.2f,%.3f,%.2f,%.2f,%d\n",
		millis(), r.temp, r.ec, r.level, r.vbat, sent ? 1 : 0);
	f.close();
}
