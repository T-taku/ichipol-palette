const FRAME_ID = 'hcu-rc-frame';

export function mountSettingsFrame(src: string): void {
  if (document.getElementById(FRAME_ID)) return;
  const host = document.createElement('div');
  host.id = FRAME_ID;
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'right:0',
    'bottom:0',
    'left:0',
    'width:100vw',
    'height:100vh',
    'margin:0',
    'padding:0',
    'border:0',
    'background:transparent',
    'z-index:2147483646',
  ].join(';');
  const frame = document.createElement('iframe');
  frame.title = '履修パレットの設定';
  frame.src = src;
  frame.style.cssText = [
    'display:block',
    'width:100%',
    'height:100%',
    'border:0',
    'margin:0',
    'background:transparent',
  ].join(';');
  host.append(frame);
  document.documentElement.append(host);
}

export function unmountSettingsFrame(): void {
  document.getElementById(FRAME_ID)?.remove();
}
