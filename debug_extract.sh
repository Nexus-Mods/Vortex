#!/usr/bin/env bash

extract_owner_from_url() {
  local url="$1"
  local owner=""
  # Handle both SSH and HTTPS GitHub URLs
  if [[ "$url" =~ git@github\.com:([^/]+)/ ]]; then 
    owner="${BASH_REMATCH[1]}"
  elif [[ "$url" =~ https://github\.com/([^/]+)/ ]]; then 
    owner="${BASH_REMATCH[1]}"
  fi
  echo "$owner"
}

# Test the function
url="https://github.com/Nexus-Mods/extension-changelog-dashlet.git"
result=$(extract_owner_from_url "$url")
echo "URL: $url"
echo "Result: '$result'"
echo "Length: ${#result}"