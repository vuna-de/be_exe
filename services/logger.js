const levels = { info: 'INFO', warn: 'WARN', error: 'ERROR' };

function format(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${levels[level]}: ${message}`;
  if (!meta) return base;
  try {
    const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta);
    return `${base} | ${metaStr}`;
  } catch {
    return base;
  }
}

module.exports = {
  info(message, meta) {
    console.log(format('info', message, meta));
  },
  warn(message, meta) {
    console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    console.error(format('error', message, meta));
  }
};


