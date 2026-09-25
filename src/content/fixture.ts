/** ログインできない環境で色分けを確認するための見本。実在の科目表ではない。 */
export const FIXTURE_HTML = `
<form id="syllabus-form">
  <label for="org">学科組織</label>
  <select id="org">
    <option selected>選択してください</option>
    <option>情報科学部 情報工学科</option>
  </select>
  <table class="ui-datatable" id="syllabus">
    <thead>
      <tr>
        <th><span>授業コード</span></th>
        <th><span>授業科目</span></th>
        <th><span>担当教員</span></th>
        <th><span>開講学科</span></th>
        <th><span>科目区分</span></th>
        <th><span>単位</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1101</td>
        <td>プログラミング言語論</td>
        <td>広島 太郎</td>
        <td>情報科学部 情報工学科</td>
        <td>専門科目</td>
        <td>2</td>
      </tr>
      <tr>
        <td>1102</td>
        <td>知識情報処理</td>
        <td>山田 花子</td>
        <td>情報科学部 知能工学科</td>
        <td>専門科目</td>
        <td>2</td>
      </tr>
      <tr>
        <td>1103</td>
        <td>平和と広島</td>
        <td>佐藤 次郎</td>
        <td>全学共通</td>
        <td>全学共通系科目</td>
        <td>2</td>
      </tr>
      <tr>
        <td>1104</td>
        <td>英語コミュニケーション</td>
        <td>田中 美咲</td>
        <td>外国語系</td>
        <td>外国語系科目</td>
        <td>1</td>
      </tr>
      <tr>
        <td>1105</td>
        <td>情報科学実験</td>
        <td>高橋 一郎</td>
        <td>情報科学部</td>
        <td>学部共通科目</td>
        <td>2</td>
      </tr>
      <tr>
        <td>1106</td>
        <td>国際関係論</td>
        <td>鈴木 恵</td>
        <td>国際学部 国際学科</td>
        <td>専門科目</td>
        <td>2</td>
      </tr>
      <tr>
        <td>1107</td>
        <td>油絵基礎実習</td>
        <td>中村 茜</td>
        <td>芸術学部 美術学科 油絵専攻</td>
        <td>専門科目</td>
        <td>2</td>
      </tr>
      <tr>
        <td>1108</td>
        <td>特別講義</td>
        <td>不明</td>
        <td></td>
        <td></td>
        <td>1</td>
      </tr>
    </tbody>
  </table>
</form>
<form id="picker-form">
  <label for="busho">授業管理部署</label>
  <select id="busho">
    <option selected>選択してください</option>
    <option>全学共通教育</option>
  </select>
  <table class="ui-datatable" id="picker">
    <thead>
      <tr>
        <th>選択</th>
        <th>授業科目</th>
        <th>担当教員</th>
        <th>科目区分</th>
        <th>単位</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><input type="checkbox" /></td>
        <td>キャリア形成入門</td>
        <td>教務</td>
        <td>キャリア形成・実践科目</td>
        <td>1</td>
      </tr>
      <tr>
        <td><input type="checkbox" /></td>
        <td>アルゴリズム特論</td>
        <td>広島 太郎</td>
        <td>専門科目</td>
        <td>2</td>
      </tr>
    </tbody>
  </table>
</form>
<table id="week">
  <thead>
    <tr>
      <th>時限</th>
      <th>月</th>
      <th>火</th>
      <th>水</th>
      <th>木</th>
      <th>金</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>プログラミング言語論</td>
      <td></td>
      <td>平和と広島</td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>
`;
