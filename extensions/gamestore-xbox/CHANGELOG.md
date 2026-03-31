# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.2.3] - 2023-12-11

- Fixed crash when attempting to detect xbox manifests during game installation and/or when xbox game store did not clear the game folders correctly.

## [0.2.2] - 2023-12-11

- Fixed file system error dialog being raised for encrypted drives

## [0.2.1] - 2023-11-15

- Fixed crash if the xbox custom directory has been deleted
- Improved error handling
- Improved path validation for the xbox custom directory


## [0.2.0] - 2023-11-10

- Fixed xbox game discovery - now using .GamingRoot to find moddable game paths
