# 책을 올바른 순서로 제자리에!

책 10권을 북카트에서 집어 서가에 꽂는 모바일 웹 게임입니다. 서버 API, 로그인, 외부 폰트, 별도 빌드 또는 패키지 설치가 필요하지 않습니다.

## 저장소 파일

`index.html`이 저장소 최상위에 있습니다. 이 폴더의 내용 전체를 GitHub Desktop으로 관리하는 저장소에 넣고 커밋·푸시하면 됩니다. 숨김 파일 `.gitignore`와 `.nojekyll`도 함께 포함하세요. 기존 저장소라면 그 저장소 폴더에 이 폴더의 내용물을 복사하세요.

```
index.html
style.css
game.js
config.js
state.js
geometry.js
assets-loader.js
layout.json
assets/
README.md
.gitignore
.nojekyll
```

이미지·좌표 경로가 모두 상대 경로이므로 저장소 이름이 붙는 하위 경로에서도 사용할 수 있습니다. GitHub에 파일을 올리는 것과 웹 호스팅을 활성화하는 것은 별도입니다.

## 로컬 실행

이 폴더에서 `python -m http.server 8000`을 실행하고 `http://localhost:8000`을 여세요. HTML 더블클릭은 ES 모듈과 JSON 로딩 때문에 지원하지 않습니다.

## 조작

- 책을 끌어 빈자리에 놓거나, 책과 빈자리를 차례로 누릅니다.
- 서가의 두 책을 차례로 누르면 자리를 교환합니다.
- 책을 카트로 끌어 돌려놓을 수 있습니다.
- 같은 책이나 배경을 누르면 선택을 취소합니다.
- 모든 책을 올바르게 꽂으면 자동으로 클리어합니다.
- 진행 상태를 저장하며 ‘다시 시작’으로 초기화합니다.

## 설정 및 완료 연결

`config.js`에서 문구, gameId, storageKey, 정답 배열, 완료 연출 시간과 nextUrl을 수정하세요. gameId를 바꾸면 저장 키도 바꾸세요. 배치는 `layout.json`에서 수정합니다.

완료 연출 후 다음 이벤트를 한 번 발생시킵니다. 완료 상태를 복원할 때는 다시 발생시키지 않습니다.

```js
window.addEventListener('bookband:complete', ({ detail }) => {
  // detail: { gameId, status: 'complete', complete: true }
});
```

또는 `CONFIG.onGameComplete`에 함수를 지정합니다. nextUrl을 비워 두면 완료 화면에 머뭅니다.

## 에셋 및 검증

정상 실행은 WebP 4장만 로드합니다. PNG 4장은 WebP 로드 실패 시 대체용이므로 assets 폴더에 함께 보관합니다. 초기 파일 원본 합계는 2,998,243바이트(약 3.00MB)입니다.

모의 입력 검사 41개와 무작위 이동 20,000회 검증을 통과했습니다. 실제 모바일 브라우저 및 기기 터치 검증은 아직 완료하지 못했습니다.
