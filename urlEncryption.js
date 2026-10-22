const crypto = require("crypto");
const fs = require("fs");

const queryParameter = "q";
const ivLength = 12;
const authenticationTagLength = 16;

function resolveEncryptionSecret(secret, options = {}) {
    if (typeof secret === "string" && secret.length > 0) {
        return secret;
    }

    if (options.isProduction) {
        throw new Error("Configure URL_ENCRYPTION_KEY with a randomly generated value of at least 32 bytes.");
    }
    if (typeof options.keyFilePath !== "string" || options.keyFilePath.length === 0) {
        throw new Error("A key file path is required to generate a development URL encryption key.");
    }

    try {
        return fs.readFileSync(options.keyFilePath, "utf8").trim();
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }

    const generatedSecret = crypto.randomBytes(32).toString("hex");
    try {
        fs.writeFileSync(options.keyFilePath, generatedSecret, { encoding: "utf8", flag: "wx", mode: 0o600 });
        return generatedSecret;
    } catch (error) {
        if (error.code !== "EEXIST") throw error;
        return fs.readFileSync(options.keyFilePath, "utf8").trim();
    }
}

function createUrlEncryption(secret) {
    if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
        throw new Error("Configure URL_ENCRYPTION_KEY with at least 32 bytes.");
    }

    const key = crypto.createHash("sha256").update(secret, "utf8").digest();

    function encryptQuery(query) {
        const parameters = new URLSearchParams();
        for (const [name, value] of Object.entries(query)) {
            if (Array.isArray(value)) {
                value.forEach((item) => parameters.append(name, String(item)));
            } else if (value !== undefined && value !== null) {
                parameters.append(name, String(value));
            }
        }

        const iv = crypto.randomBytes(ivLength);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const ciphertext = Buffer.concat([
            cipher.update(parameters.toString(), "utf8"),
            cipher.final()
        ]);
        return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
    }

    function decryptQuery(token) {
        if (typeof token !== "string" || !/^[A-Za-z0-9_-]+$/.test(token)) {
            throw new Error("Invalid encrypted query.");
        }

        const payload = Buffer.from(token, "base64url");
        if (payload.length < ivLength + authenticationTagLength ||
            payload.toString("base64url") !== token) {
            throw new Error("Invalid encrypted query.");
        }

        const iv = payload.subarray(0, ivLength);
        const authenticationTag = payload.subarray(ivLength, ivLength + authenticationTagLength);
        const ciphertext = payload.subarray(ivLength + authenticationTagLength);
        const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authenticationTag);
        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]).toString("utf8");

        const query = {};
        for (const [name, value] of new URLSearchParams(plaintext)) {
            if (Object.prototype.hasOwnProperty.call(query, name)) {
                query[name] = [].concat(query[name], value);
            } else {
                query[name] = value;
            }
        }
        return query;
    }

    function decodeHtmlEntities(value) {
        return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|#39);/gi, (entity, code) => {
            if (code[0] === "#") {
                const number = code[1].toLowerCase() === "x"
                    ? parseInt(code.slice(2), 16)
                    : parseInt(code.slice(1), 10);
                return Number.isInteger(number) && number >= 0 && number <= 0x10ffff
                    ? String.fromCodePoint(number)
                    : "\uFFFD";
            }
            return {
                amp: "&",
                lt: "<",
                gt: ">",
                quot: "\"",
                "#39": "'"
            }[code.toLowerCase()];
        });
    }

    function decodeQueryPart(value) {
        try {
            return decodeURIComponent(value.replace(/\+/g, " "));
        } catch (error) {
            return value;
        }
    }

    function encryptRenderedQuery(queryString) {
        const query = {};
        const parts = decodeHtmlEntities(queryString).split("&");
        for (const part of parts) {
            if (!part) continue;
            const separator = part.indexOf("=");
            const name = decodeQueryPart(
                separator === -1 ? part : part.slice(0, separator)
            );
            const value = decodeQueryPart(
                separator === -1 ? "" : part.slice(separator + 1)
            );
            if (Object.prototype.hasOwnProperty.call(query, name)) {
                query[name] = [].concat(query[name], value);
            } else {
                query[name] = value;
            }
        }
        return encryptQuery(query);
    }

    function encryptHtmlLinks(html) {
        return html
            .replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])\?([^"']*)\2/gi,
                (match, prefix, quote, queryString) =>
                    `${prefix}${quote}?${queryParameter}=${encryptRenderedQuery(queryString)}${quote}`)
            .replace(/<form\b[^>]*>/gi, (tag) => {
                const attributes = tag
                    .replace(/\s+(?:action|method)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
                    .replace(/\/?>$/, "");
                return `${attributes} action="/" method="post">`;
            });
    }

    return { encryptQuery, decryptQuery, encryptHtmlLinks };
}

module.exports = { createUrlEncryption, queryParameter, resolveEncryptionSecret };
