> This is a Fork of https://github.com/Duanyll/paste-and-upload

<p align="center">
  <img src="./assets/icon.png" />
</p>

# paste-s3

[![](https://img.shields.io/badge/Visual_Studio_Marketplace-Download-blue)](https://marketplace.visualstudio.com/items?itemName=duanyll.paste-s3) [![](https://img.shields.io/badge/Open_VSX-Download-blue)](https://open-vsx.org/extension/duanyll/paste-s3) [![](https://img.shields.io/badge/GitHub-Source-blue)](https://github.com/latel/vscode-paste-s3)

이 확장 프로그램을 사용하면 클립보드(또는 파일 시스템)에서 이미지(또는 파일)를 직접 붙여넣어 S3(또는 S3 호환 엔드포인트) 버킷에 업로드한 다음, 해당 이미지(또는 파일)를 가리키는 링크를 삽입할 수 있습니다. `DocumentPaste` 및 `DocumentDrop` API를 활용하며 원격 작업 영역에서도 작동합니다. 또한 이 확장 프로그램은 MinIO와 같은 S3 호환 스토리지에 대한 경로 스타일 액세스를 위해 `forcePathStyle`을 지원합니다.

## Features

- Fetch images from clipboard with VS Code API, even in remote workspaces. No extra hotkeys required, simply press `Ctrl+V` to paste images!
  ![Paste from Snipaste](assets/snipaste.gif)
- Or drag and drop images from your file explorer or browser
  ![Drag and Drop from Microsoft Edge](assets/drop.gif)
- Language overridable snippets for inserting links (Built-in support for Markdown and LaTeX)
- Upload images to any S3-compatible storage (Not limited to AWS S3, e.g. Aliyun OSS, Cloudflare R2, etc.)
- Or save images to your workspace (Supports virtual workspaces like [Overleaf Workshop](https://marketplace.visualstudio.com/items?itemName=iamhyc.overleaf-workshop))
  ![Overleaf Workshop Example](assets/overleaf.gif)
- Smart caching to avoid re-uploading identical files (based on content hash)

## Requirements

Need VS Code 1.97 or later. No external dependencies are required, works across all platforms and remote workspaces.

## Extension Settings

The S3 settings are required if you want to upload images to S3. You can configure them in your user settings (or workspace settings) like this:

```jsonc
{
  "paste-s3.s3.region": "oss-cn-hongkong",
  // If you are not using AWS S3, you need to set the endpoint
  "paste-s3.s3.endpoint": "https://oss-cn-hongkong.aliyuncs.com",
  "paste-s3.s3.accessKeyId": "YourAccessKeyId",
  "paste-s3.s3.secretAccessKey": "YourSecretAccessKey",
  "paste-s3.s3.bucket": "your-bucket-name",
  // Will be prepended to S3 object key (Slashes will be preserved as is)
  "paste-s3.s3.prefix": "img/",
  // Will be prepended to inserted link (Slashes will be preserved as is)
  "paste-s3.s3.publicUrlBase": "https://cdn.duanyll.com/img/",
  // Force path style URLs for S3-compatible storage (e.g., MinIO)
  "paste-s3.s3.forcePathStyle": true
}
```

It is recommended to configure S3 credentials in your user settings to avoid leaking them. After configuring S3 related options, you can press `Ctrl+Shift+P` and search for `paste-s3: Test S3 Connection` to verify your settings.

All settings are overridable by workspace settings. Settings directly belonging to `paste-s3` section can be overriden by language-specific settings. For example, the following configuration will enable paste-s3 for Markdown and LaTeX, and upload images to S3 for Markdown and save images to workspace for LaTeX:

```jsonc
{
  "paste-s3.enabled": false,
  // Save as ${workspaceFolder}/figures/image.png
  "paste-s3.workspace.path": "figures",
  // Insert \includegraphics{image.png} (If you have \graphicspath{figures})
  "paste-s3.workspace.linkBase": "",
  "[markdown]": {
    "paste-s3.enabled": true,
    "paste-s3.uploadDestination": "s3"
  },
  "[latex]": {
    "paste-s3.enabled": true,
    "paste-s3.uploadDestination": "workspace"
  }
}
```

A full list of settings can be found in the VS Code settings UI (search for `paste-s3`). Here are some notable settings:

| Name                                    | Description                               | Default    | Default for Markdown                |
| --------------------------------------- | ----------------------------------------- | ---------- | ----------------------------------- |
| `paste-s3.enabled`              | Enable or disable the extension           | `true`     |                                     |
| `paste-s3.uploadDestination`    | Where to upload images to                 | `s3`       |                                     |
| `paste-s3.fileNamingMethod`     | How to name the uploaded files            | `md5short` |                                     |
| `paste-s3.defaultSnippet`       | The default snippet to insert             | `$url`     | `[${1:$TM_SELECTED_TEXT}](${url})`  |
| `paste-s3.imageSnippet`         | The snippet for images                    | `$url`     | `![${1:$TM_SELECTED_TEXT}](${url})` |
| `paste-s3.mimeTypeFilter`       | Regex to filter pasted files by MIME type | `""`       |                                     |
| `paste-s3.ignoreWorkspaceFiles` | Ignore files already in workspace         | `true`     |                                     |

This extension utilizes the native VS Code API to paste images, please also refer to the `Paste As` and `Drop` sections in the VS Code settings to control the behavior of pasting and dropping files, and the priority of this extension.

## FAQ

Undoing paste operation by pressing `Ctrl+Z` can revert changes in the workspace, but the images are not deleted from S3. This is a limitation of VS Code API. We provide a workaround by adding a `paste-s3: Undo Recent Upload` command, which will show a list of recent uploads and allow you to manually select and delete them.

![Undo Recent Upload](assets/undo.gif)
