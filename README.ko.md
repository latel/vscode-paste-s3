> This is a Fork of https://github.com/Duanyll/paste-and-upload

<p align="center">
  <img src="./assets/icon.png" />
</p>

# paste-s3

[![](https://img.shields.io/badge/Visual_Studio_Marketplace-Download-blue)](https://marketplace.visualstudio.com/items?itemName=duanyll.paste-s3) [![](https://img.shields.io/badge/Open_VSX-Download-blue)](https://open-vsx.org/extension/duanyll/paste-s3) [![](https://img.shields.io/badge/GitHub-Source-blue)](https://github.com/latel/vscode-paste-s3)

이 확장 프로그램을 사용하면 클립보드(또는 파일 시스템)에서 이미지(또는 파일)를 직접 붙여넣어 S3(또는 S3 호환 엔드포인트) 버킷에 업로드한 다음, 해당 이미지(또는 파일)를 가리키는 링크를 삽입할 수 있습니다. `DocumentPaste` 및 `DocumentDrop` API를 활용하며 원격 작업 영역에서도 작동합니다. 또한 이 확장 프로그램은 MinIO와 같은 S3 호환 스토리지에 대한 경로 스타일 액세스를 위해 `forcePathStyle`을 지원합니다.

## 특징

- VS Code API를 사용하여 클립보드에서 이미지를 가져옵니다. 원격 작업 영역에서도 작동하며 별도의 단축키 없이 `Ctrl+V`를 눌러 이미지를 붙여넣기만 하면 됩니다!
  ![Paste from Snipaste](assets/snipaste.gif)
- 또는 파일 탐색기나 브라우저에서 이미지를 드래그 앤 드롭합니다.
  ![Drag and Drop from Microsoft Edge](assets/drop.gif)
- 링크 삽입을 위한 언어별 재정의 가능한 스니펫 (Markdown 및 LaTeX 기본 지원)
- 모든 S3 호환 스토리지에 이미지 업로드 (AWS S3에 제한되지 않음, 예: Aliyun OSS, Cloudflare R2 등)
- 또는 이미지를 작업 영역에 저장 ([Overleaf Workshop](https://marketplace.visualstudio.com/items?itemName=iamhyc.overleaf-workshop)과 같은 가상 작업 영역 지원)
  ![Overleaf Workshop Example](assets/overleaf.gif)
- 동일한 파일의 재업로드 방지를 위한 스마트 캐싱 (콘텐츠 해시 기반)

## 요구 사항

VS Code 1.97 이상이 필요합니다. 외부 종속성이 필요하지 않으며 모든 플랫폼 및 원격 작업 영역에서 작동합니다.

## 확장 프로그램 설정

S3에 이미지를 업로드하려면 S3 설정이 필요합니다. 사용자 설정(또는 작업 영역 설정)에서 다음과 같이 구성할 수 있습니다:

```jsonc
{
  "paste-s3.s3.region": "oss-cn-hongkong",
  // AWS S3를 사용하지 않는 경우 엔드포인트를 설정해야 합니다.
  "paste-s3.s3.endpoint": "https://oss-cn-hongkong.aliyuncs.com",
  "paste-s3.s3.accessKeyId": "YourAccessKeyId",
  "paste-s3.s3.secretAccessKey": "YourSecretAccessKey",
  "paste-s3.s3.bucket": "your-bucket-name",
  // S3 객체 키 앞에 추가됩니다 (슬래시는 그대로 유지됨)
  "paste-s3.s3.prefix": "img/",
  // 삽입된 링크 앞에 추가됩니다 (슬래시는 그대로 유지됨)
  "paste-s3.s3.publicUrlBase": "https://cdn.duanyll.com/img/",
  // S3 호환 스토리지(예: MinIO)에 대해 경로 스타일 URL 강제
  "paste-s3.s3.forcePathStyle": true
}
```

S3 자격 증명이 유출되지 않도록 사용자 설정에서 구성하는 것이 좋습니다. S3 관련 옵션을 구성한 후 `Ctrl+Shift+P`를 누르고 `paste-s3: Test S3 Connection`을 검색하여 설정을 확인할 수 있습니다.

모든 설정은 작업 영역 설정으로 재정의할 수 있습니다. `paste-s3` 섹션에 직접 속한 설정은 언어별 설정으로 재정의할 수 있습니다. 예를 들어 다음 구성은 Markdown 및 LaTeX에 대해 paste-s3를 활성화하고, Markdown의 경우 이미지를 S3에 업로드하고 LaTeX의 경우 작업 영역에 저장합니다:

```jsonc
{
  "paste-s3.enabled": false,
  // ${workspaceFolder}/figures/image.png 로 저장
  "paste-s3.workspace.path": "figures",
  // \includegraphics{image.png} 삽입 (\graphicspath{figures}가 있는 경우)
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

설정의 전체 목록은 VS Code 설정 UI에서 찾을 수 있습니다 (`paste-s3` 검색). 다음은 몇 가지 주요 설정입니다:

| 이름                                    | 설명                                      | 기본값    | Markdown 기본값                |
| --------------------------------------- | ----------------------------------------- | ---------- | ----------------------------------- |
| `paste-s3.enabled`              | 확장 프로그램 활성화 또는 비활성화         | `true`     |                                     |
| `paste-s3.uploadDestination`    | 이미지 업로드 위치                        | `s3`       |                                     |
| `paste-s3.fileNamingMethod`     | 업로드된 파일 이름 지정 방법              | `md5short` |                                     |
| `paste-s3.defaultSnippet`       | 삽입할 기본 스니펫                        | `$url`     | `[${1:$TM_SELECTED_TEXT}](${url})`  |
| `paste-s3.imageSnippet`         | 이미지용 스니펫                           | `$url`     | `![${1:$TM_SELECTED_TEXT}](${url})` |
| `paste-s3.mimeTypeFilter`       | MIME 유형별로 붙여넣은 파일을 필터링하는 정규식 | `""`       |                                     |
| `paste-s3.ignoreWorkspaceFiles` | 작업 영역에 이미 있는 파일 무시           | `true`     |                                     |

이 확장 프로그램은 기본 VS Code API를 사용하여 이미지를 붙여넣으므로, 파일 붙여넣기 및 드롭 동작과 이 확장 프로그램의 우선 순위를 제어하려면 VS Code 설정의 `Paste As` 및 `Drop` 섹션도 참조하십시오.

## FAQ

`Ctrl+Z`를 눌러 붙여넣기 작업을 실행 취소하면 작업 영역의 변경 사항은 되돌릴 수 있지만 이미지는 S3에서 삭제되지 않습니다. 이는 VS Code API의 제한 사항입니다. 우리는 `paste-s3: Undo Recent Upload` 명령을 추가하여 해결 방법을 제공합니다. 이 명령은 최근 업로드 목록을 표시하고 수동으로 선택하여 삭제할 수 있도록 합니다.

![Undo Recent Upload](assets/undo.gif)
