import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { applyColoring } from '../content/apply';
import { createCourseCache } from '../content/cache';
import { FIXTURE_HTML } from '../content/fixture';
import { renderLegend } from '../content/legend';
import { mountSettingsFrame, unmountSettingsFrame } from '../content/settings-frame';
import '../content/styles.css';
import { inferFaculty } from '../shared/classify-faculty';
import { defaultSettings, sanitizeSettings } from '../shared/defaults';
import { loadSettings, watchSettings } from '../shared/storage';
import type { Settings } from '../shared/types';
import './demo.css';

function paintFixture(base: Settings): void {
  const root = document.getElementById('unipa');
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const dept = params.get('dept')?.trim() ?? '';
  const faculty = params.get('faculty')?.trim() ?? '';
  const settings =
    dept && !base.department
      ? sanitizeSettings({ ...base, department: dept, faculty: faculty || inferFaculty(dept) || '' })
      : base;
  const stats = applyColoring(root, settings, createCourseCache());
  renderLegend(stats, settings, () => {
    mountSettingsFrame('./index.html?embed=1');
  });
}

function Demo() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source === 'hcu-rishu-settings' && data.type === 'close') unmountSettingsFrame();
    };
    window.addEventListener('message', onMessage);
    let current = defaultSettings();
    void loadSettings().then((settings) => {
      current = settings;
      paintFixture(current);
    });
    const stop = watchSettings((settings) => {
      current = settings;
      paintFixture(settings);
    });
    return () => {
      window.removeEventListener('message', onMessage);
      stop();
    };
  }, []);

  return (
    <div className="page">
      <header className="bar">
        <div>
          <p className="brand">見本データ</p>
          <h1>履修登録・シラバス検索</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            mountSettingsFrame('./index.html?embed=1');
          }}
        >
          色分け設定
        </button>
      </header>
      <p className="notice">
        ログインできない環境で色分けを見るための架空の一覧です。広島市立大学のいちぽるそのものではありません。
        学科未設定なら共通科目だけ色が付きます。<code>?dept=情報工学科</code> を付けるか、設定を保存してから開き直してください。
      </p>
      <div id="unipa" dangerouslySetInnerHTML={{ __html: FIXTURE_HTML }} />
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Demo />);
