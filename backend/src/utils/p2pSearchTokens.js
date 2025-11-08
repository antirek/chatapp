import Chat3Client from '../services/Chat3Client.js';

function sanitizeToken(token) {
  if (!token) return null;
  const normalized = token.toString().trim().toLowerCase();
  return normalized.length ? normalized : null;
}

function addToken(tokens, token) {
  const sanitized = sanitizeToken(token);
  if (sanitized) {
    tokens.add(sanitized);
  }
}

function extractNameTokens(name) {
  if (!name) return [];
  const normalized = name.toString().toLowerCase();
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return normalized.length ? [normalized] : [];
  }
  return Array.from(new Set([normalized, ...parts]));
}

function extractPhoneTokens(phone) {
  if (!phone) return [];
  const raw = phone.toString();
  const digitsOnly = raw.replace(/\D+/g, '');
  const tokens = new Set();
  addToken(tokens, raw);
  if (digitsOnly.length) {
    addToken(tokens, digitsOnly);
    if (digitsOnly.startsWith('7') && digitsOnly.length === 11) {
      addToken(tokens, `+${digitsOnly}`);
    }
  }
  return Array.from(tokens);
}

async function fetchUser(userId) {
  const response = await Chat3Client.getUser(userId);
  return response.data || response;
}

export async function buildP2PSearchTokens(userIdA, userIdB) {
  const users = await Promise.all([userIdA, userIdB].map(fetchUser));
  const tokens = new Set();

  users.forEach((user) => {
    addToken(tokens, user.userId);
    addToken(tokens, user.name);
    extractNameTokens(user.name).forEach((token) => addToken(tokens, token));
    extractPhoneTokens(user.phone).forEach((token) => addToken(tokens, token));

    const meta = user.meta || {};
    if (meta.displayName) {
      extractNameTokens(meta.displayName).forEach((token) => addToken(tokens, token));
    }
    if (meta.firstName) addToken(tokens, meta.firstName);
    if (meta.lastName) addToken(tokens, meta.lastName);
    if (meta.middleName) addToken(tokens, meta.middleName);
    if (meta.phone) {
      extractPhoneTokens(meta.phone).forEach((token) => addToken(tokens, token));
    }
    if (meta.searchTokens) {
      const metaTokens = Array.isArray(meta.searchTokens)
        ? meta.searchTokens
        : meta.searchTokens.toString().split(/\s+/);
      metaTokens.forEach((token) => addToken(tokens, token));
    }
  });

  return Array.from(tokens).join(' ');
}

export async function updateP2PSearchTokens(dialogId, userIdA, userIdB) {
  try {
    const tokenString = await buildP2PSearchTokens(userIdA, userIdB);

    if (!tokenString) {
      console.warn(`⚠️ No search tokens generated for dialog ${dialogId}`);
      return;
    }

    await Chat3Client.setMeta('dialog', dialogId, 'searchTokens', { value: tokenString });
    console.log(`✅ Updated search tokens for dialog ${dialogId}`);
  } catch (error) {
    console.error(`❌ Failed to update search tokens for dialog ${dialogId}:`, error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
  }
}

