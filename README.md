# Loan NPL

Loan NPL нь тохируулсан Google Sheet-ийн бүх баганыг шууд уншиж, хугацаа хэтрэлт болон харилцагчийн эрсдэлийг харуулах хамгаалалттай веб апп юм. Excel upload/import урсгал байхгүй.

## Технологи

- Next.js 16, React 19, TypeScript
- Tailwind CSS 4, shadcn/ui, Radix, Lucide
- Supabase email/password болон Google OAuth authentication
- Google Sheets API read-only холболт

## Маршрутууд

- `/login` — нэвтрэх
- `/` — `/overdue` руу шууд шилжих үндсэн хаяг
- `/overdue` — хугацаа хэтрэлтийн бүтэн веб самбар
- `/dashboard` — зөвхөн харах зориулалттай тусдаа dark dashboard
- `/auth/callback` — Google OAuth code exchange

Бүх самбар Supabase нэвтрэлтээр хамгаалагдсан.

Production: [https://loan-npl.vercel.app](https://loan-npl.vercel.app)

## Google Sheets өгөгдлийн урсгал

`Хугацаа хэтрэлт онтайм` Google Sheet нь үндсэн мэдээллийн эх сурвалж. Апп нь бүх баганыг уншиж, харагдаж байгаа үед 1 минут тутам, цонх дахин идэвхжихэд болон сүлжээ сэргэхэд шинэчилнэ. Алдаа гарвал шалгах зайг нэмэгдүүлж, өмнөх өгөгдлийг алдааны төлөвтэй харуулна. Service account уншилтыг сервер бүрд 10 секунд хүртэл хамтран ашиглана. Апп хаалттай үед ажиллах тусдаа синк эсвэл Google push webhook байхгүй.

Огноо, төлөв, тайлбар зэрэг бүх засварыг Google Sheet дээр хийнэ. Дэлгэрэнгүй лист нь L болон шинээр нэмсэн бүх баганыг зөвхөн харах байдлаар харуулна. Өмнөх аппын тэмдэглэлүүдийг устгахгүй; тэдгээрийн хадгалалтыг шинэ урсгалд ашиглахгүй.

Үндсэн tab-ийг CIF, `Харилцагчийн нэр`, `Утас` баганын нэрээр танина. Ижил CIF = нэг харилцагч; CIF дутуу мөрийг нэр, утсаар нэгтгэхгүй.

`Нийт төлбөрийн дүн` KPI = L баганад `Төлсөн` болоогүй (хоосон болон бусад төлөвтэй) мөрүүдийн I баганын нийлбэр. Тухайн мөр `Төлсөн` болоход дүн нь энэ KPI-с хасагдаж, `Зөрчил арилгасан дүн` KPI-д орно. Нэг CIF-ийн мөрүүдийг төлөв бүрээр нь тооцно; түүхэн KPI ч тухайн үеийн төлөвөөр тооцогдоно.

`Зөрчил арилгасан дүн` = `Төлөв` нь `Төлсөн` байгаа мөрүүдийн `Нийт төлбөрийн дүн` (I) нийлбэр. Нэг CIF-ийн төлөөгүй бусад зээлийг тооцохгүй. Дүнг төгрөгөөр харуулна; шүүлтүүр үйлчилнэ. Давтан синкээр давхар нэмэхгүй, Sheet-ийн одоогийн төлөвөөс дахин тооцно. Мөр хасагдах/төлөв өөрчлөгдөхөд одоогийн KPI дагаж өөрчлөгдөнө; өмнөх дүнг өөрчлөлтийн түүхээс харна.

`Төлөгдөж байгаа` KPI нь CIF бүрийн хамгийн өндөр хадгалсан I нийлбэрээс одоогийн I нийлбэрийг хассан эерэг зөрүү. I дүн өмнөх сууриас өсвөл өссөн дүнг шинэ суурь болгоно. 5 сая → 7 сая → 6 сая бол 0 → 0 → 1 сая; цааш 5 сая бол 2 сая, буцаад 6.5 сая бол 0.5 сая. Давтан синкээр нэмж хуримтлуулахгүй. L төлөвөөс үл хамааран I өөрчлөлтийг тооцно.

Анхны дүнг хэрэглэгч, Sheet, CIF бүрээр `sheet_payment_baselines` хүснэгтэд өөрчлөх боломжгүйгээр хадгалж, өссөн суурийг `high_water_amount` / `high_water_at` талбарт тусад нь бүртгэнэ. Шинэ суурийг эхлүүлэхдээ анхны, хамгийн сүүлийн хадгалсан тохирох эх мэдээллийн, одоогийн хүчинтэй дүнгийн хамгийн ихийг ашиглана. Суурь буурахгүй; зэрэг шинэчлэлтүүд хамгийн өндөр дүнг хадгална. CIF-ийн зээлийн мөр нэмэгдэх/хасагдах, зээлийн анхны мэдээлэл өөрчлөгдөх үед автоматаар төлөлт гэж үзэхгүй, шалгах шаардлагатайг харуулна. Тухайн үеийн суурь, зөрүү түүхэн хувилбарт хадгалагдана. Өмнөх түүхэн хувилбаруудыг дахин тооцохгүй. Хуучин түүхэнд энэ үзүүлэлт байхгүй бол “—” харагдана.

Анхны амжилттай уншсан Sheet болон автомат шалгалтаар илэрсэн дараагийн өөрчлөлт бүрийн бүх баганатай хувилбарыг Supabase-ийн хэрэглэгчээр тусгаарласан `sheet_snapshot_history` хүснэгтэд хадгална. Өмнөх төлөв рүү буцсан өөрчлөлтийг шинэ хугацаагаар бүртгэж, дараалсан ижил шалгалтыг давхар хадгалахгүй. Хадгалалт амжилтгүй бол самбарт мэдэгдэнэ. Шалгалтын хооронд үүсээд буцсан өөрчлөлтийг бүртгэх баталгаа байхгүй.

## Нууцлал

- Бодит харилцагчийн өгөгдлийг `public/` дотор байрлуулж эсвэл source control-д commit хийж болохгүй.
- `.env.local`, нууц үг, Supabase secret/service-role түлхүүрийг commit хийхгүй.
- Одоогийн өгөгдөл browser memory-д, өөрчлөлтийн түүх Supabase-д RLS хамгаалалттай хадгалагдана.

## Суулгах ба ажиллуулах

Шаардлага: Node.js 22+ болон pnpm 11+.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

`http://localhost:3000` хаягийг нээнэ. Нэвтрээгүй хэрэглэгч `/login` руу шилжинэ.

## Орчны хувьсагч

`.env.example`-ийг `.env.local` болгон хуулж Supabase-ийн public утгуудыг оруулна:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY`-ийг түр нийцлийн fallback болгон дэмждэг. Privileged түлхүүрийг `NEXT_PUBLIC_` хувьсагчид хэзээ ч хийж болохгүй.

## Google нэвтрэлт ба Sheets тохиргоо

1. Google Cloud project дээр Google Sheets API-г идэвхжүүлнэ.
2. Google Auth Platform дээр Web application OAuth client үүсгэнэ.
3. Authorized JavaScript origins хэсэгт `http://localhost:3000` болон production origin-ийг нэмнэ.
4. Authorized redirect URI хэсэгт Supabase Dashboard-ийн Google provider callback URL-г нэмнэ.
5. Supabase Dashboard → Authentication → Providers → Google хэсэгт Client ID, Client Secret-ээ оруулна.
6. Supabase URL Configuration redirect allow list-д `http://localhost:3000/auth/callback` болон `https://loan-npl.vercel.app/auth/callback`-г нэмнэ.
7. Google consent screen-ийн Data Access хэсэгт `openid`, email, profile болон `https://www.googleapis.com/auth/spreadsheets.readonly` scope-ийг зөвшөөрнө.

Google Client Secret-ийг application-ийн public environment variable эсвэл source code-д хийж болохгүй; Supabase provider тохиргоонд хадгална.

### Автомат server sync

Бүх нэвтэрсэн хэрэглэгчид Google-ээр тусдаа нэвтрэхгүйгээр live Sheet-ийг уншуулах бол Google Cloud service account үүсгээд Sheet-ээ тухайн service account email-д `Viewer` эрхээр share хийнэ. Дараах хоёр server-only утгыг `.env.local` болон Vercel environment settings-д оруулна:

```bash
GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL=loan-npl-reader@your-project.iam.gserviceaccount.com
GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY=<private-key-pem>
```

Эдгээр утгыг `NEXT_PUBLIC_` нэртэй хувьсагчид хийж, source code-д commit хийж болохгүй. Service account тохируулаагүй үед апп тухайн хэрэглэгчийн Google OAuth Sheets эрхийг fallback болгон ашиглана. Codex-ийн Google Drive plugin холболт нь web app-ийн runtime credential биш.

## Шалгалт

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Дараагийн зөв алхам

Google Sheet нь хугацаа хэтрэлтийн live source of truth боловч relational constraints, RLS болон transactional write бүхий Supabase database биш. Талбаруудын бизнес утга, мөнгөн дүнгийн нэгж, харилцагчийг найдвартай таних түлхүүр, эрсдэлийн босгыг баталгаажуулсны дараа versioned Supabase schema, RLS, sync history болон байнгын хадгалалтыг нэмж болно.
