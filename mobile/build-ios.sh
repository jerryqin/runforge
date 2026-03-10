#!/bin/bash

# Apple Health 集成 iOS 构建脚本

set -e

echo "🔨 开始构建 RunForge iOS App"
echo "════════════════════════════"

cd "$(dirname "$0")"

# 清理旧构建
echo "🧹 清理旧构建..."
rm -rf ~/Library/Developer/Xcode/DerivedData/RunForge-*
rm -rf ios/build

# Prebuild
echo "📦 运行 Prebuild..."
npx expo prebuild --clean

# Pod 安装
echo "📚 安装 CocoaPods..."
cd ios
pod install --repo-update
cd ..

# 用 Xcode 命令行构建
echo "🏗️  使用 xcodebuild 构建..."
cd ios
xcodebuild build \
  -workspace RunForge.xcworkspace \
  -scheme RunForge \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO

echo "✅ 构建完成！"
echo ""
echo "可选方案："
echo "1️⃣  用 Xcode 打开项目:"
echo "   open RunForge.xcworkspace"
echo ""
echo "2️⃣  在 Xcode 中选择设备后按 Cmd+R 运行"
