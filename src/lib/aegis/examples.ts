/**
 * Curated example programs and the 5 exploit-rejection tests for Aegis.
 * Each exploit test documents which vulnerability class it targets and
 * how the language blocks it.
 */

export type Example = {
  id: string;
  title: string;
  arabicTitle: string;
  category: "safe" | "exploit";
  vulnerabilityClass?: string;
  code: string;
  expectedBlocked: boolean;
  explanation: string;
};

export const EXAMPLES: Example[] = [
  // ---- Safe examples ----
  {
    id: "hello",
    title: "Hello World",
    arabicTitle: "مرحباً بالعالم",
    category: "safe",
    code: `fn main() {
    print("Hello, world!")
}`,
    expectedBlocked: false,
    explanation: "أبسط برنامج. لا حاجة لصلاحيات، لا استيراد، لا طقوس.",
  },
  {
    id: "errors",
    title: "Function with error handling",
    arabicTitle: "دالة مع معالجة الأخطاء",
    category: "safe",
    code: `fn divide(a: Float, b: Float) -> Result<Float, String> {
    if b == 0.0 {
        return Err("division by zero")
    }
    Ok(a / b)
}

fn main() {
    match divide(10.0, 2.0) {
        Ok(r) => print("Result: {r}"),
        Err(e) => print("Error: {e}"),
    }
}`,
    expectedBlocked: false,
    explanation: "الأخطاء قيم من النوع Result<T, E> — لا استثناءات مخفية. يجب التعامل معها بـ match أو عامل ?.",
  },
  {
    id: "struct",
    title: "Struct with methods",
    arabicTitle: "بنية مع دوال",
    category: "safe",
    code: `struct Point {
    x: Float,
    y: Float,
}

impl Point {
    fn new(x: Float, y: Float) -> Point {
        Point { x: x, y: y }
    }
    fn distance_to(self, other: Point) -> Float {
        let dx = self.x - other.x
        let dy = self.y - other.y
        sqrt(dx * dx + dy * dy)
    }
}

fn main() {
    let p1 = Point::new(0.0, 0.0)
    let p2 = Point::new(3.0, 4.0)
    print("Distance: {p1.distance_to(p2)}")
}`,
    expectedBlocked: false,
    explanation: "البنى والـ impl مشابهة لـ Rust لكن بنحو أبسط. sqrt دالة مدمجة.",
  },
  {
    id: "jsonfile",
    title: "Read file + parse untrusted JSON",
    arabicTitle: "قراءة ملف وتحليل JSON غير موثوق",
    category: "safe",
    code: `fn main(env: Cap) {
    // env.fs صلاحية — لا وصول ضمني للنظام
    let content = env.fs.read("data.json")?
    print("Read: {content}")
    // التحويل النوعي يعيد Option — لا انهيار عند حقل ناقص
    let parsed = "42".parse_int()
    match parsed {
        Some(n) => print("Number: {n}"),
        None => print("Not a number"),
    }
}`,
    expectedBlocked: false,
    explanation: "قراءة الملف تتطلب صلاحية env. عامل ? ينهي الدالة بـ Err إن فشلت. parse_int يعيد Option.",
  },
  {
    id: "concurrency",
    title: "Concurrent task (safe)",
    arabicTitle: "مهمة متزامنة (آمنة)",
    category: "safe",
    code: `fn main(env: Cap) {
    // spawn يتطلب move — لا حالة مشتركة قابلة للتغيير
    let handle = spawn(move |net| {
        let r = env.net.fetch("https://api.example.com")?
        r
    })
    match handle.join() {
        Ok(text) => print("Got: {text}"),
        Err(e) => print("Failed: {e}"),
    }
}`,
    expectedBlocked: false,
    explanation: "spawn(move, ...) ينقل الملكية — يستحيل التعبير عن حالة مشتركة قابلة للتغيير عبر المهام.",
  },

  // ---- Exploit rejection tests ----
  {
    id: "exploit-bof",
    title: "Buffer overflow attempt",
    arabicTitle: "محاولة تجاوز حد المخزن",
    category: "exploit",
    vulnerabilityClass: "Buffer overflow / out-of-bounds access",
    code: `fn main() {
    let buf = [1, 2, 3, 4, 5]
    // الفهرسة خارج الحدود تعيد Option — لا سلوك غير معرّف
    match buf[100] {
        Some(v) => print("Got: {v}"),
        None => print("Out of bounds — safely returned None"),
    }
}`,
    expectedBlocked: false,
    explanation:
      "في C، buf[100] على مصفوفة طولها 5 يقرأ ذاكرة عشوائية (تجاوز حد). في Aegis، الفهرسة تعيد دائماً Option<T>: خارج الحدود => None. لا يوجد سلوك غير معرّف، لا قراءة لذاكرة عشوائية. فئة الثغرة مستحيلة التعبير.",
  },
  {
    id: "exploit-null",
    title: "Null dereference attempt",
    arabicTitle: "محاولة إلغاء إشارة null",
    category: "exploit",
    vulnerabilityClass: "Null dereference",
    code: `fn main() {
    let x = null
    print(x)
}`,
    expectedBlocked: true,
    explanation:
      "Aegis لا يحتوي null إطلاقاً. المحلّل اللغوي يرفض الكلمة نفسها قبل أي تنفيذ. استخدم Option<T> (Some/None). هذا يلغي فئة كاملة من الانهيارات (null dereference) التي تسبب آلاف CVEs في C/C++/Java.",
  },
  {
    id: "exploit-uaf",
    title: "Use-after-free attempt",
    arabicTitle: "محاولة use-after-free",
    category: "exploit",
    vulnerabilityClass: "Use-after-free / double-free",
    code: `fn main() {
    let p = malloc(4)
    free(p)
    print(p)
}`,
    expectedBlocked: true,
    explanation:
      "لا malloc ولا free في اللغة. الذاكرة تُدار بالملكية: عندما يخرج المتغير من النطاق تُحرَّر موارده آلياً ولا يمكن الوصول إليها بعد. يستحيل التعبير عن use-after-free أو double-free.",
  },
  {
    id: "exploit-sql",
    title: "SQL injection attempt",
    arabicTitle: "محاولة حقن SQL",
    category: "exploit",
    vulnerabilityClass: "SQL injection",
    code: `fn main(env: Cap) {
    let user = "admin'; DROP TABLE users; --"
    // نمط محظور: استعلام بسلسلة نصية واحدة
    env.db.query("SELECT * FROM users WHERE name = '" + user + "'")
}`,
    expectedBlocked: true,
    explanation:
      "db.query(string) مرفوض في التحليل النحوي. الصيغة الوحيدة المسموحة هي db.query(template, params) حيث تُمرَّر القيم كمعاملات منفصلة. لا يمكن أن تصل سلسلة المستخدم إلى محرك SQL. يلغي حقن SQL بالكامل.",
  },
  {
    id: "exploit-cmd",
    title: "Command injection attempt",
    arabicTitle: "محاولة حقن أوامر",
    category: "exploit",
    vulnerabilityClass: "Command injection",
    code: `fn main(env: Cap) {
    let filename = "foo.txt; rm -rf /"
    // نمط محظور: تنفيذ سلسلة نصية عبر shell
    env.shell.run("cat " + filename)
}`,
    expectedBlocked: true,
    explanation:
      "shell.run(string) مرفوض. الصيغة الوحيدة shell.run([\"cat\", filename]) تمرّر وسائط بنية مباشرة إلى execve دون shell وسيط. لا يمكن للمستخدم حقن أوامر لأنها لا تُفسَّر كسلسلة shell.",
  },
  {
    id: "exploit-race",
    title: "Data race attempt (shared mutable global)",
    arabicTitle: "محاولة سباق بيانات (متغير عام قابل للتغيير)",
    category: "exploit",
    vulnerabilityClass: "Data race on shared mutable state",
    code: `static mut counter = 0

fn worker() {
    counter = counter + 1
}

fn main() {
    spawn(move || { worker() })
    spawn(move || { worker() })
}`,
    expectedBlocked: true,
    explanation:
      "static mut مرفوض في المحلّل اللغوي. الحالة المشتركة القابلة للتغيير عبر المهام سبب السباقات. البديل: قناة (Channel) أو Actor معزول. لا يمكن التعبير عن السباق أصلاً.",
  },
  {
    id: "exploit-overflow",
    title: "Integer overflow attempt",
    arabicTitle: "محاولة فيض عدد صحيح",
    category: "exploit",
    vulnerabilityClass: "Integer overflow / wraparound",
    code: `fn main() {
    let big = 2000000000
    let sum = big + big
    match sum {
        Ok(n) => print("Sum: {n}"),
        Err(e) => print("Blocked: {e}"),
    }
}`,
    expectedBlocked: false,
    explanation:
      "الحساب على الأعداد الصحيحة مُفحوص: الفيض يُكتشف ويُعاد Err بدلاً من الالتفاف الصامت (الذي يسبب ثغرات مثل CVE-2014-0160-style). الالتفاف اختياري عبر wrapping_add.",
  },
  {
    id: "exploit-noambient",
    title: "Ambient filesystem access attempt",
    arabicTitle: "محاولة وصول ضمني للملفات",
    category: "exploit",
    vulnerabilityClass: "Unauthorized resource access (ambient authority)",
    code: `fn process(input: String) {
    // دالة بدون معامل Cap — لا ينبغي أن تصل للملفات
    fs.read(input)
}

fn main(env: Cap) {
    process("/etc/passwd")
}`,
    expectedBlocked: true,
    explanation:
      "لا صلاحيات محيطة. fs.read تتطلب Cap في النطاق. الدالة process لا تستقبل صلاحية، لذا يرفضها المحلّل. حتى لو سُلّم مسار /etc/passwd، لا يمكن للكود الوصول للملف دون صلاحية صريحة من main.",
  },
];
