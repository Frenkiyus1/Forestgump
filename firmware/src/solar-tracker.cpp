#include "solar-tracker.h"
#include "config.h"

struct DriverPins {
	uint8_t step;
	uint8_t dir;
	uint8_t en;  // active-LOW
};

static const DriverPins TILT = { PIN_TILT_STEP, PIN_TILT_DIR, PIN_TILT_EN };
static const DriverPins ROT = { PIN_ROT_STEP, PIN_ROT_DIR, PIN_ROT_EN };

static const DriverPins& pinsFor(Axis axis) {
	return (axis == Axis::Tilt) ? TILT : ROT;
}

static void setupDriver(const DriverPins& d) {
	pinMode(d.step, OUTPUT);
	pinMode(d.dir, OUTPUT);
	pinMode(d.en, OUTPUT);
	digitalWrite(d.step, LOW);
	digitalWrite(d.dir, LOW);
	digitalWrite(d.en, HIGH);  // nhả motor lúc khởi động
}

void trackerBegin() {
	setupDriver(TILT);
	setupDriver(ROT);
}

void trackerMoveSteps(Axis axis, int32_t steps, uint16_t stepDelayUs) {
	if (steps == 0) return;
	const DriverPins& d = pinsFor(axis);

	digitalWrite(d.dir, steps > 0 ? HIGH : LOW);
	digitalWrite(d.en, LOW);  // cấp dòng
	delayMicroseconds(5);     // DRV8825 cần ~650ns sau khi enable trước xung STEP

	const uint32_t count = abs(steps);
	for (uint32_t i = 0; i < count; i++) {
		digitalWrite(d.step, HIGH);
		delayMicroseconds(stepDelayUs);
		digitalWrite(d.step, LOW);
		delayMicroseconds(stepDelayUs);
	}

	digitalWrite(d.en, HIGH);  // nhả lại để không nóng driver/motor
}

// Integrated ramped-move helpers that reuse existing driver pins
// Motion parameters
static const int stepsPerRevolution = 200;
static const int totalSteps = stepsPerRevolution * 5;

// Delay càng lớn càng chậm
static const int startDelay = 3000;
static const int runDelay   = 1000;

// Số bước dùng để tăng tốc và giảm tốc
static const int rampSteps = 200;

static long mapLong(long x, long in_min, long in_max, long out_min, long out_max) {
    if (in_max == in_min) return out_min;
    return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

static void phatXungDriver(const DriverPins& d, int delayStep) {
    digitalWrite(d.step, HIGH);
    delayMicroseconds(10);
    digitalWrite(d.step, LOW);
    delayMicroseconds(delayStep);
}

// Move `soBuoc` steps on `axis` with acceleration / steady / deceleration phases.
void trackerMoveRamped(Axis axis, bool direction, int32_t soBuoc) {
    if (soBuoc <= 0) return;
    const DriverPins& d = pinsFor(axis);

    digitalWrite(d.dir, direction ? HIGH : LOW);
    digitalWrite(d.en, LOW); // enable driver
    delayMicroseconds(20);

    int soBuocRamp = rampSteps;
    if (soBuocRamp * 2 > soBuoc) soBuocRamp = soBuoc / 2;

    for (int i = 0; i < soBuocRamp; i++) {
        int currentDelay = (int)mapLong(i, 0, soBuocRamp - 1, startDelay, runDelay);
        phatXungDriver(d, currentDelay);
    }

    int buocOnDinh = soBuoc - 2 * soBuocRamp;
    for (int i = 0; i < buocOnDinh; i++) phatXungDriver(d, runDelay);

    for (int i = 0; i < soBuocRamp; i++) {
        int currentDelay = (int)mapLong(i, 0, soBuocRamp - 1, runDelay, startDelay);
        phatXungDriver(d, currentDelay);
    }

    digitalWrite(d.en, HIGH); // disable driver
}
