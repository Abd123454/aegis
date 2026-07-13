import Link from "next/link";
import {
  Shield, ShieldCheck, ShieldX, Lock, KeyRound, Boxes, Network, GitBranch,
  Layers, Wrench, Cpu, GitCompare, Eye, Map, CalendarClock, ArrowLeft,
  Terminal, FileCode2, Bug, CheckCircle2, XCircle, AlertTriangle, Sparkles,
} from "lucide-react";
import { CodeBlock } from "@/components/aegis/CodeBlock";
import { LangCompare } from "@/components/aegis/LangCompare";
import Playground from "@/components/aegis/Playground";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <Section id="philosophy" num="01" icon={Sparkles} title="فلسفة التصميم" />
        <Philosophy />
        <Section id="threat-model" num="02" icon={Shield} title="نموذج التهديد وضمانات الأمان" />
        <ThreatModel />
        <Section id="syntax" num="03" icon={FileCode2} title="نظرة على النحو" />
        <SyntaxOverview />
        <Section id="types" num="04" icon={Layers} title="نظام الأنواع" />
        <TypeSystem />
        <Section id="memory" num="05" icon={Cpu} title="نموذج الذاكرة" />
        <MemoryModel />
        <Section id="concurrency" num="06" icon={Network} title="نموذج التزامن" />
        <ConcurrencyModel />
        <Section id="capabilities" num="07" icon={KeyRound} title="العزل وأمن الصلاحيات" />
        <Capabilities />
        <Section id="supply-chain" num="08" icon={GitBranch} title="أمن سلسلة التوريد" />
        <SupplyChain />
        <Section id="interop" num="09" icon={Boxes} title="التشغيل البيني واستراتيجية الهجرة" />
        <Interop />
        <Section id="stdlib" num="10" icon={Boxes} title="نطاق المكتبة القياسية" />
        <StdLib />
        <Section id="tooling" num="11" icon={Wrench} title="خطة الأدوات" />
        <Tooling />
        <Section id="reference" num="12" icon={Terminal} title="التنفيذ المرجعي" />
        <ReferenceImpl />
        <Section id="comparison" num="13" icon={GitCompare} title="جدول مقارنة صادق" />
        <Comparison />
        <Section id="progressive" num="14" icon={Eye} title="تصميم الإفصاح المتدرّج" />
        <Progressive />
        <Section id="adoption" num="15" icon={Map} title="خارطة الطريق للتبنّي" />
        <Adoption />
        <Section id="build-roadmap" num="16" icon={CalendarClock} title="خارطة طريق البناء الواقعية" />
        <BuildRoadmap />
        <Coda />
      </main>
      <Footer />
    </div>
  );
}

/* ----------------------------------------------------------------- Header */
function Header() {
  const links = [
    ["#philosophy", "الفلسفة"], ["#threat-model", "التهديدات"], ["#syntax", "النحو"],
    ["#reference", "المفسّر"], ["#comparison", "المقارنة"], ["#adoption", "التبنّي"],
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        <Link href="#top" className="flex items-center gap-2.5 shrink-0">
          <div className="grid place-items-center h-8 w-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
            <Shield className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="leading-none">
            <div className="font-mono font-semibold text-[15px] tracking-tight">Aegis</div>
            <div className="text-[10px] text-muted-foreground">إيجيس · أمن بالأساس</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition-colors">
              {label}
            </a>
          ))}
        </nav>
        <a href="#reference" className="text-[13px] font-medium px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shrink-0">
          جرّب المفسّر
        </a>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------- Hero */
function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 aegis-grid opacity-60" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="flex items-center gap-2 mb-6">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
            <Shield className="h-3 w-3 ml-1" /> RFC مفتوح · v0.1
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">مبني من الصفر</Badge>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance leading-[1.15]">
          لغة <span className="text-emerald-400">Aegis</span>
          <br />
          مبنية للأمن <span className="text-emerald-400">بالأساس</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed text-balance">
          تصميم كامل للغة برمجة جديدة تجعل فئات كاملة من الثغرات — تجاوز الحدود،
          استخدام بعد التحرير، الإلغاء الفارغ، حقن SQL والأوامر، سباقات البيانات —
          <span className="text-foreground font-medium"> مستحيلة التعبير</span>، لا
          مجرد عدم تشجيع. مع سهولة Python وقوة Rust، ومفسّر حقيقي يعمل.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#reference" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
            <Terminal className="h-4 w-4" /> جرّب المفسّر التفاعلي
          </a>
          <a href="#threat-model" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border hover:bg-muted/60 font-medium transition-colors">
            <Shield className="h-4 w-4" /> اقرأ ضمانات الأمان
          </a>
        </div>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["8", "فئات ثغرات تُستبعد بالبناء"],
            ["0", "كلمة `null` في اللغة"],
            ["5", "لغات في المقارنة الجنباً إلى جنب"],
            ["13", "برنامج تجريبي يعمل الآن"],
          ].map(([n, l]) => (
            <div key={l} className="rounded-xl border border-border bg-card/50 p-4">
              <div className="text-3xl font-bold font-mono text-emerald-400">{n}</div>
              <div className="text-xs text-muted-foreground mt-1 leading-snug">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- Section hdr */
function Section({ id, num, icon: Icon, title }: { id: string; num: string; icon: any; title: string }) {
  return (
    <div id={id} className="mx-auto max-w-6xl px-4 pt-20 scroll-mt-20">
      <div className="flex items-center gap-3 mb-8">
        <div className="grid place-items-center h-9 w-9 rounded-lg bg-muted border border-border">
          <Icon className="h-4.5 w-4.5 text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-sm text-emerald-400/70">{num}</span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        </div>
        <div className="flex-1 h-px bg-border mr-2" />
      </div>
    </div>
  );
}

function Wrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 pb-4 ${className}`}>{children}</div>;
}

/* ------------------------------------------------------- 1. Philosophy */
function Philosophy() {
  const principles = [
    {
      n: "الأمن بالبناء",
      d: "الثغرة لا تُمنع بمراجعة الكود أو التحذيرات — بل بجعل بنيتها اللغوية مستحيلة. إذا تعذّر التعبير عن نمط الخلل، فلا خلل. هذا هو الفرق بين «تعلّم أن تكون حذراً» و«لا تستطيع أن تكون مهملًا».",
      ref: "مستوحى من borrow checker في Rust و SPARK/Ada",
    },
    {
      n: "الإفصاح المتدرّج",
      d: "المسار الافتراضي بسيط كـ Python: مطبوعات، دوال، بنى، match. أما التحكّم اليدوي في تخطيط الذاكرة، والكتل غير الآمنة، ومبادئ التزامن منخفضة المستوى — فجميعها اختيارية ومتاحة للخبراء فقط.",
      ref: "مستوحى من نمو design surface في TypeScript و Deno",
    },
    {
      n: "لا صلاحيات محيطة",
      d: "الشيفرة لا تلمس الملفات أو الشبكة أو النظام إلا بصلاحية صريحة مُمرَّرة كقيمة. دالة مكتبة بلا معامل Cap لا تستطيع قراءة ملف حتى لو سُلّم لها المسار. هذا يكسر نمط «الاستيراد يعني الثقة الكاملة».",
      ref: "مستوحى من Deno و نموذج WASM capabilities",
    },
    {
      n: "تزامن بلا سباقات بالبناء",
      d: "الحالة المشتركة القابلة للتغيير عبر المهام غير قابلة للتعبير. التشارك يتم عبر قنوات تنقل الملكية أو عوامل معزولة (actors). السباق لا يُحظّر في وقت التشغيل — بل في وقت الترجمة.",
      ref: "مستوحى من Send/Sync في Rust و Erlang actors",
    },
    {
      n: "الصدق عن الحدود",
      d: "لا نزعم الحصانة الكاملة. عيّن بالضبط ما تُلغيه بالبناء (الأخطاء الناتجة عن الذاكرة والإدخال) وما لا تستطيع إلغاءه (أخطاء المنطق، الهندسة الاجتماعية، القنوات الجانبية للعتاد). الدقة هي ما يجعل التصميم قابلاً للبناء.",
      ref: "وفق نموذج seL4 و threat modeling الصريح",
    },
  ];
  return (
    <Wrap>
      <p className="text-muted-foreground leading-relaxed mb-6 max-w-3xl">
        كل قرار نحوي أو دلالي في Aegis يُربط بآلية تمنع ثغرة مسمّاة. لا نضيف ميزة
        لمجرد أنها أنيقة؛ نضيفها لأنها تُلغي فئة من الأخطاء أو تجعلها اختيارية.
        الفلسفة الخمس التالية تحكم كل اختيار لاحق في هذه الوثيقة.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        {principles.map((p, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs text-emerald-400/70">0{i + 1}</span>
              <h3 className="font-semibold">{p.n}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{p.d}</p>
            <div className="text-[11px] text-muted-foreground/70 border-t border-border pt-2 font-mono" dir="ltr">{p.ref}</div>
          </div>
        ))}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="font-semibold">المبدأ الحاكم</h3>
          </div>
          <p className="text-sm leading-relaxed">
            إذا كان نمط برمجي يحمل فئة ثغرات، فالسؤال الأول ليس «كيف نحذّر منه؟»
            بل «هل يمكن منع التعبير عنه أصلاً؟». إن أمكن → نمنعه. وإن لم يُمنع إلا
            وقت التشغيل → نجعله اختياراً صريحاً مع عزل. وإن استحال كلاهما → نذكر
            ذلك صراحة في نموذج التهديد.
          </p>
        </div>
      </div>
    </Wrap>
  );
}

/* ------------------------------------------------ 2. Threat model table */
function ThreatModel() {
  const rows: [string, string, "eliminated" | "mitigated"][] = [
    ["تجاوز الحد (Buffer overflow)", "الفهرسة تعيد Option<T>؛ خارج الحدود => None. لا حساب مؤشرات، لا مؤشرات خام.", "eliminated"],
    ["استخدام بعد التحرير (Use-after-free)", "ملكية + استعارة (borrowing) — لا free يدوي. المتغير يُحرَّر عند مغادرة النطاق ولا يُشار إليه بعد.", "eliminated"],
    ["Double-free", "لا free إطلاقاً. التحرير آلي وحيد عبر الملكية.", "eliminated"],
    ["إلغاء إشارة فارغة (Null deref)", "لا null في اللغة. الغياب يُمثَّل بـ Option<T> مع مطابقة إلزامية.", "eliminated"],
    ["ذاكرة غير مهيّأة", "كل رابطة تُهيَّأ قبل الاستخدام؛ التهيئة الافتراضية إلزامية ولا يوجد «ربما مهيّأ».", "eliminated"],
    ["فيض عدد صحيح (Integer overflow)", "الحساب مُفحوص افتراضياً؛ الفيض يعيد Err. الالتفاف اختياري صريح (wrapping_add).", "eliminated"],
    ["حقن SQL", "db.query تقبل (قالب، معاملات) فقط. لا يصل نص المستخدم إلى محرك SQL. سلسلة واحدة = خطأ تجميع.", "eliminated"],
    ["حقن الأوامر (Command injection)", "shell.run تتقبل مصفوفة وسائط فقط تُمرَّر إلى execve مباشرة. لا shell وسيط، لا تحليل سلسلة.", "eliminated"],
    ["سباق بيانات (Data race)", "الحالة المشتركة القابلة للتغيير محظورة عبر المهام. التشارك عبر قنوات نقل ملكية أو actors. static mut مرفوض.", "eliminated"],
    ["الوصول غير المصرّح للموارد", "لا صلاحيات محيطة. fs/net/shell/db تتطلب قيمة Cap مُمرَّرة صراحةً من main.", "eliminated"],
    ["ثغرات سلسلة التنسيق (Format string)", "لا printf متغيّر الوسائط. التنسيق مكتوب النوع عبر قوالب مدمجة {var}.", "eliminated"],
    ["الارتباك النوعي (Type confusion)", "تطابق ثابت صارم، لا تحويلات ضمنية، ADT مع مطابقة إلزامية شاملة.", "eliminated"],
    ["إدخال غير موثوق (Parsing bugs)", "المحلّلات القياسية تعيد Result؛ فشل التحليل قيمة يعالجها الاستدعاء ولا ينهار.", "eliminated"],
    ["TOCTOU (Time-of-check/time-of-use)", "عمليات الملف تُجرى عبر رمز صلاحية (capability token) لا سلسلة مسار، فلا نافذة سباق على المسار.", "mitigated"],
    ["إهدار الموارد / DoS", "حصص قابلة للضبط على الذاكرة والوقت والاستدعاءات؛ لا إلغاء كامل ولكن تخفيف.", "mitigated"],
  ];
  const cannot: [string, string][] = [
    ["أخطاء المنطق التجاري", "لا يستطيع المُترجم أن يعرف أن «تحويل المال للجهة الخطأ» خطأ منطقي. هذا مسؤولية الاختبار والمراجعة."],
    ["الهندسة الاجتماعية", "خداع البشر خارج نطاق أي لغة. Aegis لا يحمي من رسائل تصيّد موجّهة لمطوّريك."],
    ["القنوات الجانبية للعتاد", "Spectre و Rowhammer و استنباق التفرّع: هجوم على العتاد لا على الذاكرة. يتطلب عزل على مستوى النواة أو العتاد."],
    ["الباب الخلفي في تبعية", "نُخفّفه عبر التوقيع والبناء القابل للتكرار والتدقيق، لكن لا نُلغيه — قد تكون التبعية نفسها خبيثة."],
    ["سوء استعمال التشفير", "اللغة لا تفرّق بين خوارزمية جيدة وضعيفة. نوفر افتراضات آمنة، لكن المُطوّر يمكنه تجاوزها بصلاحية."],
    ["أخطاء التحقق الرسمي نفسه", "إثبات البرنامج صحيح فقط بقدر صحة المواصفات. لو كانت المواصفة خاطئة، الإثبات بلا قيمة."],
  ];
  return (
    <Wrap>
      <p className="text-muted-foreground leading-relaxed mb-6 max-w-3xl">
        الجدول التالي يربط كل فئة ثغرات بآلية لغوية محددة. «مُلغى» يعني أن النمط
        مستحيل التعبير؛ «مُخفّف» يعني أن اللغة تقلّل الخطر لكن لا تستبعده كلياً.
      </p>
      <div className="rounded-xl border border-border overflow-hidden mb-8">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-right">
                <th className="px-4 py-3 font-semibold border-b border-border">فئة الثغرة</th>
                <th className="px-4 py-3 font-semibold border-b border-border">الآلية المُلغية لها بالبناء</th>
                <th className="px-4 py-3 font-semibold border-b border-border text-center shrink-0">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([vuln, mech, status], i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium" dir="ltr">{vuln}</td>
                  <td className="px-4 py-3 text-muted-foreground leading-relaxed">{mech}</td>
                  <td className="px-4 py-3 text-center">
                    {status === "eliminated" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 whitespace-nowrap">
                        <CheckCircle2 className="h-3 w-3 ml-1" /> مُلغى بالبناء
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15 whitespace-nowrap">
                        <AlertTriangle className="h-3 w-3 ml-1" /> مُخفّف
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldX className="h-4 w-4 text-rose-400" />
          <h3 className="font-semibold">ما لا تستطيع Aegis إلغاءه — صراحةً</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          أي تصميم يزعم حلاً لكل شيء أضعف لا أقوى. هذه هي الفئات التي نقرّ بعدم
          قدرتنا على إلغائها، وما نفعله حيالها:
        </p>
        <div className="grid md:grid-cols-2 gap-3">
          {cannot.map(([k, v], i) => (
            <div key={i} className="rounded-lg bg-background/50 border border-border p-3">
              <div className="font-medium text-sm mb-1" dir="ltr">{k}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 3. Syntax overview */
function SyntaxOverview() {
  return (
    <Wrap className="space-y-10">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        نفس البرامج الخمسة مكتوبة في Aegis مقابل Python و JavaScript و Rust و C
        جنباً إلى جنب. النحو يقصد البساطة (أقرب لـ Python/Ruby) مع الأنواع
        الثابتة (أقرب لـ Rust) والإلزامية الأمنية (لا توجد في أيٍّ منها افتراضياً).
      </p>

      <SyntaxBlock
        title="1) Hello World"
        note="Aegis تشبه Python في البساطة لكن مع توقيع main صريح."
        items={[
          { lang: "aegis", label: "Aegis", code: `fn main() {\n    print("Hello, world!")\n}` },
          { lang: "python", label: "Python", code: `print("Hello, world!")` },
          { lang: "js", label: "JavaScript", code: `console.log("Hello, world!");` },
          { lang: "rust", label: "Rust", code: `fn main() {\n    println!("Hello, world!");\n}` },
          { lang: "c", label: "C", code: `#include <stdio.h>\nint main(void) {\n    printf("Hello, world!\\n");\n    return 0;\n}` },
        ]}
      />

      <SyntaxBlock
        title="2) دالة مع معالجة أخطاء"
        note="في Aegis الخطأ قيمة Result — لا استثناء مخفي. ? ينهي مبكراً، match يفرض المعالجة."
        items={[
          { lang: "aegis", label: "Aegis", code: `fn divide(a: Float, b: Float) -> Result<Float, String> {\n    if b == 0.0 { return Err("division by zero") }\n    Ok(a / b)\n}\n\nfn main() {\n    match divide(10.0, 2.0) {\n        Ok(r)  => print("Result: {r}"),\n        Err(e) => print("Error: {e}"),\n    }\n}` },
          { lang: "python", label: "Python", code: `def divide(a, b):\n    if b == 0.0:\n        raise ValueError("division by zero")\n    return a / b\n\ntry:\n    print("Result:", divide(10.0, 2.0))\nexcept ValueError as e:\n    print("Error:", e)` },
          { lang: "js", label: "JavaScript", code: `function divide(a, b) {\n  if (b === 0.0) throw new Error("division by zero");\n  return a / b;\n}\ntry {\n  console.log("Result:", divide(10.0, 2.0));\n} catch (e) {\n  console.log("Error:", e.message);\n}` },
          { lang: "rust", label: "Rust", code: `fn divide(a: f64, b: f64) -> Result<f64, String> {\n    if b == 0.0 { return Err("division by zero".into()); }\n    Ok(a / b)\n}\nfn main() {\n    match divide(10.0, 2.0) {\n        Ok(r)  => println!("Result: {}", r),\n        Err(e) => println!("Error: {}", e),\n    }\n}` },
          { lang: "c", label: "C", code: `#include <stdio.h>\nint divide(double a, double b, double *out) {\n    if (b == 0.0) return -1;\n    *out = a / b;\n    return 0;\n}\nint main(void) {\n    double r;\n    if (divide(10.0, 2.0, &r) == 0)\n        printf("Result: %f\\n", r);\n    else\n        printf("Error: division by zero\\n");\n    return 0;\n}` },
        ]}
      />

      <SyntaxBlock
        title="3) بنية مع دوال"
        note="البنى و impl مشابهة لـ Rust لكن بنحو أنظف (لا حاجة لـ 'static lifetime)."
        items={[
          { lang: "aegis", label: "Aegis", code: `struct Point { x: Float, y: Float }\n\nimpl Point {\n    fn new(x: Float, y: Float) -> Point {\n        Point { x: x, y: y }\n    }\n    fn distance_to(self, other: Point) -> Float {\n        let dx = self.x - other.x\n        let dy = self.y - other.y\n        (dx * dx + dy * dy).sqrt()\n    }\n}\n\nfn main() {\n    let p1 = Point::new(0.0, 0.0)\n    let p2 = Point::new(3.0, 4.0)\n    print("Distance: {p1.distance_to(p2)}")\n}` },
          { lang: "python", label: "Python", code: `import math\nclass Point:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n    def distance_to(self, other):\n        dx = self.x - other.x\n        dy = self.y - other.y\n        return math.sqrt(dx*dx + dy*dy)\n\np1 = Point(0.0, 0.0)\np2 = Point(3.0, 4.0)\nprint("Distance:", p1.distance_to(p2))` },
          { lang: "js", label: "JavaScript", code: `class Point {\n  constructor(x, y) { this.x = x; this.y = y; }\n  distanceTo(other) {\n    const dx = this.x - other.x;\n    const dy = this.y - other.y;\n    return Math.sqrt(dx*dx + dy*dy);\n  }\n}\nconst p1 = new Point(0.0, 0.0);\nconst p2 = new Point(3.0, 4.0);\nconsole.log("Distance:", p1.distanceTo(p2));` },
          { lang: "rust", label: "Rust", code: `struct Point { x: f64, y: f64 }\nimpl Point {\n    fn new(x: f64, y: f64) -> Point { Point { x, y } }\n    fn distance_to(&self, other: Point) -> f64 {\n        let dx = self.x - other.x;\n        let dy = self.y - other.y;\n        (dx*dx + dy*dy).sqrt()\n    }\n}\nfn main() {\n    let p1 = Point::new(0.0, 0.0);\n    let p2 = Point::new(3.0, 4.0);\n    println!("Distance: {}", p1.distance_to(p2));\n}` },
          { lang: "c", label: "C", code: `#include <stdio.h>\n#include <math.h>\ntypedef struct { double x, y; } Point;\ndouble distance_to(Point a, Point b) {\n    double dx = a.x - b.x;\n    double dy = a.y - b.y;\n    return sqrt(dx*dx + dy*dy);\n}\nint main(void) {\n    Point p1 = {0.0, 0.0};\n    Point p2 = {3.0, 4.0};\n    printf("Distance: %f\\n", distance_to(p1, p2));\n    return 0;\n}` },
        ]}
      />

      <SyntaxBlock
        title="4) قراءة ملف وتحليل JSON غير موثوق"
        note="في Aegis القراءة تتطلب صلاحية env؛ الفشل قيمة يعالجها ?. لا يوجد تفقّد ضمني — الإدخال معزول."
        items={[
          { lang: "aegis", label: "Aegis", code: `fn main(env: Cap) {\n    // env.fs صلاحية — لا وصول ضمني للنظام\n    let content = env.fs.read("data.json")?\n    // التحليل يعيد Result؛ لا انهيار على JSON سيئ\n    let n = content.parse_int()\n    match n {\n        Some(v) => print("Number: {v}"),\n        None    => print("Not a number"),\n    }\n}` },
          { lang: "python", label: "Python", code: `import json\nwith open("data.json") as f:    # وصول ضمني للملفات\n    content = f.read()\ntry:\n    data = json.loads(content)\n    print("Number:", data["age"])\nexcept (KeyError, json.JSONDecodeError):\n    print("Not a number")` },
          { lang: "js", label: "JavaScript", code: `const fs = require("fs");     // وصول ضمني\nlet content;\ntry {\n  content = fs.readFileSync("data.json", "utf8");\n} catch (e) { throw e; }\ntry {\n  const data = JSON.parse(content);\n  console.log("Number:", data.age);\n} catch (e) {\n  console.log("Not a number");\n}` },
          { lang: "rust", label: "Rust", code: `use std::fs;\nfn main() -> Result<(), Box<dyn std::error::Error>> {\n    let content = fs::read_to_string("data.json")?;\n    let data: serde_json::Value = serde_json::from_str(&content)?;\n    if let Some(n) = data["age"].as_i64() {\n        println!("Number: {}", n);\n    } else {\n        println!("Not a number");\n    }\n    Ok(())\n}` },
          { lang: "c", label: "C", code: `#include <stdio.h>\n#include <stdlib.h>\nint main(void) {\n    FILE *f = fopen("data.json", "r");   // قد يكون NULL\n    if (!f) return 1;\n    char buf[1024];\n    fgets(buf, sizeof(buf), f);          // تجاوز حد إن كان المحتوى أكبر\n    // تحليل JSON يدوياً — مصدر ثغرات نموذجي\n    printf("%s\\n", buf);\n    return 0;\n}` },
        ]}
      />

      <SyntaxBlock
        title="5) مهمة متزامنة — الآمنة مقابل نسخة C غير الآمنة"
        note="في Aegis، spawn يتطلب move — لا حالة مشتركة قابلة للتغيير. نسخة C أدناه تحوي سباق بيانات يستحيل التعبير عنه في Aegis."
        items={[
          { lang: "aegis", label: "Aegis (آمن)", code: `fn main(env: Cap) {\n    // spawn(move, closure) — الملكية تُنقل\n    let handle = spawn(move |net| {\n        let r = env.net.fetch("https://api.example.com")?\n        r\n    })\n    match handle.join() {\n        Ok(text) => print("Got: {text}"),\n        Err(e)   => print("Failed: {e}"),\n    }\n}` },
          { lang: "python", label: "Python", code: `import threading\nresult = {}\ndef worker():\n    result["x"] = 1   # محمي بـ GIL — لا سباق حقيقي\n    # لكن لا ضمان ترتيب، ولا أمان مع asyncio+multiprocessing\nt = threading.Thread(target=worker)\nt.start(); t.join()\nprint(result)` },
          { lang: "js", label: "JavaScript", code: `// عامل ويب — لا ذاكرة مشتركة، رسائل فقط\nconst worker = new Worker("worker.js");\nworker.postMessage({ url: "https://api.example.com" });\nworker.onmessage = (e) => console.log("Got:", e.data);\n// (Worker API، لا spawn مضمّن)` },
          { lang: "rust", label: "Rust", code: `use std::thread;\nfn main() {\n    let handle = thread::spawn(move || {\n        "https://api.example.com"  // move يفرض نقل الملكية\n    });\n    let r = handle.join().unwrap();\n    println!("Got: {}", r);\n}` },
          { lang: "c", label: "C (غير آمن)", code: `#include <pthread.h>\n#include <stdlib.h>\nint *counter;            // حالة مشتركة قابلة للتغيير\nvoid *worker(void *a) {\n    for (int i = 0; i < 1000000; i++)\n        (*counter)++;     // سباق بيانات — سلوك غير معرّف\n    return NULL;\n}\nint main(void) {\n    counter = malloc(sizeof(int));  // قد يكون NULL\n    *counter = 0;\n    pthread_t t1, t2;\n    pthread_create(&t1, NULL, worker, NULL);\n    pthread_create(&t2, NULL, worker, NULL);\n    pthread_join(t1, NULL); pthread_join(t2, NULL);\n    free(counter);        // use-after-free لو لم ينتهِ الخيط\n    return 0;\n}` },
        ]}
      />

      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Bug className="h-4 w-4 text-rose-400" />
          <h3 className="font-semibold">لماذا لا يمكن التعبير عن نسخة C أعلاه في Aegis؟</h3>
        </div>
        <ul className="text-sm text-muted-foreground leading-relaxed space-y-2 list-disc pr-5">
          <li><span className="text-foreground font-medium" dir="ltr">static mut / global mutable</span> — مرفوض في المحلّل اللغوي. لا متغير عام قابل للتغيير.</li>
          <li><span className="text-foreground font-medium" dir="ltr">malloc</span> — غير موجود. التخصيص يعيد Result ويُفحص.</li>
          <li><span className="text-foreground font-medium" dir="ltr">free</span> — غير موجود. التحرير آلي بالملكية؛ لا use-after-free.</li>
          <li><span className="text-foreground font-medium" dir="ltr">(*counter)++</span> عبر خيطين — الحالة المشتركة القابلة للتغيير تتطلب Sync bound لا يمتلكه Int الخام. الطريق الوحيد: قناة تنقل الملكية.</li>
          <li><span className="text-foreground font-medium" dir="ltr">spawn(move, ...)</span> — الـ closure يأخذ الملكية بالكامل؛ لا وصول مشترك للمتغيرات الخارجية القابلة للتغيير.</li>
        </ul>
      </div>
    </Wrap>
  );
}

function SyntaxBlock({ title, note, items }: { title: string; note: string; items: { lang: string; label: string; code: string }[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{note}</p>
      <LangCompare items={items} />
    </div>
  );
}

/* --------------------------------------------------- 4. Type system */
function TypeSystem() {
  return (
    <Wrap className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold mb-3">ثابت، مُستنتَج، وواعٍ بالصلاحيات</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            نظام الأنواع في Aegis <span className="text-foreground">ثابت</span> (static)
            لكنه <span className="text-foreground">مُستنتَج بالكامل</span> — نادراً ما
            تُكتب الأنواع صراحةً. الهدف: أمان Rust مع بساطة Python.
          </p>
          <ul className="text-sm text-muted-foreground leading-relaxed space-y-2 list-disc pr-5">
            <li>أنواع جبرية (ADT) مع مطابقة نمط إلزامية شاملة.</li>
            <li><span dir="ltr">Option&lt;T&gt;</span> و <span dir="ltr">Result&lt;T, E&gt;</span> بدل null والاستثناءات.</li>
            <li>أثر الصلاحيات (effect system): كل دالة تُوسم بالأثر الذي تستهلكه (IO، Net، FS، Time).</li>
            <li>Traits مشابهة لـ Rust للمقاسم السلوكية.</li>
            <li>تدرّج عند الحدود: <span dir="ltr">extern "C"</span> يدخل وضعاً غير آمن صريح.</li>
          </ul>
        </div>
        <CodeBlock
          filename="types.aegis"
          code={`// الأنواع تُستنتج — لا حاجة لكتابتها
let name = "Aegis"          // String
let count = 42              // Int
let ratio = 3.14            // Float

// ADT مع مطابقة شاملة إلزامية
enum Shape {
    Circle(Float),
    Square(Float),
    Rect(Float, Float),
}

fn area(s: Shape) -> Float {
    match s {
        Shape::Circle(r)      => 3.14159 * r * r,
        Shape::Square(side)   => side * side,
        Shape::Rect(w, h)     => w * h,
        // المُترجم يرفض الترجمة إن فُقد فرع
    }
}

// أثر صريح: [+FS] تعني تستهلك صلاحية نظام الملفات
fn load_config(env: Cap) [+FS] -> Result<Config, String> {
    let raw = env.fs.read("config.toml")?
    Config::parse(raw)
}`}
        />
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <h4 className="font-medium mb-2">المبرّر مقابل هدفي «الأمان» و«سهولة التعلّم»</h4>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground leading-relaxed">
          <div>
            <span className="text-emerald-400 font-medium">للأمان:</span> الأنواع الثابتة تُلغي فئة كاملة من الأخطاء (الارتباك النوعي، الإدخال غير المُعالج) في وقت الترجمة. Option/Result يجبران المُطوّر على التعامل مع الغياب والفشل بدل تجاهلهما.
          </div>
          <div>
            <span className="text-emerald-400 font-medium">للسهولة:</span> الاستنتاج الكامل يعني أن الشيفرة اليومية تكاد لا تذكر الأنواع. المبتدئ يكتب <span dir="ltr" className="font-mono">let x = 5</span> ويحصل على أمان ثابت مجاناً — تماماً كما في ML/Haskell لكن بنحو مألوف.
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 5. Memory model */
function MemoryModel() {
  return (
    <Wrap className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="font-mono text-xs text-emerald-400 mb-2">الوضع الافتراضي</div>
          <h3 className="font-semibold mb-2">ملكية + استعارة</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            مأخوذ من Rust لكن مُبسّط: قاعدة واحدة (القيمة لها مالك واحد)، استعارة
            غير قابلة للتغيير افتراضياً، <span dir="ltr" className="font-mono">&mut</span> صريح للحصول على استعارة قابلة للتغيير. يُلغي use-after-free و double-free و السباقات بالبناء.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-5">
          <div className="font-mono text-xs text-muted-foreground mb-2">وضع المبتدئ</div>
          <h3 className="font-semibold mb-2">منطقة مُدارة (GC)</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            وحدة <span dir="ltr" className="font-mono">managed</span> توفّر arena
            مع جامع نفايات شامل للكائنات قصيرة العمر. مخصّص للنصوص والسكربتات
            وحالات الويب حيث لا يهمّ تحكّم الذاكرة الدقيق. التبديل بكلمة واحدة.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-5">
          <div className="font-mono text-xs text-muted-foreground mb-2">وضع الخبير</div>
          <h3 className="font-semibold mb-2">تخطيط يدوي معزول</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            داخل <span dir="ltr" className="font-mono">unsafe block</span> مُفعّل
            بعلم الترجمة <span dir="ltr" className="font-mono">--allow-unsafe</span>:
            تحكّم في repr(C)، محاذاة، مجموعات ثابتة الحجم. للأنظمة المضمّنة والنوى فقط.
          </p>
        </div>
      </div>
      <CodeBlock
        filename="memory.aegis"
        code={`// الوضع الافتراضي: ملكية (آمن، بلا GC، بلا free)
fn process(data: String) -> Int {
    data.len()         // data مملوكة هنا؛ تُحرَّر عند الخروج
}

// وضع المبتدئ: منطقة مُدارة (GC داخل الكتلة)
managed {
    let graph = Graph::new()
    for i in 0..1000 {
        graph.add_node(i)   // لا حاجة للتفكير في الملكية
    }
    graph.compute()
}   // GC يحرّر كل شيء هنا

// وضع الخبير: تخطيط يدوي (معزول خلف unsafe + علم ترجمة)
unsafe repr(C) struct Packet {
    magic: [u8; 4],
    len: u32,
    payload: [u8; 0],   // مصفوفة مرنة C-style
}`}
      />
      <div className="rounded-xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">المبرّر الهجين:</span> لا
        نمط ذاكرة واحد يناسب كل شيء. النوى تريدت تحكّماً يدوياً بلا GC؛ تطبيقات
        الويب تريد إنتاجية بلا تفكير في العمر. الافتراض الآمن (ملكية) يعطي
        معظم التطبيقات أداءً بلا GC وأماناً كاملاً، بينما يبقى الخياران الآخران
        متاحَين دون أن يُجبرا المبتدئ على التعقيد من اليوم الأول.
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 6. Concurrency */
function ConcurrencyModel() {
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        التزامن في Aegis <span className="text-foreground">خالٍ من سباقات البيانات
        بالبناء</span>. لا يوجد <span dir="ltr" className="font-mono">static mut</span>،
        لا مؤشرات خام مشتركة، لا حاجة لقفل يدوي في الشيفرة الآمنة. الآليتان الأساسيتان:
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <Network className="h-5 w-5 text-emerald-400 mb-2" />
          <h3 className="font-semibold mb-2">قنوات نقل الملكية (Channels)</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            على غرار Go و Rust: المهمة ترسل قيمة عبر قناة، فتُنقل ملكيتها إلى
            المستلِم. لا يمكن للمُرسِل استخدامها بعد الإرسال. هذا يضمن أن البيانات
            المتزامنة إما غير قابلة للتغيير أو مملوكة لمهمة واحدة في كل لحظة.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <Boxes className="h-5 w-5 text-emerald-400 mb-2" />
          <h3 className="font-semibold mb-2">عوامل معزولة (Actors)</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            على غرار Erlang/Akka: عامل (actor) يملك حالته الخاصة ولا يُشارَك
            متغيراته مع أحد. التواصل عبر رسائل غير متزامنة فقط. لا قفل، لا سباق،
            لأنه لا توجد ذاكرة مشتركة أصلاً.
          </p>
        </div>
      </div>
      <CodeBlock
        filename="concurrency.aegis"
        code={`use aegis::channels

fn main(env: Cap) {
    // قناة تنقل ملكية Int عبر المهام
    let (tx, rx) = channels::unbounded()

    // spawn(move, ...) — الإغلاق يأخذ الملكية
    let h1 = spawn(move || {
        tx.send(42)        // 42 يُنقل إلى المستلِم
        // tx لم يعد صالحاً هنا — نُقل
    })

    let h2 = spawn(move || {
        match rx.recv() {
            Some(n) => print("Received: {n}"),
            None    => print("Channel closed"),
        }
    })

    h1.join()
    h2.join()
}

// Actor: حالة معزولة تماماً
actor Counter {
    state: Int = 0,

    fn inc(&mut self) {
        self.state = self.state + 1
    }
    fn get(&self) -> Int {
        self.state
    }
}`}
      />
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <AlertTriangle className="h-4 w-4 text-amber-400 mb-2" />
        <p className="text-sm leading-relaxed">
          <span className="font-medium">حدّ صادق:</span> هذا ليس borrow checker
          كاملاً (التنفيذ المرجعي يُحاكي فحص النقل لـ spawn فقط). في التنفيذ
          الإنتاجي، يحلّل المُترجم تدفّق الملكية عبر كل المسارات كـ Rust تماماً،
          وهذا الجزء معقّد ولا يمكن إخفاؤه بالكامل — لكنه يُخفى عن المبتدئ لأن
          الوضع الافتراضي (القنوات/العوامل) لا يحتاجه.
        </p>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 7. Capabilities */
function Capabilities() {
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        كل أثر جانبي (ملف، شبكة، عملية فرعية، بيئة، وقت) هو <span className="text-foreground">صلاحية</span>:
        قيمة تُمرَّر صراحةً. دالة مكتبة بلا معامل <span dir="ltr" className="font-mono">Cap</span> لا تستطيع لمس
        النظام حتى لو حاولت. هذا يكسر نمط «الاستيراد يعني ثقة كاملة» السائد في Python/npm.
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        <CodeBlock
          filename="capabilities.aegis"
          code={`// main تستقبل كل الصلاحيات من المُشغّل
fn main(env: Cap) {
    // env.fs / env.net / env.shell / env.db / env.time
    let cfg = env.fs.read("config.json")?
    let resp = env.net.fetch("https://api.x.com")?
    print(cfg)
}

// دالة مكتبة: لا Cap => لا وصول للنظام
fn parse(input: String) -> Config {
    // fs.read(input)  // ❌ خطأ تجميع: لا Cap في النطاق
    Config::parse(input)   // ✅ معالجة محضة
}

// تمرير صلاحية مشتقّة (مقيّدة)
fn upload(env: Cap) {
    // إنشاء صلاحية شبكة محدودة بنطاق واحد
    let net = env.net.restrict_to("*.cdn.example.com")
    worker(net)   // worker يحصل على net فقط، لا fs ولا shell
}`}
        />
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <h4 className="font-medium text-sm mb-2">مقارنة مع النماذج الأخرى</h4>
            <div className="text-xs text-muted-foreground space-y-2">
              <div><span className="text-foreground font-medium">Python/Node:</span> أي وحدة مستوردة تستطيع قراءة ~/.ssh وتنفيذ أوامر. ثقة كاملة ضمنية.</div>
              <div><span className="text-foreground font-medium">Deno:</span> صلاحيات وقت التشغيل عبر flags. أقرب لكنها خارج اللغة.</div>
              <div><span className="text-foreground font-medium">WASM:</span> عزل كامل لكن يحتاج مُضيفاً يحقن الـ imports.</div>
              <div><span className="text-emerald-400 font-medium">Aegis:</span> الصلاحيات قيم في نظام الأنواع — تُمرَّر وتُقيَّد وتُدقَّق وقت الترجمة.</div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <ShieldCheck className="h-4 w-4 text-emerald-400 mb-2" />
            <p className="text-xs leading-relaxed">
              النتيجة: ثغرة «مكتبة تبعية تسرق الملفات» تصبح أصعب بكثير. تستطيع
              تشغيل مكتبة تشفير غير موثوقة لمعالجة نص، وهي <span className="font-medium">لا تملك صلاحية قراءة ملف أو إرسال شبكة</span> أصلاً.
            </p>
          </div>
        </div>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 8. Supply chain */
function SupplyChain() {
  const items = [
    { t: "حزم موقّعة (Ed25519)", d: "كل إصدار يحمل توقيع المُؤلّف وسلسلة ثقة. التحقق قبل التثبيت إلزامي." },
    { t: "بناء قابل للتكرار", d: "أداة بناء محدّدة، تعيينات确定性، تجزئة البايت النهائي. نفس المصدر => نفس الثنائي في كل مكان." },
    { t: "تدقيق مدمج", d: "aegis audit يفحص الشجرة كاملة ضد قاعدة CVE المعروفة ويفحص الكود المشبوه (eval, shell, unsafe)." },
    { t: "SBOM تلقائي", d: "كل بناء يُنتج Software Bill of Materials بصيغة CycloneDX، يُرفق بالثنائي." },
    { t: "تثبيت بالتجزئة", d: "aegis.lock يثبّت كل تبعية بتجزئة content-addressed. لا مفاجآت في npm-style \"latest\"." },
    { t: "نطاقات مقيّدة", d: "كل حزمة تُوسم بنطاق الصلاحيات المسموح بها: net فقط، fs للقراءة فقط، إلخ. تجاوزها يتطلب موافقة صريحة." },
  ];
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        سلسلة التوريد هي السطح الأكبر للهجوم اليوم (event-stream، left-pad،
        xz-utils). Aegis يدمج الأمان في مدير الحزم نفسه — لا يتركه كخطوة لاحقة.
      </p>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-4">
            <Lock className="h-4 w-4 text-emerald-400 mb-2" />
            <h3 className="font-medium text-sm mb-1.5" dir="ltr">{it.t}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{it.d}</p>
          </div>
        ))}
      </div>
      <CodeBlock
        filename="aegis.toml"
        code={`[package]
name = "myapp"
version = "0.1.0"
signed-by = "ed25519:9f3a...c1b2"

[dependencies]
crypto = { version = "2.4.1", scope = "pure" }      # لا صلاحيات
http   = { version = "1.2.0", scope = "net:*.api.x.com" }
serde  = { version = "3.0.0", scope = "pure" }

[permissions]
# الصلاحيات التي يطلبها التطبيق نفسه عند التشغيل
fs   = ["read:./data"]
net  = ["https://api.example.com"]
time = true
shell = false   # معطلة افتراضياً`}
      />
    </Wrap>
  );
}

/* --------------------------------------------------- 9. Interop */
function Interop() {
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        لا تُزيح لغةٌ لغةً أخرى دفعة واحدة. الاستراتيجية: <span className="text-foreground">تشغيل بيني
        أولاً، ثم إعادة كتابة تدريجية حالةً بحالة</span>. هذه هي النسخة الصادقة من
        «الاستبدال» — وهي بالضبط كيف انتشرت TypeScript و Rust في النواة.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <h3 className="font-semibold mb-3">آليات التشغيل البيني</h3>
          <ul className="text-sm text-muted-foreground space-y-2.5">
            <li><span className="text-foreground font-medium" dir="ltr">C ABI</span> — كل دالة Aegis تُصدَّر بدالة C عادية. تستطيع C/Python/Rust استدعاءها مباشرة.</li>
            <li><span className="text-foreground font-medium" dir="ltr">extern "C"</span> — استدعاء دوال C من Aegis داخل كتلة unsafe صريحة.</li>
            <li><span className="text-foreground font-medium">WebAssembly</span> — هدف ترجمة أول. يعمل في المتصفح وعبر WASI.</li>
            <li><span className="text-foreground font-medium">Python</span> — عبر C-ABI + pyo3-style bindings؛ استدعاء Aegis كوحدة Python.</li>
            <li><span className="text-foreground font-medium">JavaScript</span> — عبر WASM + wasm-bindgen-style glue.</li>
            <li><span className="text-foreground font-medium">Rust</span> — عبر C-ABI (Rust يُصدِّر extern "C").</li>
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <h3 className="font-semibold mb-3">استراتيجية الهجرة التدريجية</h3>
          <ol className="text-sm text-muted-foreground space-y-2.5 list-decimal pr-5">
            <li><span className="text-foreground">وحدة أجنبية واحدة:</span> اكتب ميزة جديدة في Aegis، صادِرها كـ C-ABI، استدعِها من القاعدة الحالية.</li>
            <li><span className="text-foreground">نقاط ساخنة آمنة:</span> أعد كتابة الأجزاء الحساسة أمنياً (تحليل الإدخال، تشفير، شبكة) أولاً.</li>
            <li><span className="text-foreground">طبقة بطبقة:</span> كل وحدة تُهاجر تصبح نقطة دخول لاستدعاء وحدات Aegis أخرى.</li>
            <li><span className="text-foreground">تبنٍّ كامل عند النضج:</span> عندما تصبح أداة Aegis ناضجة، أعد كتابة القشرة أخيراً.</li>
          </ol>
        </div>
      </div>
      <CodeBlock
        filename="interop.aegis"
        code={`// Aegis يستدعي C
extern "C" unsafe {
    fn strlen(s: *const u8) -> usize
}

// Aegis يُصدِّر لـ C / Python / Rust
#[export: C]
fn hash_password(pw: String, salt: String) -> String {
    // شيفرة آمنة بالكامل، مُصدَّرة بدالة C عادية
    crypto::argon2(pw, salt)
}`}
      />
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <AlertTriangle className="h-4 w-4 text-amber-400 mb-2" />
        <p className="text-sm leading-relaxed">
          <span className="font-medium">حدّ صادق:</span> استدعاء C عبر
          <span dir="ltr" className="font-mono"> extern "C" unsafe</span> يخرق
          ضمانات الأمان داخل تلك الكتلة فقط — لا خارجها. لا يمكن لأي لغة تتفاعل
          مع C أن تضمن أمان كود C نفسه. هذا حدّ جوهري للتوافق مع الإرث، وليس عيباً
          في التصميم.
        </p>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 10. Stdlib */
function StdLib() {
  const ships = ["collections (Vec, Map, Set, Queue)", "result + option + match", "channels + actors", "crypto (argon2, ed25519, aes-gcm, chacha20)", "net (http client/server, tcp, tls)", "fs (path-safe, capability-bound)", "json, toml, yaml, csv parsers", "regex (RE2-safe, no ReDoS)", "time, duration, clocks", "formatting (typed, no printf)", "hashing (sha2, sha3, blake3)", "process (structured exec, no shell)"];
  const external = ["web frameworks", "ORM / DB drivers", "ML / tensor ops", "GUI toolkits", "game engines", "protobuf / grpc codegen", "cloud SDKs"];
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        المكتبة القياسية صغيرة لكنها متماسكة: كل ما يحتاجه المبتدئ للبدء، وكل ما
        يحتاجه الخبير للأمان الأساسي. ما عدا ذلك يُترك للحزم — وهذا متعمّد، لتجنّب
        تضخّم stdlib مثل Python.
      </p>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> يُشحن مع اللغة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {ships.map((s) => (
              <div key={s} className="text-xs font-mono text-muted-foreground" dir="ltr">{s}</div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Boxes className="h-4 w-4 text-muted-foreground" /> يُترك للحزم</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {external.map((s) => (
              <div key={s} className="text-xs font-mono text-muted-foreground" dir="ltr">{s}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">المبدأ:</span> كل ما يلمس
        الأمان (crypto، regex، parsing، process) <span className="text-foreground">يجب</span>
        أن يكون في stdlib لضمان المراجعة. كل ما هو تفضيل بنيوي (إطار ويب، ORM)
        <span className="text-foreground"> يجب</span> أن يكون خارجها لتجنّب الجمود.
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 11. Tooling */
function Tooling() {
  const tools = [
    { icon: Terminal, t: "المُترجم", d: "أمامي (parser + type checker + capability analyzer) في Rust؛ خلفي يُولّد LLVM IR و WASM. وضع تفسير سريع للتطوير." },
    { icon: Boxes, t: "مدير الحزم", d: "aegis — تثبيت، نشر موقّع، تدقيق، تثبيت بالتجزئة، توليد SBOM. مدمج لا منفصل." },
    { icon: Wrench, t: "المُنسّق", d: "aegis fmt — تنسيق قاطع بلا خيارات (مثل gofmt). ينهي نقاشات الأسلوب." },
    { icon: FileCode2, t: "LSP / IDE", d: "خادم لغة كامل (تشخيصات، إكمال، إعادة هيكلة، عرض الصلاحيات). إضافات VSCode/JetBrains." },
    { icon: ShieldCheck, t: "مدقّق الأمان", d: "aegis lint — يكشف الأنماط الخطرة (eval، shell، unsafe غير مُعلَّل) ويعطي بديلاً آمناً." },
    { icon: CheckCircle2, t: "خطاف التحقق الرسمي", d: "تكامل اختياري مع Lean/Coq عبر تصدير مواصفات SPARK-style. للأنظمة الحرجة فقط." },
  ];
  return (
    <Wrap className="space-y-6">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((t, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-5">
            <t.icon className="h-5 w-5 text-emerald-400 mb-2" />
            <h3 className="font-semibold text-sm mb-1.5">{t.t}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.d}</p>
          </div>
        ))}
      </div>
      <CodeBlock
        filename="toolchain.sh"
        code={`$ aegis build --release --target wasm       # ترجمة إلى WASM
$ aegis run main.aegis                       # تشغيل تفسيري سريع
$ aegis test                                 # اختبارات مدمجة
$ aegis audit                                # فحص سلسلة التوريد
$ aegis fmt                                  # تنسيق
$ aegis verify --lean proof.lean             # تحقق رسمي (اختياري)
$ aegis lsp                                  # خادم لغة`}
      />
    </Wrap>
  );
}

/* --------------------------------------------------- 12. Reference impl */
function ReferenceImpl() {
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        هذه ليست مجرّد وثيقة — المفسّر أدناه <span className="text-foreground">حقيقي ويعمل الآن</span>.
        مكتوب من الصفر في TypeScript (محلّل نحوي + محلّل أمن + مقيّم). جرّب
        الأمثلة، أو اكتب شيفرتك. كل محاولات الاستغلال تُرفض بفشل آمن ورسالة دقيقة.
      </p>
      <div className="rounded-xl border border-emerald-500/30 bg-card aegis-glow p-4">
        <Playground />
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Bug className="h-4 w-4 text-rose-400" /> مجموعة اختبارات الاستغلال الخمسة</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          خمس محاولات استغلال كلاسيكية مكتوبة كشيفرة Aegis. اختر أيّاها من قائمة
          «الأمثلة» أعلاه (الموسومة بأيقونة الدرع الأحمر) وشغّلها — سترى أنها
          تُرفض قبل التنفيذ أو تُعطى قيمة آمنة بدل السلوك الخطِر:
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            ["تجاوز الحد", "buf[100] => None، لا قراءة ذاكرة"],
            ["Use-after-free", "malloc/free غير موجودين"],
            ["حقن SQL", "db.query(string) مرفوض"],
            ["حقن أوامر", "shell.run(string) مرفوض"],
            ["سباق بيانات", "static mut مرفوض"],
            ["إلغاء فارغ", "null غير موجود"],
            ["فيض عدد", "Err بدل التفاف صامت"],
            ["صلاحية محيطة", "fs.read بلا Cap مرفوض"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
              <div className="text-xs font-medium mb-0.5" dir="ltr">{k}</div>
              <div className="text-[11px] text-muted-foreground">{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <AlertTriangle className="h-4 w-4 text-amber-400 mb-2" />
        <p className="text-sm leading-relaxed">
          <span className="font-medium">حدود هذا التنفيذ المرجعي:</span> هو
          تفسيري (tree-walking)، يدعم مجموعة فرعية فقط، ويُحاكي فحص الملكية لـ
          spawn بدل borrow checker كامل. الغرض تعليمي/توضيحي للخصائص الأمنية،
          ليس إنتاجياً. التنفيذ الإنتاجي يكون بـ Rust + LLVM.
        </p>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 13. Comparison */
function Comparison() {
  const cols = ["Aegis", "Python", "JavaScript", "Rust", "Go", "C"];
  const rows: [string, string[]][] = [
    ["منحنى التعلّم", ["متدرّج (سهل ثم قوي)", "سهل جداً", "سهل", "حادّ", "متوسط", "حادّ"]],
    ["الأداء", ["قريب من Rust (LLVM)", "بطيء (تفسيري)", "JIT متوسط", "سريع جداً", "سريع", "سريع جداً"]],
    ["أمان الذاكرة", ["مُلغى بالبناء", "GC (آمن)", "GC (آمن)", "مُلغى بالبناء", "GC (آمن)", "غير آمن ❌"]],
    ["أمان الإدخال", ["مُلغى (حقن مستحيل)", "مسؤولية المكتبة", "مسؤولية المكتبة", "مسؤولية المكتبة", "مسؤولية المكتبة", "غير آمن ❌"]],
    ["السباقات", ["مستحيلة بالبناء", "GIL يخفّف", "مفرد-خيط", "مستحيلة بالبناء", "Detector (race detector)", "ممكنة ❌"]],
    ["الصلاحيات", ["نظام أنواع", "ثقة كاملة", "ثقة كاملة", "ثقة كاملة", "ثقة كاملة", "ثقة كاملة"]],
    ["نضج البيئة", ["وليد ⚠️", "ناضج جداً", "ناضج جداً", "ناضج", "ناضج جداً", "ناضج جداً"]],
    ["أداة التحقق الرسمي", ["مخطّط (Lean)", "نادر", "نادر", "محدود (Prusti)", "لا", "Frama-C (منفصل)"]],
  ];
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        مقارنة صادقة. نذكر أين تفوق Aegis، وأين لا تزال أضعف — خاصةً حجم البيئة
        الأولي ونضج الأدوات، وهو ما لا يحلّه إلا الوقت.
      </p>
      <div className="rounded-xl border border-border overflow-hidden overflow-x-auto scroll-thin">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="px-4 py-3 font-semibold border-b border-border">المعيار</th>
              {cols.map((c) => (
                <th key={c} className="px-4 py-3 font-semibold border-b border-border text-center">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, vals], i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{k}</td>
                {vals.map((v, j) => (
                  <td key={j} className={`px-4 py-3 text-center text-xs ${j === 0 ? "text-emerald-300 font-medium" : "text-muted-foreground"}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> أين تتفوّق Aegis</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pr-5">
            <li>أمان الإدخال (حقن SQL/أوامر) مُلغى بالبناء — لا توجد لغة أخرى تفعل ذلك.</li>
            <li>الصلاحيات كأنواع — لا توجد لغة شائعة تفعل ذلك.</li>
            <li>منحنى تعلّم متدرّج مع أمان Rust (Rust نفسها حادّة).</li>
            <li>هدف WASM أولي + C-ABI = تشغيل بيني شامل.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><XCircle className="h-4 w-4 text-rose-400" /> أين لا تزال أضعف</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pr-5">
            <li>حجم البيئة الأولي — صفر مقابل ملايين حزم npm/PyPI.</li>
            <li>نضج الأداة — المُترجم الإنتاجي غير مكتمل بعد.</li>
            <li>التحقق الرسمي — مخطّط، ليس مكتمل مثل SPARK.</li>
            <li>المواهب — قلّة مطوّرين متمكّنين في البداية.</li>
          </ul>
        </div>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 14. Progressive */
function Progressive() {
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        نفس المهمة مكتوبة بطريقتين. المسار المبتدئ يستخدم الافتراضات الآمنة
        (منطقة مُدارة، صلاحيات ضمنية للسكربت). المسار الخبير يتحكّم يدوياً في
        الذاكرة ويحدّد الصلاحيات بدقّة. <span className="text-foreground">الآلية
        التي تبقي البسيط بسيطاً دون إخفاء تعقيد الخبير</span> هي الإفصاح المتدرّج:
        كل ميزة متقدّمة تتطلب كلمة مفتاحية صريحة.
      </p>
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">المسار المبتدئ</Badge>
            <span className="text-xs text-muted-foreground">بسيط كـ Python</span>
          </div>
          <CodeBlock
            filename="beginner.aegis"
            code={`// سكربت بسيط: اقرأ، عالّج، اطبع
// المنطقة المُدارة تتكفّل بالذاكرة
// والصلاحيات ضمنية للسكربتات
managed script {
    let data = fs.read("input.txt")
    let lines = data.split("\\n")
    for line in lines {
        print(line.upper())
    }
}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15">المسار الخبير</Badge>
            <span className="text-xs text-muted-foreground">تحكّم كامل وصريح</span>
          </div>
          <CodeBlock
            filename="expert.aegis"
            code={`// نفس المهمة، تحكّم كامل:
// - ملكية صريحة (بلا GC)
// - صلاحية FS للقراءة فقط ومقيّدة بمسار
// - معالجة أخطاء صريحة
fn main(env: Cap) -> Result<(), String> {
    let fs = env.fs.restrict("read:./input.txt")
    let data: String = fs.read("input.txt")?

    // ملكية: data تُستهلك في split
    let lines: Vec<String> = data.split("\\n")

    for line in &lines {           // استعارة غير قابلة للتغيير
        print(line.upper())
    }
    Ok(())
}`}
          />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-5">
        <h3 className="font-semibold mb-3">الآلية التي تبقي البسيط بسيطاً</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-emerald-400 mb-1">الكلمات المفتاحية الصريحة</div>
            <p className="text-muted-foreground text-xs leading-relaxed">كل خروج عن الافتراض الآمن يتطلب كلمة: <span dir="ltr" className="font-mono">managed, unsafe, restrict, &mut</span>. لا شيء يُفعَّل بالخطأ.</p>
          </div>
          <div>
            <div className="font-medium text-emerald-400 mb-1">أوضاع التشغيل</div>
            <p className="text-muted-foreground text-xs leading-relaxed"><span dir="ltr" className="font-mono">aegis script</span> للسكربتات (صلاحيات ضمنية)، <span dir="ltr" className="font-mono">aegis build</span> للتطبيقات (صلاحيات صريحة). المبتدئ لا يرى الثانية.</p>
          </div>
          <div>
            <div className="font-medium text-emerald-400 mb-1">الاستنتاج يحمل العبء</div>
            <p className="text-muted-foreground text-xs leading-relaxed">الأنواع، العمر، الأثر — كلها مُستنتجة. المبتدئ لا يكتبها، الخبير يستطيع تقييدها صراحةً عند الحاجة.</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
        <AlertTriangle className="h-4 w-4 text-amber-400 mb-2" />
        <p className="text-sm leading-relaxed">
          <span className="font-medium">حدّ صادق:</span> تعقيد النوى وأنظمة الوقت
          الحقيقي وشيفرة الأداء اليدوي <span className="text-foreground">لا يمكن
          إخفاؤه بالكامل</span>. ما نفعله هو جعله <span className="text-foreground">اختيارياً
          لا إلزامياً</span> من السطر الأول — لا إخفاؤه. من يكتب نواة سيتعلّم
          الملكية والـ unsafe؛ لكن من يكتب سكربت تحليل بيانات لن يحتاجها أبداً.
        </p>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 15. Adoption */
function Adoption() {
  const phases = [
    { y: "السنة 1-2", t: "التشغيل البيني أولاً", d: "Aegis كـ C-ABI مُستدعى من Python/JS/Rust. فِرق تكتب وحدات جديدة حرجة أمنياً (تشفير، تحليل إدخال) في Aegis وتستدعيها من قاعدتها الحالية.", domains: "أمن، تشفير، أدوات CLI" },
    { y: "السنة 2-4", t: "النطاق الأمني", d: "يصبح الخيار الافتراضي للمكونات التي يهمّ فيها الأمان بالبناء: بوابات API، محلّلات البروتوكولات، وحدات معالجة الإدخال غير الموثوق.", domains: "شبكات، بروتوكولات، بوابات" },
    { y: "السنة 3-5", t: "الأنظمة المضمّنة والخوادم", d: "بعد نضج خلفية LLVM، يدخل الأنظمة المضمّنة (حيث أمان الذاكرة حرج) وخوادم الويب عالية الأداء.", domains: "مضمّن، خوادم، IoT" },
    { y: "السنة 5-8", t: "مكوّنات النواة", d: "على غرار دخول Rust إلى Linux، يدخل Aegis كمكوّنات نواة جديدة (سوّاقات، أنظمة ملفات) مع C-ABI.", domains: "نواة، سوّاقات، OS" },
    { y: "السنة 8+", t: "تطبيقات واسعة", d: "مع نضج البيئة، يصبح خياراً معقولاً للتطبيقات العامة. لا يُزيح C/Rust دفعة واحدة أبداً — بل يتشارك معها.", domains: "تطبيقات عامة، ويب، جوال" },
  ];
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        لا تزيل لغةٌ لغةً دفعة واحدة. التاريخ واضح: Java أخذت عقداً لإزاحة C++ في
        المؤسسات؛ TypeScript لم يُزل JavaScript بل طبّق عليها؛ Rust تدخل النواة
        قطعةً قطعة. هذه خارطة تبنٍّ <span className="text-foreground">نطاقاً
        بنطاق</span>، لا وعداً بالاستبدال الشامل.
      </p>
      <div className="space-y-3">
        {phases.map((p, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="md:w-32 shrink-0">
              <div className="text-xs font-mono text-emerald-400">{p.y}</div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{p.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.d}</p>
            </div>
            <div className="md:w-48 shrink-0">
              <div className="text-[11px] text-muted-foreground/70 mb-1">النطاقات</div>
              <div className="text-xs font-medium">{p.domains}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-5 text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">أول نطاق واقعي للهيمنة:</span> أدوات
        الأمان وتحليل الإدخال غير الموثوق. هنا يكون أمان الإدخال بالبناء ميزة
        تنافسية واضحة وفورية، وحجم البيئة المطلوب صغير، والاستدعاء عبر C-ABI
        سهل. من هذه النقطة، يتوسّع التبنّي عبر التشغيل البيني لا عبر الاستبدال.
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- 16. Build roadmap */
function BuildRoadmap() {
  const stages = [
    { p: "MVP (3-6 أشهر، فردي/ثنائي)", d: "محلّل + مُفسّر + فحص الصلاحيات + الأمثلة الأمنية. هذا ما تراه يعمل الآن. الهدف: إثبات المفهوم الأمني، لا الإنتاج.", status: "تم" },
    { p: "المرحلة 1 (6-12 شهر، فريق صغير)", d: "مُترجم أمامي في Rust، توليد C-ABI، مدير حزم بدائي موقّع، LSP أساسي، مستندات.", status: "التالي" },
    { p: "المرحلة 2 (1-2 سنة)", d: "خلفية LLVM، borrow checker كامل، WASM target، مكتبة قياسية ناضجة، أول حزم إنتاجية.", status: "مخطّط" },
    { p: "المرحلة 3 (2-4 سنوات)", d: "أداة تدقيق الحزم، تكامل التحقق الرسمي (Lean)، تحسينات أداء، بيئة حزم متنامّية.", status: "مخطّط" },
    { p: "المرحلة 4 (4-9 سنوات)", d: "نضج الإنتاج: مكوّنات نواة، أنظمة حرجة معتمدة. هذا الإطار الزمني يطابق seL4 (~9 سنوات لفريق مركّز للتحقق الكامل).", status: "بعيد" },
  ];
  return (
    <Wrap className="space-y-6">
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        seL4 — نواة مُتحقَّق منها رياضياً — استغرقت فريقاً مركّزاً نحو 9 سنوات.
        لا نعد بما هو أقل واقعية. أدناه خارطة مراحل، مع أصغر MVP مفيد يمكن لفرد
        أو فريق صغير بناءه أولاً.
      </p>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-card/50 p-4 flex items-start gap-4">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-muted border border-border shrink-0 font-mono text-xs">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-sm">{s.p}</h3>
                {s.status === "تم" && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15">منجَز</Badge>}
                {s.status === "التالي" && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/15">التالي</Badge>}
                {s.status === "مخطّط" && <Badge variant="outline" className="text-muted-foreground">مخطّط</Badge>}
                {s.status === "بعيد" && <Badge variant="outline" className="text-muted-foreground">بعيد المدى</Badge>}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <h3 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> أصغر MVP مفيد</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          ما تراه في هذه الصفحة هو ذاك MVP: مُفسّر لمجموعة فرعية، يُثبت أن
          الخصائص الأمنية قابلة للتنفيذ والاختبار. يمكن لفرد واحد بناؤه في 3-6
          أشهر. قيمته ليست الإنتاج بل:
        </p>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pr-5">
          <li>إثبات أن الأمان بالبناء قابل للتعبير بلغة مألوفة.</li>
          <li>قابلية عرض الخصائص للمجتمع وجذب مساهمين.</li>
          <li>قاعدة اختبار للأفكار الدلالية قبل استثمار خلفية LLVM.</li>
        </ul>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- Coda */
function Coda() {
  return (
    <Wrap className="pt-16 pb-8">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-emerald-500/5 to-transparent p-8 text-center">
        <Shield className="h-10 w-10 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-3">الصدق هو ما يجعل التصميم قابلاً للبناء</h2>
        <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-6">
          Aegis لا تزعم الإصلاح الكامل. تزعم أن فئات محدّدة من الثغرات — أكثرها
          شيوعاً في C/C++ — تصبح مستحيلة التعبير، مع الحفاظ على سهولة التعلّم
          وقوة شاملة عبر التشغيل البيني. الباقي مسؤولية البشر والعِتاد والوقت.
        </p>
        <a href="#reference" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors">
          <ArrowLeft className="h-4 w-4" /> عُد إلى المفسّر التفاعلي
        </a>
      </div>
    </Wrap>
  );
}

/* --------------------------------------------------- Footer */
function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center h-7 w-7 rounded-md bg-emerald-500/15 border border-emerald-500/30">
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="font-mono font-semibold text-sm">Aegis</div>
              <div className="text-[11px] text-muted-foreground">تصميم لغة · RFC v0.1 · مفسّر مرجعي يعمل</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>بُني بـ Next.js + TypeScript</span>
            <span className="h-3 w-px bg-border" />
            <span>المفسّر من الصفر، بلا تبعيات</span>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-border text-[11px] text-muted-foreground/70 leading-relaxed">
          هذه وثيقة تصميمية تعليمية مع تنفيذ مرجعي توضيحي. ليست لغة إنتاجية جاهزة.
          الاستشهادات: seL4 (متحقَّق منها رياضياً، ~9 سنوات)، Rust (borrow checker،
          حصيلة CVEs الذاكرية)، SPARK/Ada (إثبات غياب أخطاء وقت التشغيل)، Deno/WASM
          (نموذج الصلاحيات)، Erlang (actors)، Go (channels).
        </div>
      </div>
    </footer>
  );
}
