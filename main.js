// Contenedores principales
const pageLayout = document.querySelector('.page-layout');
const converterContainer = document.querySelector('.converter__container');

// Entradas de texto (Textareas)
const jsonInput = document.getElementById('json-input');
const csvInput = document.getElementById('csv-input');

// Acciones
const convertBtn = document.getElementById('convert-btn');

// Etiquetas (opcional, por si necesitas cambiar el texto dinámicamente)
const jsonLabel = document.querySelector('label[for="json-input"]');
const csvLabel = document.querySelector('label[for="csv-input"]');


convertBtn.addEventListener("click", () => {
    convertJsonToCsv();
});


function convertJsonToCsv() {
    const rawInput = jsonInput.value.trim();

    // Guard: empty input
    if (!rawInput) {
        showError('⚠️ Please paste some JSON first.');
        return;
    }

    let jsonData;

    // 1. Parse JSON safely
    try {
        jsonData = JSON.parse(rawInput);
    } catch (error) {
        showError('❌ Invalid JSON format. Please check your input and try again.');
        return;
    }

    // 2. Normalise: wrap a single object in an array
    if (!Array.isArray(jsonData)) {
        if (typeof jsonData === 'object' && jsonData !== null) {
            jsonData = [jsonData];
        } else {
            showError('❌ JSON must be an object or an array of objects.');
            return;
        }
    }

    // 3. Guard: empty array
    if (jsonData.length === 0) {
        showError('⚠️ The JSON array is empty — nothing to convert.');
        return;
    }

    // 4. Flatten every object in the array (nested objects → "parent__child" keys)
    const flattenedData = jsonData.map(row => flattenObject(row));

    // 5. Expand rows: array-valued fields become multiple rows
    const expandedRows = flattenedData.flatMap(row => expandRows(row));

    // 6. Collect all unique headers (preserving insertion order)
    const headers = [...new Set(expandedRows.flatMap(row => Object.keys(row)))];

    // 7. Build CSV text
    const escapeCell = (value) => {
        if (value === null || value === undefined) return '""';
        const str = String(value);
        // Always wrap in quotes (matches expected output style)
        return `"${str.replace(/"/g, '""')}"`;
    };

    const headerRow = headers.map(h => `"${h}"`).join(',');
    const dataRows = expandedRows.map(row =>
        headers.map(key => escapeCell(row[key])).join(',')
    );

    const csv = [headerRow, ...dataRows].join('\n');

    // 8. Display result
    clearError();
    csvInput.value = csv;
    csvInput.classList.add('converter__control--success');
    setTimeout(() => csvInput.classList.remove('converter__control--success'), 1000);
}


/* ── Core helpers ── */

/**
 * Recursively flattens a nested object.
 * { a: { b: 1 } }  →  { "a__b": 1 }
 * Arrays are kept as-is so expandRows can handle them later.
 * Booleans are capitalised to match the expected output (True / False).
 */
function flattenObject(obj, prefix = '', result = {}) {
    for (const [key, value] of Object.entries(obj)) {
        const flatKey = prefix ? `${prefix}__${key}` : key;

        if (Array.isArray(value)) {
            // Keep arrays intact — expandRows will split them into rows
            result[flatKey] = value;
        } else if (typeof value === 'boolean') {
            // Capitalise: true → "True", false → "False"
            result[flatKey] = value ? 'True' : 'False';
        } else if (typeof value === 'object' && value !== null) {
            // Recurse into nested objects
            flattenObject(value, flatKey, result);
        } else {
            result[flatKey] = value;
        }
    }
    return result;
}

/**
 * Expands a (already-flattened) row that may contain array values into
 * multiple rows — one per array element — leaving all other columns blank
 * for the extra rows.
 *
 * Example:
 *   { id: 1, tags: ["a","b"] }
 *   →  [{ id: 1, tags: "a" }, { tags: "b" }]
 */
function expandRows(flatRow) {
    // Find the first key that holds an array
    const arrayKey = Object.keys(flatRow).find(k => Array.isArray(flatRow[k]));

    if (!arrayKey) {
        // No array fields — return the row as-is
        return [flatRow];
    }

    const arrayValues = flatRow[arrayKey];
    const rest = { ...flatRow };
    delete rest[arrayKey];

    // Detect whether the array contains objects or plain values
    const containsObjects = arrayValues.length > 0
        && typeof arrayValues[0] === 'object'
        && arrayValues[0] !== null;

    return arrayValues.map((item, index) => {
        // Build the data for this array element
        const itemData = containsObjects
            ? flattenObject(item, arrayKey)   // e.g. usuarios__id, usuarios__nombre …
            : { [arrayKey]: item };           // plain value: keep the key as-is

        if (index === 0) {
            // First row: all scalar fields + first array element
            return { ...rest, ...itemData };
        }
        // Extra rows: only the data from this array element (rest is blank)
        return { ...itemData };
    });
}

/* ── Error / success helpers ── */

function showError(message) {
    clearError();
    csvInput.value = '';

    // Reuse or create an error element
    let errorEl = document.getElementById('converter-error');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.id = 'converter-error';
        errorEl.className = 'converter__error';
        converterContainer.parentElement.insertBefore(errorEl, converterContainer.nextSibling);
    }
    errorEl.textContent = message;
    jsonInput.classList.add('converter__control--error');
}

function clearError() {
    const errorEl = document.getElementById('converter-error');
    if (errorEl) errorEl.textContent = '';
    jsonInput.classList.remove('converter__control--error');
}