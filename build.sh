#!/bin/bash

rm -rf project-finder-*.vsix

npm run compile
vsce package