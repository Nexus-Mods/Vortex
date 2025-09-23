#!/bin/bash

# Test URL
test_url="https://github.com/Nexus-Mods/extension-changelog-dashlet.git"

echo "Testing URL: $test_url"
echo "URL length: ${#test_url}"

# Test pattern 1 (SSH)
if [[ "$test_url" =~ git@github\.com:([^/]+)/ ]]; then 
  echo "SSH pattern matched: ${BASH_REMATCH[1]}"
else
  echo "SSH pattern did not match"
fi

# Test pattern 2 (HTTPS)
if [[ "$test_url" =~ https://github\.com/([^/]+)/ ]]; then 
  echo "HTTPS pattern matched: ${BASH_REMATCH[1]}"
else
  echo "HTTPS pattern did not match"
fi

# Test the exact logic from the script
owner=""
if [[ "$test_url" =~ git@github\.com:([^/]+)/ ]]; then 
  owner="${BASH_REMATCH[1]}"
elif [[ "$test_url" =~ https://github\.com/([^/]+)/ ]]; then 
  owner="${BASH_REMATCH[1]}"
fi

echo "Final owner: '$owner'"
echo "Owner length: ${#owner}"

# Test if owner is empty
if [ -z "$owner" ]; then
  echo "Owner is empty!"
else
  echo "Owner is not empty: '$owner'"
fi