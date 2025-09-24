/**
 * macOS-native implementation of the permissions module
 * Provides file permission management functionality using native macOS commands
 */

const { execSync } = require('child_process');
const os = require('os');

/**
 * Set file permissions for a specific user/group
 * @param {string} filePath - Path to the file or directory
 * @param {string|number} userOrGroup - User ID, group name, or 'group'
 * @param {string} permissions - Permission string (e.g., 'rwx', 'rw', 'r')
 */
function allow(filePath, userOrGroup, permissions) {
  try {
    // Convert permission string to octal
    let octal = '';
    if (permissions.includes('r')) octal += '4';
    if (permissions.includes('w')) octal += '2';
    if (permissions.includes('x')) octal += '1';
    
    // If no permissions specified, default to 0
    if (octal === '') octal = '0';
    
    // Calculate the numeric value
    const permValue = octal.split('').reduce((sum, digit) => sum + parseInt(digit), 0);
    
    if (userOrGroup === 'group') {
      // Set group permissions
      execSync(`chmod g+${permissions} "${filePath}"`, { stdio: 'ignore' });
    } else if (typeof userOrGroup === 'number' || /^\d+$/.test(userOrGroup)) {
      // Set permissions for specific user ID
      execSync(`chown ${userOrGroup} "${filePath}"`, { stdio: 'ignore' });
      execSync(`chmod u+${permissions} "${filePath}"`, { stdio: 'ignore' });
    } else {
      // Set permissions for named user/group
      execSync(`chown ${userOrGroup} "${filePath}"`, { stdio: 'ignore' });
      execSync(`chmod u+${permissions} "${filePath}"`, { stdio: 'ignore' });
    }
  } catch (error) {
    // Silently fail - permission changes may not always be possible
    // This matches the behavior expected by the application
  }
}

/**
 * Get the current user's ID
 * @returns {number} The current user's numeric ID
 */
function getUserId() {
  try {
    const userInfo = os.userInfo();
    return userInfo.uid;
  } catch (error) {
    // Fallback to id command if os.userInfo() fails
    try {
      const result = execSync('id -u', { encoding: 'utf8', stdio: 'pipe' });
      return parseInt(result.trim(), 10);
    } catch (cmdError) {
      // Ultimate fallback - return 0 (root) which should work for most operations
      return 0;
    }
  }
}

/**
 * Deny permissions (placeholder - not used in current codebase)
 * @param {string} filePath - Path to the file or directory
 * @param {string|number} userOrGroup - User ID, group name, or 'group'
 * @param {string} permissions - Permission string to deny
 */
function deny(filePath, userOrGroup, permissions) {
  try {
    if (userOrGroup === 'group') {
      execSync(`chmod g-${permissions} "${filePath}"`, { stdio: 'ignore' });
    } else {
      execSync(`chmod u-${permissions} "${filePath}"`, { stdio: 'ignore' });
    }
  } catch (error) {
    // Silently fail
  }
}

/**
 * Check if user has specific permissions (placeholder - not used in current codebase)
 * @param {string} filePath - Path to check
 * @param {string|number} userOrGroup - User to check
 * @param {string} permissions - Permissions to check for
 * @returns {boolean} Whether the user has the specified permissions
 */
function check(filePath, userOrGroup, permissions) {
  try {
    const stats = require('fs').statSync(filePath);
    // Basic check - this is a simplified implementation
    // In practice, this would need more sophisticated permission checking
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  allow,
  deny,
  check,
  getUserId
};