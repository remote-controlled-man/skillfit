function redactHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => (
      /^(?:authorization|cookie)$/i.test(name)
        ? [name, '[REDACTED]']
        : [name, value]
    )),
  );
}

export function formatFailure({ message, requestId, headers = {}, debug = false }) {
  const report = {
    level: 'error',
    message,
    requestId,
    headers: redactHeaders(headers),
  };

  if (debug) {
    report.debug = {
      transport: 'webhook',
      attempt: 1,
    };
  }

  return JSON.stringify(report);
}
