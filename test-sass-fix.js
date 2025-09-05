const path = require('path');
const sass = require('sass');
const fs = require('fs');

// Test the documentation extension
console.log('Testing documentation extension SASS compilation...');

const documentationSCSSPath = path.join(__dirname, 'extensions', 'documentation', 'src', 'stylesheets', 'documentation.scss');

if (fs.existsSync(documentationSCSSPath)) {
  try {
    const result = sass.renderSync({
      file: documentationSCSSPath,
      includePaths: [
        path.join(__dirname, 'src', 'stylesheets'),
        path.join(__dirname, 'app', 'assets', 'css')
      ],
      outputStyle: 'compressed'
    });
    
    console.log('✓ Documentation extension SASS compilation successful!');
    console.log('  CSS output length:', result.css.length);
  } catch (error) {
    console.error('✗ Documentation extension SASS compilation failed:', error.message);
    if (error.formatted) {
      console.error('  Formatted error:', error.formatted);
    }
  }
} else {
  console.log('Documentation SCSS file not found at:', documentationSCSSPath);
}

// Test the collections extension
console.log('\nTesting collections extension SASS compilation...');

const collectionsSCSSPath = path.join(__dirname, 'extensions', 'collections', 'style.scss');

if (fs.existsSync(collectionsSCSSPath)) {
  try {
    const result = sass.renderSync({
      file: collectionsSCSSPath,
      includePaths: [
        path.join(__dirname, 'src', 'stylesheets'),
        path.join(__dirname, 'app', 'assets', 'css')
      ],
      outputStyle: 'compressed'
    });
    
    console.log('✓ Collections extension SASS compilation successful!');
    console.log('  CSS output length:', result.css.length);
  } catch (error) {
    console.error('✗ Collections extension SASS compilation failed:', error.message);
    if (error.formatted) {
      console.error('  Formatted error:', error.formatted);
    }
  }
} else {
  console.log('Collections SCSS file not found at:', collectionsSCSSPath);
}

// Test the issue-tracker extension
console.log('\nTesting issue-tracker extension SASS compilation...');

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