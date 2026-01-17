# VSCode 扩展市场发布流水线

本 PR 添加了 GitHub Actions 工作流程，用于自动化 CI/CD 流程，实现一键发布到 VSCode 扩展市场。

## 新增文件

### 1. CI 工作流 (`.github/workflows/ci.yml`)

**触发条件：**
- 推送到 `master` 或 `main` 分支
- 创建 Pull Request 时

**功能：**
- 安装依赖（使用 pnpm）
- 运行代码检查（linter）
- 构建扩展
- 运行测试（在无头环境中）
- 上传构建产物

### 2. 发布工作流 (`.github/workflows/release.yml`)

**触发条件：**
- 发布 GitHub Release 时自动触发
- 可通过手动触发（workflow dispatch）

**功能：**
- 完整的 CI 流程（检查、构建、测试）
- 打包扩展为 VSIX 文件
- 发布到 VSCode 扩展市场（使用 `VSCE_TOKEN`）
- 可选发布到 Open VSX Registry（使用 `OVSX_TOKEN`）
- 上传 VSIX 文件作为产物

### 3. 详细文档 (`.github/workflows/README.md`)

包含完整的设置和使用说明：
- 如何配置所需的 Secret（VSCE_TOKEN、OVSX_TOKEN）
- 如何发布新版本
- 故障排除指南
- 本地测试说明

## 使用方法

### 配置 Secrets

在 GitHub 仓库设置中添加以下 secrets：

1. **VSCE_TOKEN**（必需）
   - 用于发布到 VSCode 扩展市场
   - 获取方式见 `.github/workflows/README.md`

2. **OVSX_TOKEN**（可选）
   - 用于发布到 Open VSX Registry
   - 获取方式见 `.github/workflows/README.md`

### 发布新版本

**方法 1：通过 GitHub Release（推荐）**

1. 更新 `package.json` 中的版本号
2. 创建并推送 tag：
   ```bash
   git tag v0.x.x
   git push origin v0.x.x
   ```
3. 在 GitHub 上创建 Release
4. 工作流将自动运行并发布扩展

**方法 2：手动触发**

1. 进入 Actions → "Publish to VSCode Marketplace"
2. 点击 "Run workflow"
3. 选择分支并运行

## 技术特性

- ✅ 使用最新的 GitHub Actions（v4）
- ✅ 使用 pnpm 缓存加速构建
- ✅ 使用 frozen lockfile 确保可重现构建
- ✅ 在无头环境中运行测试（xvfb）
- ✅ 优雅处理可选的 Open VSX 发布
- ✅ 遵循安全最佳实践（显式权限设置）
- ✅ 提供构建产物用于调试

## 安全性

- 所有工作流都已添加显式权限限制
- 通过 CodeQL 安全扫描（0 个告警）
- 敏感信息通过 GitHub Secrets 管理

## 测试

工作流 YAML 文件已通过语法验证，所有引用的脚本在 `package.json` 中均已定义。
