#!/bin/bash
# Start local Firebase emulators

firebase emulators:start --import backend/.firebase-export/ --export-on-exit backend/.firebase-export/

