// UI strings for the menu and its buttons. English by default; Japanese when ComfyUI's locale
// is Japanese. The settings' names are not here: the frontend translates those itself, from
// main.js (English) and locales/<lang>/settings.json.

const EN = {
  menu: "Align and distribute",
  left: "Align left", hcenter: "Align horizontal centers", right: "Align right",
  top: "Align top", vcenter: "Align vertical centers", bottom: "Align bottom",
  distX: "Space columns evenly", distY: "Space rows evenly",
  width: "Match width", height: "Match height",
  reasons: {
    needTwo: () => "Select two or more nodes",
    aligned: () => "Already aligned",
    needTwoSizable: () => "Needs two or more resizable nodes",
    sameSize: () => "Already the same size",
    needColumns: (r) => `Needs three or more columns (now ${r.count})`,
    needRows: (r) => `Needs three or more rows (now ${r.count})`,
    distributed: () => "Already evenly spaced. Press to show the handles",
  },
};

const JA = {
  menu: "整列",
  left: "左揃え", hcenter: "左右の中央揃え", right: "右揃え",
  top: "上揃え", vcenter: "上下の中央揃え", bottom: "下揃え",
  distX: "列を横に等間隔", distY: "行を縦に等間隔",
  width: "幅を揃える", height: "高さを揃える",
  reasons: {
    needTwo: () => "ノードを 2 つ以上選ぶ",
    aligned: () => "もう揃っている",
    needTwoSizable: () => "大きさを変えられるノードが 2 つ以上いる",
    sameSize: () => "もう同じ大きさ",
    needColumns: (r) => `列が 3 つ以上いる（今は ${r.count} 列）`,
    needRows: (r) => `行が 3 つ以上いる（今は ${r.count} 行）`,
    distributed: () => "もう等間隔。押すと取っ手が出る",
  },
};

export function strings(locale) {
  return String(locale ?? "").toLowerCase().startsWith("ja") ? JA : EN;
}
