#!/usr/bin/env bash
# Installs the APK on the running emulator, launches it, and prints crash diagnostics.
set -u
APK="$1"
PKG=com.bayone.garage
adb wait-for-device
adb install -r "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity"
sleep 40
mkdir -p smoke
adb logcat -d -v time > smoke/logcat.txt
adb exec-out screencap -p > smoke/screen.png || true
echo "===== PROCESS ====="
adb shell pidof "$PKG" && echo "app is running" || echo "app is NOT running"
echo "===== CRASH LINES ====="
grep -E "FATAL|AndroidRuntime|ReactNativeJS|ReactNative|Hermes|libc.*Fatal|DEBUG  :|SoLoader|expo|Exception|Error" smoke/logcat.txt | grep -v "GoogleApiManager\|chatty" | head -300
echo "===== END ====="
