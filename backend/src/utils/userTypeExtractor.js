/**
 * Extract user type from userId for routing key generation
 * 
 * Format: user.{type}.{userId}.{updateType}
 * 
 * Type is extracted from prefix before first underscore:
 * - usr_123 → usr
 * - cnt_456 → cnt
 * - bot_789 → bot
 * - carl (no prefix) → usr (default)
 * 
 * @param {string} userId - User ID (e.g., usr_abc123, cnt_xyz789, bot_def456, carl)
 * @returns {string} - User type (usr, cnt, bot, etc.)
 */
export function extractUserType(userId) {
  if (!userId || typeof userId !== 'string') {
    return 'usr'; // Default to 'usr' if invalid
  }
  
  const underscoreIndex = userId.indexOf('_');
  
  // If no underscore, default to 'usr'
  if (underscoreIndex === -1) {
    return 'usr';
  }
  
  // Extract prefix before first underscore
  return userId.substring(0, underscoreIndex);
}

/**
 * Generate routing key for user updates
 * 
 * @param {string} userId - User ID
 * @param {string} updateType - Update type (optional, defaults to '*')
 * @returns {string} - Routing key (e.g., user.usr.usr_123.*)
 */
export function generateUserRoutingKey(userId, updateType = '*') {
  const userType = extractUserType(userId);
  return `user.${userType}.${userId}.${updateType}`;
}

/**
 * Generate routing key pattern for all users of a specific type
 * 
 * @param {string} userType - User type (usr, cnt, bot, etc.)
 * @returns {string} - Routing key pattern (e.g., user.cnt.#)
 */
export function generateTypeRoutingKey(userType) {
  // Use # to match all remaining words in topic exchange
  return `user.${userType}.#`;
}

/**
 * Generate routing key pattern for all users of all types
 * 
 * @returns {string} - Routing key pattern (e.g., user.#)
 */
export function generateAllUsersRoutingKey() {
  // Use # to match all remaining words in topic exchange
  return 'user.#';
}

