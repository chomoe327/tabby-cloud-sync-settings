# Tabby Sync Selective

Tabby 云同步插件，支持**选择性同步** `config.yaml` 中的配置分区，避免 Mac / Windows 之间因热键、路径等平台相关设置互相覆盖。

npm 包名：**`tabby-sync-selective`**

## Fork 说明

本项目 fork 自以下仓库，并在此基础上做了功能改造：

| 上游 | 说明 |
|------|------|
| [niceit/tabby-cloud-sync-settings](https://github.com/niceit/tabby-cloud-sync-settings) | 最初版本（Tran IT） |
| [kentxxq/tabby-cloud-sync-settings](https://github.com/kentxxq/tabby-cloud-sync-settings) | 社区维护 fork（npm: `tabby-sync-kentxxq`） |

**本 fork 仓库**：[chomoe327/tabby-cloud-sync-settings](https://github.com/chomoe327/tabby-cloud-sync-settings)

### 相对上游的主要改动

- **新 npm 包** `tabby-sync-selective`，与 `tabby-sync-kentxxq` 独立安装，互不覆盖
- **选择性同步**：不再整文件覆盖 `config.yaml`，按分区 merge
  - **Cross-platform**：自动排除热键、字体、shell 路径等平台相关项
  - **Full**：整文件覆盖（适合两台相同系统）
  - **Custom**：40+ 细项自由勾选
- **手动同步增强**：Sync enabled 关闭后仍可手动 from/to cloud；同步前可临时选择模式与细项
- **WebDAV 三向 hash 对比**适配选择性同步（hash 基于参与同步的字段子集）
- **独立配置文件名**：`tabby-sync-selective-settings.json`、`tabby-sync-selective-cloud.json` 等
- **移除 winston 日志**，改用轻量文件日志，修复 Tabby 加载插件时的 `isStream is not a function` 崩溃
- **修复 WebDAV 连接测试**路径拼接问题（`location` + `test.txt` → 正确目录路径）

## 如何安装

1. 打开 Tabby → **Settings** → **Plugins**
2. 搜索 `selective` 或 `sync-selective`
3. 安装 **tabby-sync-selective** 并重启 Tabby

> **重要**
>
> - 请勿与 `tabby-sync-kentxxq` 或原版 `terminus-cloud-settings-sync` **同时启用**
> - 云端配置文件名已变更，WebDAV 等服务需在本插件内**重新配置**（服务器地址/账号可不变，路径如 `webdav/tabby` 保持不变）
> - 首次同步会在云端创建 `tabby-sync-selective-cloud.json`（与旧版 `tabby-sync-kentxxq` 的云端文件名不同）

## 选择性同步

在 **Settings → Tabby Sync Selective → General** 中可选三种模式：

| 模式 | 说明 |
|------|------|
| **Cross-platform** | 自动屏蔽平台相关项（热键、字体、shell 路径、Electron 参数等），适合 Mac ↔ Windows |
| **Full overwrite** | 整文件覆盖，适合两台相同系统 |
| **Custom** | 按细项自由勾选（主题、CSS、配色、终端行为、SSH 连接等 40+ 项） |

手动同步时同样可在对话框中临时切换模式或调整 Custom 细项。

## Sync enabled 说明

- **开启**：自动定时双向同步 + 本地配置变更自动上传
- **关闭**：停止自动同步；**手动** from/to cloud 仍可使用

## WebDAV 配置提示

| 字段 | 示例 |
|------|------|
| Host | `https://webdav.123pan.cn` |
| Port | `443` |
| Location | `webdav/tabby`（目录路径，无需末尾 `/`） |

点击 **Test Connection** 会在该目录下写入并删除 `test.txt` 以验证权限。

## 开发与发布

```bash
pnpm install
pnpm run build
pnpm publish
```

## 变更日志

### [v1.1.4] - 2026-07-06

- 修复 WebDAV 连接：`HotPatcher is not a constructor`（webdav 改为运行时依赖，不再错误打包）
- 连接失败时在界面显示具体错误信息

### [v1.1.3] - 2026-07-06

- 修复 WebDAV 测试连接路径拼接
- 更新 About 页作者与仓库链接为本 fork

### [v1.1.2] - 2026-07-06

- 移除 winston，修复插件启动崩溃
- 锁定 `is-stream@2.0.1`

### [v1.1.0] - 2026-07-06

- 新插件 `tabby-sync-selective`，选择性 merge 同步
- 手动同步分区选择对话框
- Sync enabled 关闭后仍可手动同步
