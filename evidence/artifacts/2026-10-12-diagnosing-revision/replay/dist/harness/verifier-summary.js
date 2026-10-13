function parseChecks(raw) {
    if (!Array.isArray(raw))
        return null;
    const checks = [];
    for (const entry of raw) {
        if (typeof entry !== 'object' || entry === null)
            continue;
        const { name, pass } = entry;
        if (typeof name === 'string' && name.length > 0 && typeof pass === 'boolean') {
            checks.push({ name, pass });
        }
    }
    return checks;
}
function summarize(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return null;
    const obj = value;
    const passed = typeof obj['passed'] === 'boolean' ? obj['passed'] : null;
    const checks = parseChecks(obj['checks']);
    if (passed === null && checks === null)
        return null;
    return { passed, checks: checks ?? [] };
}
// The verifier's one-line JSON summary rides on merged stdout+stderr, so scan
// from the end for the last line that parses as a summary object.
export function parseVerifierSummary(output) {
    const lines = output.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line.startsWith('{') || !line.endsWith('}'))
            continue;
        try {
            const summary = summarize(JSON.parse(line));
            if (summary)
                return summary;
        }
        catch {
            continue;
        }
    }
    return null;
}
export function scoreFromChecks(checks) {
    if (checks.length === 0)
        return null;
    const passes = checks.filter((check) => check.pass).length;
    return passes / checks.length;
}
export function verdictFromOutput(output) {
    const summary = parseVerifierSummary(output);
    if (!summary)
        return null;
    return {
        passed: summary.passed,
        checks: summary.checks.length > 0 ? summary.checks : null,
        score: scoreFromChecks(summary.checks),
    };
}
