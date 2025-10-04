#!/bin/bash

echo "Fetching all erik remotes for submodules..."

git submodule foreach '
  if git remote | grep -q erik; then
    echo "Fetching erik remote for $name"
    git fetch erik || echo "Failed to fetch erik for $name"
  else
    echo "No erik remote for $name"
  fi
'

echo "All erik remotes fetched. Now running sweep..."
yarn sweep:all