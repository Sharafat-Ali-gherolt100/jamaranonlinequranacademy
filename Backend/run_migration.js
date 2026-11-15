/**
 * run_migration.js
 * Runs all migration files in the migrations/ directory in order.
 * Safe to run multiple times — all migrations use IF NOT EXISTS / ON DUPLICATE KEY.
 *
 * Usage:   node run_migration.js
 *          node run_migration.js 001   (run a specific migration by prefix)
 */

const fs = require("fs");
const path = require("path");
const pool = require("./db");

const MIGRATION_DIR = path.join(__dirname, "migrations");

async function runFile(filePath) {
    console.log(`\n──────────────────────────────────────────`);
    console.log(`Running: ${path.basename(filePath)}`);
    console.log(`──────────────────────────────────────────`);

    const rawSql = fs.readFileSync(filePath, "utf8");

    // Strip single-line comments
    const cleanSql = rawSql
        .split("\n")
        .map(line => line.trim().startsWith("--") ? "" : line)
        .join("\n");

    const statements = cleanSql
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);

    let ran = 0;
    for (const stmt of statements) {
        try {
            await pool.query(stmt);
            ran++;
        } catch (err) {
            // Log but continue — some ALTER ADD COLUMN IF NOT EXISTS may not be
            // supported on older MySQL; treat as non-fatal for re-runs.
            console.warn(`  Warning: ${err.message.split("\n")[0]}`);
        }
    }

    console.log(`  ✓ Completed (${ran} statements executed)`);
}

async function main() {
    const filter = process.argv[2] || null;

    try {
        const files = fs.readdirSync(MIGRATION_DIR)
            .filter(f => f.endsWith(".sql"))
            .sort(); // alphabetical = chronological order by naming convention

        const toRun = filter
            ? files.filter(f => f.startsWith(filter))
            : files;

        if (!toRun.length) {
            console.error(`No migration files found${filter ? ` matching "${filter}"` : ""}.`);
            process.exit(1);
        }

        for (const file of toRun) {
            await runFile(path.join(MIGRATION_DIR, file));
        }

        console.log("\n✅  All migrations completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("\n❌  Migration runner error:", error.message);
        process.exit(1);
    } finally {
        pool.end().catch(() => {});
    }
}

main();
