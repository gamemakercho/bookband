// 행사에 맞게 이 파일과 layout.json을 수정하세요.
export const CONFIG = {
  gameId: 'library-bookband-reshelve-v2',
  storageKey: 'bookband:library-bookband-reshelve-v2:v1',
  correctOrder: ['000','100','200','300','400','500','600','700','800','900'],
  dragThresholdCss: 7,
  completionDelayMs: 1400,
  nextUrl: '',
  // (detail) => { ... } 또는 window.onGameComplete(detail)로 연결합니다.
  onGameComplete: null,
  text: {
    title: '책을 올바른 순서로 제자리에!',
    subtitle: '실제 서가의 책띠를 살펴보세요',
    sign: '신간도서 코너',
    start: '사서가 어지른 책을 정리해 주세요! 실제 서가의 책띠를 살펴보고, 책 10권을 왼쪽부터 올바른 순서로 꽂아 주세요.',
    footer: '끌어서 꽂기 · 두 권을 누르면 자리 바꾸기',
    incorrect: '아직 순서가 맞지 않아요',
    complete: '클리어!'
  }
};
