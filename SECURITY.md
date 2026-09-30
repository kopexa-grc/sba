# Security policy

## Reporting a vulnerability

Please do not report security issues in public issues or pull requests.

Send your report to **[security@kopexa.com](mailto:security@kopexa.com)** and include:

- what is affected and how it can be exploited,
- steps to reproduce or a proof of concept,
- the version (shown in the app's footer) and the browser you used.

Please give us reasonable time to fix the issue before you disclose it. Kopexa's full policy for coordinated disclosure is at
[kopexa.com/de/legal/security](https://kopexa.com/de/legal/security).

## Supported versions

Only the latest release is supported. It is what runs at [schutzbedarf.kopexa.com](https://schutzbedarf.kopexa.com/),
and installed apps offer the update on their next start.

## Scope

The app runs entirely in the browser. It has no server, no accounts and sends no data anywhere. Relevant are, for
example:

- cross-site scripting or code execution, including through crafted `.sba`, Excel or ODS files,
- weaknesses in how reports, checksums or version history can be manipulated unnoticed,
- dependencies with known vulnerabilities that are reachable in the app.

Findings in kopexa.com or other Kopexa services are covered by the policy linked above.
