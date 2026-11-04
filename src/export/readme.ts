import type { TidyTable } from './tidy';

function flagged(table: TidyTable): string[] {
  return table.columns.filter((c) => c.notes.some((n) => /^(type-fallback|date-unconfirmed|hijri)/.test(n))).map((c) => c.name);
}

function noteBlock(table: TidyTable): { ar: string; en: string } {
  const names = flagged(table);
  if (names.length === 0) return { ar: '', en: '' };
  const list = names.map((n) => `- ${n}`).join('\n');
  return {
    ar: `\n### أعمدة صُدّرت كنص\nلم تتطابق قيم هذه الأعمدة تمامًا مع نوعها المكتشف أو لم يُؤكَّد تاريخها، فصُدّرت كنص. التفاصيل في data-dictionary.json:\n${list}\n`,
    en: `\n### Columns exported as text\nThe values in these columns did not all fit the detected type, or their dates were not confirmed, so they are exported as text. See data-dictionary.json:\n${list}\n`,
  };
}

const COMMON_AR = `- جميع القيم بعد الدمج الذي وافقت عليه فقط؛ ملفك الأصلي لم يتغير.
- الترميز UTF-8، الفاصل فاصلة، الفاصل العشري نقطة، التواريخ بصيغة yyyy-mm-dd، والقيم المفقودة حقول فارغة.
- النص الذي يبدأ بـ = أو @ أو + أو - (وليس رقمًا) سبقته علامة ' لمنع تنفيذه كصيغة في برامج الجداول.`;

const COMMON_EN = `- Values reflect only the merges you approved; your original file was not changed.
- Encoding is UTF-8, delimiter is a comma, decimals use a dot, dates are yyyy-mm-dd, missing values are empty fields.
- Text starting with = @ + or - (and not a plain number) is prefixed with ' so spreadsheet apps cannot run it as a formula.`;

export function powerBiReadme(table: TidyTable, datasetName: string): string {
  const extra = noteBlock(table);
  return `# DataCanvas: حزمة Power BI / Power BI package

**${datasetName}**

## بالعربية

### الملفات
- \`dataset.csv\`: البيانات النظيفة.
- \`transformations.pq\`: سكربت Power Query يحمّل الملف ويحدد أنواع الأعمدة.
- \`data-dictionary.json\`: وصف كل عمود ونوعه وملاحظاته.
- \`dashboard-spec.json\`: وصف اللوحة في DataCanvas لإعادة بناء الرسوم يدويًا (ليس ملفًا قابلًا للاستيراد في Power BI).

### الاستخدام
1. فك ضغط المجلد بالكامل في أي مكان على جهازك.
2. في Power BI Desktop: الصفحة الرئيسية ← تحويل البيانات ← مصدر جديد ← استعلام فارغ ← المحرر المتقدم.
3. الصق محتوى \`transformations.pq\`.
4. غيّر قيمة \`DataFolder\` في أول سطر إلى المجلد الذي فككت الضغط إليه (لا يوجد مسار مكتوب مسبقًا).
5. اضغط تم ثم إغلاق وتطبيق.

بديل: من \`Get data\` اختر \`Text/CSV\` وحدد \`dataset.csv\` بترميز UTF-8 والفاصلة، ثم اضبط أنواع الأعمدة كما في \`data-dictionary.json\`.

### ملاحظات
${COMMON_AR}
${extra.ar}
## English

### Files
- \`dataset.csv\`: the cleaned data.
- \`transformations.pq\`: a Power Query script that loads the file and assigns column types.
- \`data-dictionary.json\`: each column's type, role and notes.
- \`dashboard-spec.json\`: a DataCanvas description of the dashboard so you can recreate the charts by hand (it is not importable into Power BI).

### How to use
1. Extract the whole folder anywhere on your computer.
2. In Power BI Desktop: Home > Transform data > New source > Blank query > Advanced editor.
3. Paste the contents of \`transformations.pq\`.
4. Set \`DataFolder\` on the first line to the folder you extracted to (no machine-specific path is baked in).
5. Click Done, then Close & apply.

Alternative: use Get data > Text/CSV, pick \`dataset.csv\` with UTF-8 and comma, then set column types as listed in \`data-dictionary.json\`.

### Notes
${COMMON_EN}
${extra.en}`;
}

export function metabaseReadme(table: TidyTable, datasetName: string): string {
  const extra = noteBlock(table);
  return `# DataCanvas: حزمة Metabase / Metabase package

**${datasetName}**

## بالعربية

### الملفات
- \`dataset.csv\`: البيانات النظيفة (UTF-8).
- \`data-dictionary.json\`: وصف كل عمود ونوعه وملاحظاته.
- \`dashboard-spec.json\`: وصف اللوحة في DataCanvas لإعادة بناء الرسوم يدويًا (ليس ملفًا قابلًا للاستيراد في Metabase).

### قبل البدء
رفع ملفات CSV إلى Metabase يحتاج إعدادًا من مسؤول النظام: تفعيل الرفع (Uploads) وربط قاعدة بيانات تدعمه، وصلاحية رفع للمستخدم. ليست كل نسخ Metabase جاهزة لقبول الرفع مباشرة. راجع توثيق Metabase للإعداد.

### الاستخدام
1. في Metabase اختر جديد ← رفع بيانات (Upload data).
2. اختر \`dataset.csv\` والقاعدة والمخطط المناسبين.
3. بعد الرفع راجع أنواع الأعمدة وقارنها بـ \`data-dictionary.json\`، ثم أنشئ الأسئلة واللوحات يدويًا اعتمادًا على \`dashboard-spec.json\`.

### ملاحظات
${COMMON_AR}
${extra.ar}
## English

### Files
- \`dataset.csv\`: the cleaned data (UTF-8).
- \`data-dictionary.json\`: each column's type, role and notes.
- \`dashboard-spec.json\`: a DataCanvas description of the dashboard so you can recreate the charts by hand (it is not importable into Metabase).

### Before you start
Uploading CSV files to Metabase needs an administrator to enable Uploads and connect a database that supports them, and your account needs upload permission. Not every Metabase installation accepts uploads out of the box. See the Metabase documentation for setup.

### How to use
1. In Metabase choose New > Upload data.
2. Pick \`dataset.csv\` and the target database and schema.
3. After the upload, compare the column types with \`data-dictionary.json\`, then build questions and dashboards by hand using \`dashboard-spec.json\`.

### Notes
${COMMON_EN}
${extra.en}`;
}
