// Web Crypto API AES-GCM Encryption / Decryption Helper
// Encrypts sensitive offline data at rest (student names, marks, access tokens)

const KEY_STORAGE_KEY = 'edubridge_crypto_key';

// Retrieve or generate a persistent encryption key in the browser
async function getEncryptionKey() {
    let rawKey = localStorage.getItem(KEY_STORAGE_KEY);
    if (!rawKey) {
        // Generate a random 256-bit key
        const key = await window.crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );
        const exported = await window.crypto.subtle.exportKey('raw', key);
        rawKey = btoa(String.fromCharCode(...new Uint8Array(exported)));
        localStorage.setItem(KEY_STORAGE_KEY, rawKey);
    }

    const binaryKey = new Uint8Array(
        atob(rawKey).split('').map(char => char.charCodeAt(0))
    );

    return await window.crypto.subtle.importKey(
        'raw',
        binaryKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );
}

// Encrypt text into AES-GCM ciphertext (Base64)
export async function encryptData(plainText) {
    try {
        if (!plainText) return plainText;
        const key = await getEncryptionKey();
        const encoder = new TextEncoder();
        const data = encoder.encode(plainText);
        
        // Initialization Vector (IV) must be unique for every encryption
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        // Package IV + Encrypted Data together for decryption
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return btoa(String.fromCharCode(...combined));
    } catch (e) {
        console.error('Encryption failed:', e);
        return null;
    }
}

// Decrypt Base64 ciphertext back to plain text
export async function decryptData(cipherText) {
    try {
        if (!cipherText) return cipherText;
        const key = await getEncryptionKey();
        
        const combined = new Uint8Array(
            atob(cipherText).split('').map(char => char.charCodeAt(0))
        );

        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}
