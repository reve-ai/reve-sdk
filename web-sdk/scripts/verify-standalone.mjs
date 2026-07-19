#!/usr/bin/env node
/**
 * Verifies that the publishable output is fully stand-alone:
 * - package.json declares no runtime dependencies of any kind, and
 * - no file in dist/ imports or requires a bare module specifier.
 *
 * Exits non-zero with a description of every violation found.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const errors = [];

// -- package.json must not declare runtime dependencies. --
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
for (const field of ["dependencies", "peerDependencies", "optionalDependencies", "bundledDependencies"]) {
	const entries = Object.keys(packageJson[field] ?? {});
	if (entries.length > 0) {
		errors.push(`package.json "${field}" must be empty, found: ${entries.join(", ")}`);
	}
}

// -- dist/ must not reference bare module specifiers. --
const importPatterns = [
	/\bfrom\s+["']([^"']+)["']/g, // import/export ... from "x"
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, // dynamic import("x")
	/\bimport\s+["']([^"']+)["']/g, // side-effect import "x"
	/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g, // require("x")
];

function listFilesRecursive(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		return entry.isDirectory() ? listFilesRecursive(path) : [path];
	});
}

const distDir = join(packageRoot, "dist");
let distFiles = [];
try {
	distFiles = listFilesRecursive(distDir).filter((f) => /\.(js|d\.ts)$/.test(f));
} catch {
	errors.push('dist/ not found; run "tsc" before verifying');
}
if (distFiles.length === 0 && errors.length === 0) {
	errors.push("dist/ contains no build output");
}

for (const file of distFiles) {
	const source = readFileSync(file, "utf8");
	for (const pattern of importPatterns) {
		for (const match of source.matchAll(pattern)) {
			const specifier = match[1];
			if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
				errors.push(`${file}: outside dependency "${specifier}"`);
			}
		}
	}
}

if (errors.length > 0) {
	console.error("verify-standalone FAILED:");
	for (const error of errors) {
		console.error(`  - ${error}`);
	}
	process.exit(1);
}
console.log(`verify-standalone OK: ${distFiles.length} dist files, no outside dependencies`);
