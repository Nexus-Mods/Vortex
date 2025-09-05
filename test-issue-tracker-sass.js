const path = require('path');
const sass = require('sass');
const fs = require('fs');

// Test the issue-tracker extension
console.log('Testing issue-tracker extension SASS compilation...');

const issueTrackerSCSSPath = path.join(__dirname, 'extensions', 'issue-tracker', 'src', 'issue_tracker.scss');

if (fs.existsSync(issueTrackerSCSSPath)) {
  try {
    const result = sass.renderSync({
      file: issueTrackerSCSSPath,
      includePaths: [
        path.join(__dirname, 'src', 'stylesheets'),
        path.join(__dirname, 'app', 'assets', 'css')
      ],
      outputStyle: 'compressed'
    });
    
    console.log('✓ Issue-tracker extension SASS compilation successful!');
    console.log('  CSS output length:', result.css.length);
  } catch (error) {
    console.error('✗ Issue-tracker extension SASS compilation failed:', error.message);
    if (error.formatted) {
      console.error('  Formatted error:', error.formatted);
    }
  }
} else {
  console.log('Issue-tracker SCSS file not found at:', issueTrackerSCSSPath);
}