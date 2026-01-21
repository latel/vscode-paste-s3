> This is a Fork of https://github.com/Duanyll/paste-and-upload

<p align="center">
  <img src="./assets/icon.png" />
</p>

# paste-s3

[![](https://img.shields.io/badge/Visual_Studio_Marketplace-Download-blue)](https://marketplace.visualstudio.com/items?itemName=duanyll.paste-s3) [![](https://img.shields.io/badge/Open_VSX-Download-blue)](https://open-vsx.org/extension/duanyll/paste-s3) [![](https://img.shields.io/badge/GitHub-Source-blue)](https://github.com/latel/vscode-paste-s3)

この拡張機能を使用すると、クリップボード（またはファイルシステム）から直接画像（またはファイル）を貼り付け、S3（またはS3互換エンドポイント）バケットにアップロードし、その画像（またはファイル）へのリンクを挿入できます。`DocumentPaste` および `DocumentDrop` API を利用しており、リモートワークスペースでも動作します。また、MinIOのようなS3互換ストレージへのパススタイルアクセスのための `forcePathStyle` もサポートしています。

## 特徴

- VS Code APIを使用してクリップボードから画像を取得します。リモートワークスペースでも動作します。余分なホットキーは不要で、`Ctrl+V`を押して画像を貼り付けるだけです！
  ![Paste from Snipaste](assets/snipaste.gif)
- または、ファイルエクスプローラーやブラウザから画像をドラッグ＆ドロップします
  ![Drag and Drop from Microsoft Edge](assets/drop.gif)
- 言語ごとにオーバーライド可能なリンク挿入用スニペット（MarkdownとLaTeXを標準サポート）
- 任意のS3互換ストレージに画像をアップロード（AWS S3に限らず、Aliyun OSS、Cloudflare R2などにも対応）
- または、画像をワークスペースに保存します（[Overleaf Workshop](https://marketplace.visualstudio.com/items?itemName=iamhyc.overleaf-workshop)のような仮想ワークスペースもサポート）
  ![Overleaf Workshop Example](assets/overleaf.gif)
- スマートキャッシングにより、同一ファイルの再アップロードを回避（コンテンツハッシュに基づく）

## 要件

VS Code 1.97以降が必要です。外部依存関係は不要で、すべてのプラットフォームとリモートワークスペースで動作します。

## 拡張機能の設定

S3に画像をアップロードする場合、S3の設定が必要です。ユーザー設定（またはワークスペース設定）で次のように設定できます：

```jsonc
{
  "paste-s3.s3.region": "oss-cn-hongkong",
  // AWS S3を使用していない場合は、エンドポイントを設定する必要があります
  "paste-s3.s3.endpoint": "https://oss-cn-hongkong.aliyuncs.com",
  "paste-s3.s3.accessKeyId": "YourAccessKeyId",
  "paste-s3.s3.secretAccessKey": "YourSecretAccessKey",
  "paste-s3.s3.bucket": "your-bucket-name",
  // S3オブジェクトキーの前に付加されます（スラッシュはそのまま保持されます）
  "paste-s3.s3.prefix": "img/",
  // 挿入されるリンクの前に付加されます（スラッシュはそのまま保持されます）
  "paste-s3.s3.publicUrlBase": "https://cdn.duanyll.com/img/",
  // S3互換ストレージ（例：MinIO）のためにパススタイルURLを強制します
  "paste-s3.s3.forcePathStyle": true
}
```

漏洩を防ぐため、S3の認証情報はユーザー設定で構成することをお勧めします。S3関連のオプションを設定した後、`Ctrl+Shift+P`を押して「paste-s3: Test S3 Connection」を検索し、設定を確認できます。

すべての設定はワークスペース設定で上書き可能です。`paste-s3`セクションに直接属する設定は、言語固有の設定で上書きできます。例えば、次の構成ではMarkdownとLaTeXでpaste-s3を有効にし、Markdownの場合はS3に画像をアップロードし、LaTeXの場合は画像をワークスペースに保存します：

```jsonc
{
  "paste-s3.enabled": false,
  // ${workspaceFolder}/figures/image.png として保存
  "paste-s3.workspace.path": "figures",
  // \includegraphics{image.png} を挿入（\graphicspath{figures}がある場合）
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

設定の完全なリストはVS Codeの設定UIで見つけることができます（`paste-s3`を検索）。以下はいくつかの主要な設定です：

| 名前                                    | 説明                                      | デフォルト    | Markdownのデフォルト                |
| --------------------------------------- | ----------------------------------------- | ---------- | ----------------------------------- |
| `paste-s3.enabled`              | 拡張機能を有効または無効にする             | `true`     |                                     |
| `paste-s3.uploadDestination`    | 画像のアップロード先                      | `s3`       |                                     |
| `paste-s3.fileNamingMethod`     | アップロードファイルの命名方法             | `md5short` |                                     |
| `paste-s3.defaultSnippet`       | 挿入するデフォルトのスニペット             | `$url`     | `[${1:$TM_SELECTED_TEXT}](${url})`  |
| `paste-s3.imageSnippet`         | 画像用スニペット                          | `$url`     | `![${1:$TM_SELECTED_TEXT}](${url})` |
| `paste-s3.mimeTypeFilter`       | 貼り付けられたファイルをMIMEタイプでフィルタリングする正規表現 | `""`       |                                     |
| `paste-s3.ignoreWorkspaceFiles` | ワークスペース内のファイルを無視          | `true`     |                                     |

この拡張機能は画像を貼り付けるためにネイティブのVS Code APIを利用しています。ファイルの貼り付けやドロップの動作、およびこの拡張機能の優先順位を制御するには、VS Code設定の「貼り付け」および「ドロップ」セクションも参照してください。

## FAQ

`Ctrl+Z`を押して貼り付け操作を取り消すと、ワークスペースの変更は元に戻りますが、画像はS3から削除されません。これはVS Code APIの制限です。回避策として、「paste-s3: Undo Recent Upload」コマンドを提供しており、最近のアップロード一覧を表示して手動で選択して削除できるようにしています。

![Undo Recent Upload](assets/undo.gif)
