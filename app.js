const fs = require("fs");
const path = require("path");

// ============================================
// CONFIGURATION
// ============================================

// Folder to scan
const SOURCE_FOLDER = path.join(__dirname, "Create_List");

// Output files
const JSON_OUTPUT = path.join(__dirname, "file-list.json");
const CSV_OUTPUT = path.join(__dirname, "file-list.csv");

// Set to true to scan subfolders recursively
const SCAN_SUBFOLDERS = true;

// Set to null to scan every file.
// Example: [".mp3"] to scan only MP3 files.
const ALLOWED_EXTENSIONS = null;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert file size into a human-readable format.
 */
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Escape a value for CSV format.
 */
function escapeCSV(value) {
    const stringValue = String(value ?? "");

    return `"${stringValue.replace(/"/g, '""')}"`;
}

/**
 * Recursively scan a directory and collect file information.
 */
function scanDirectory(directory, results = []) {
    let entries;

    try {
        entries = fs.readdirSync(directory, {
            withFileTypes: true
        });
    } catch (error) {
        console.error(
            `Cannot read directory: ${directory}\n${error.message}`
        );

        return results;
    }

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        try {
            // Skip symbolic links to avoid following directory loops.
            if (entry.isSymbolicLink()) {
                continue;
            }

            // Scan subdirectories.
            if (entry.isDirectory()) {
                if (SCAN_SUBFOLDERS) {
                    scanDirectory(fullPath, results);
                }

                continue;
            }

            // Ignore anything that is not a regular file.
            if (!entry.isFile()) {
                continue;
            }

            const extension = path.extname(entry.name).toLowerCase();

            // Apply the extension filter if configured.
            if (
                ALLOWED_EXTENSIONS !== null &&
                !ALLOWED_EXTENSIONS.includes(extension)
            ) {
                continue;
            }

            const stats = fs.statSync(fullPath);

            results.push({
                fileName: entry.name,

                extension: extension || "(no extension)",

                relativePath: path.relative(
                    SOURCE_FOLDER,
                    fullPath
                ),

                fullPath: fullPath,

                sizeBytes: stats.size,

                size: formatFileSize(stats.size),

                createdAt: stats.birthtime.toISOString(),

                modifiedAt: stats.mtime.toISOString()
            });

        } catch (error) {
            console.error(
                `Skipping file: ${fullPath}\n${error.message}`
            );
        }
    }

    return results;
}

// ============================================
// MAIN FUNCTION
// ============================================

function main() {
    console.log("============================================");
    console.log("          FILE SCANNER");
    console.log("============================================");

    console.log(`Source folder: ${SOURCE_FOLDER}`);

    console.log("--------------------------------------------");

    // Check whether the source folder exists.
    if (!fs.existsSync(SOURCE_FOLDER)) {
        console.error(
            `ERROR: Folder does not exist:\n${SOURCE_FOLDER}`
        );

        console.log(
            "\nCreate a folder named 'Create_List' next to app.js."
        );

        process.exitCode = 1;
        return;
    }

    const folderStats = fs.statSync(SOURCE_FOLDER);

    if (!folderStats.isDirectory()) {
        console.error("ERROR: Create_List is not a directory.");

        process.exitCode = 1;
        return;
    }

    console.log("Scanning files...\n");

    // Scan all files.
    const files = scanDirectory(SOURCE_FOLDER);

    // Sort alphabetically by relative path.
    files.sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath)
    );

    // ========================================
    // SUMMARY
    // ========================================

    const extensionCounts = {};

    let totalSizeBytes = 0;

    for (const file of files) {
        extensionCounts[file.extension] =
            (extensionCounts[file.extension] || 0) + 1;

        totalSizeBytes += file.sizeBytes;
    }

    console.log("============================================");
    console.log("               SCAN SUMMARY");
    console.log("============================================");

    console.log(`Total files: ${files.length}`);

    console.log(`Total size: ${formatFileSize(totalSizeBytes)}`);

    console.log("\nFiles by extension:");

    for (const [extension, count] of Object.entries(
        extensionCounts
    )) {
        console.log(`  ${extension}: ${count}`);
    }

    // ========================================
    // DISPLAY FILE LIST
    // ========================================

    console.log("\n============================================");
    console.log("               FILE LIST");
    console.log("============================================\n");

    if (files.length === 0) {
        console.log("No files found.");
    } else {
        files.forEach((file, index) => {
            console.log(
                `${index + 1}. ${file.relativePath} | ${file.size}`
            );
        });
    }

    // ========================================
    // SAVE JSON
    // ========================================

    try {
        const jsonData = {
            scannedFolder: SOURCE_FOLDER,

            scannedAt: new Date().toISOString(),

            totalFiles: files.length,

            totalSizeBytes: totalSizeBytes,

            totalSize: formatFileSize(totalSizeBytes),

            extensionCounts: extensionCounts,

            files: files
        };

        fs.writeFileSync(
            JSON_OUTPUT,
            JSON.stringify(jsonData, null, 2),
            "utf8"
        );

        console.log(`\nJSON report saved: ${JSON_OUTPUT}`);

    } catch (error) {
        console.error(
            `Could not save JSON report: ${error.message}`
        );
    }

    // ========================================
    // SAVE CSV
    // ========================================

    try {
        const headers = [
            "File Name",
            "Extension",
            "Relative Path",
            "Full Path",
            "Size Bytes",
            "Size",
            "Created At",
            "Modified At"
        ];

        const rows = files.map(file => [
            file.fileName,
            file.extension,
            file.relativePath,
            file.fullPath,
            file.sizeBytes,
            file.size,
            file.createdAt,
            file.modifiedAt
        ]);

        const csvContent = [
            headers.map(escapeCSV).join(","),
            ...rows.map(row =>
                row.map(escapeCSV).join(",")
            )
        ].join("\r\n");

        // UTF-8 BOM improves compatibility with Microsoft Excel.
        fs.writeFileSync(
            CSV_OUTPUT,
            "\uFEFF" + csvContent,
            "utf8"
        );

        console.log(`CSV report saved: ${CSV_OUTPUT}`);

    } catch (error) {
        console.error(
            `Could not save CSV report: ${error.message}`
        );
    }

    console.log("\n============================================");
    console.log("             SCAN COMPLETED");
    console.log("============================================");
}

// ============================================
// START APPLICATION
// ============================================

try {
    main();
} catch (error) {
    console.error("Unexpected error:", error.message);
    process.exitCode = 1;
}