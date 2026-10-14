/** Read Codex's explicit-only policy from a Skill's agents/openai.yaml metadata. */
export function isImplicitInvocationDisabled(metadata: string | null): boolean {
  if (metadata === null) return false;
  const disabled = /(?:^|[\s{,])allow_implicit_invocation:\s*(?:false|"false"|'false')(?=\s*(?:[,}#]|$))/;
  let inPolicy = false;
  for (const line of metadata.split(/\r?\n/)) {
    if (/^policy:/.test(line)) {
      inPolicy = true;
      if (disabled.test(line)) return true;
    } else if (/^[A-Za-z_][\w-]*:/.test(line)) {
      inPolicy = false;
    } else if (inPolicy && /^\s+/.test(line) && disabled.test(line)) {
      return true;
    }
  }
  return false;
}
