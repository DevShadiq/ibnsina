export function normalizeAndValidateMeasurements(employee, { required = true } = {}) {
  const height = String(employee.HEIGHT || '').trim();
  const weight = String(employee.WEIGHT || '').trim();

  if (!required) {
    employee.HEIGHT = height || null;
    employee.WEIGHT = weight || null;
    return;
  }

  if (height) {
    const match = height.match(/^(\d{1,2})\s*'\s*(\d{1,2})\s*"?$/)
      || height.match(/^(\d{1,2})\s*(?:ft|feet|[.\-])\s*(\d{1,2})\s*(?:in|inches?)?$/i);
    const feet = match ? Number(match[1]) : 0;
    const inches = match ? Number(match[2]) : -1;

    if (!match || feet < 1 || inches < 0 || inches > 11) {
      throw Object.assign(
        new Error('Height must contain valid feet and inches (inches must be between 0 and 11).'),
        { status: 400 }
      );
    }

    employee.HEIGHT = `${feet}' ${inches}"`;
  } else {
    employee.HEIGHT = null;
  }

  if (weight && !/^\d+(?:\.\d+)?$/.test(weight)) {
    throw Object.assign(
      new Error('Weight must be a number in kilograms.'),
      { status: 400 }
    );
  }

  employee.WEIGHT = weight || null;
}
