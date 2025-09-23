#!/bin/bash

echo "Testing sed in submodule context..."

git submodule foreach --quiet '
  echo "=== Testing in $name ($path) ==="
  push_url=$(git remote get-url origin)
  echo "URL: $push_url"
  
  # Test different approaches
  echo "Approach 1 - sed with https pattern:"
  owner1=$(echo "$push_url" | sed -n "s|https://github\.com/\([^/]*\)/.*|\1|p")
  echo "Result: \"$owner1\""
  
  echo "Approach 2 - sed with simpler pattern:"
  owner2=$(echo "$push_url" | sed "s|https://github.com/||" | sed "s|/.*||")
  echo "Result: \"$owner2\""
  
  echo "Approach 3 - cut approach:"
  owner3=$(echo "$push_url" | cut -d/ -f4)
  echo "Result: \"$owner3\""
  
  echo "Approach 4 - parameter expansion:"
  temp="${push_url#https://github.com/}"
  owner4="${temp%%/*}"
  echo "Result: \"$owner4\""
  
  echo ""
'