import { db, setMeta, getMeta, syncState } from './db';
import { uid, round2, pad } from '../lib/util';
import { ean13CheckDigit } from '../lib/barcode';
import { hashPin } from '../store/auth';

const CATS = [
  ['novels', 'Novels & fiction', 'නවකතා සහ කෙටිකතා', 'novel', '#8C1C3A'],
  ['children', "Children's books", 'ළමා පොත්', 'childbook', '#B02A4C'],
  ['school', 'School books & guides', 'පාසල් පොත් සහ මාර්ගෝපදේශ', 'workbook', '#1F2A5C'],
  ['papers', 'Past papers', 'ප්‍රශ්න පත්‍ර', 'pastpaper', '#3D4C92'],
  ['reference', 'Dictionaries & reference', 'ශබ්දකෝෂ සහ විමර්ශන', 'dictionary', '#2D3A79'],
  ['religion', 'Religious books', 'ආගමික පොත්', 'religion', '#C4840C'],
  ['exercise', 'Exercise books', 'අභ්‍යාස පොත්', 'exercisebook', '#138A6C'],
  ['paper', 'Paper & boards', 'කඩදාසි සහ බෝඩ්', 'paper', '#0E7058'],
  ['writing', 'Pens & pencils', 'පෑන් සහ පැන්සල්', 'pen', '#5E6DAF'],
  ['art', 'Art & colours', 'චිත්‍ර සහ පාට', 'colours', '#9A640C'],
  ['office', 'Office & files', 'කාර්යාල ද්‍රව්‍ය', 'file', '#744B0E'],
  ['supplies', 'School supplies', 'පාසල් උපකරණ', 'schoolbag', '#6E1530'],
  ['gifts', 'Gifts, cards & toys', 'තෑගි සහ සෙල්ලම් බඩු', 'gift', '#0B5A47'],
  ['magazines', 'Magazines & newspapers', 'සඟරා සහ පුවත්පත්', 'magazine', '#4E330C'],
  ['services', 'Photocopy & services', 'ෆොටෝ කොපි සහ සේවා', 'photocopy', '#172046'],
];

// [en, si, cat, icon, unit, cost, price, mrp, types, colours, extra, supplierIdx]
//   types / colours: a name, or [name, cost, price] when that line has its own price
//   extra: { author, brand (publisher or maker), language, grade, subject, edition, service }
const SI = 'Sinhala'; const EN = 'English';
const PRODUCTS = [
  // ---- novels & fiction ----
  ['Madol Doova', 'මඩොල් දූව', 'novels', 'novel', 'pcs', 455, 650, 0, null, null, { author: 'Martin Wickramasinghe', brand: 'Lakbima Books', language: SI }, 0],
  ['Gamperaliya', 'ගම්පෙරළිය', 'novels', 'novel', 'pcs', 665, 950, 0, null, null, { author: 'Martin Wickramasinghe', brand: 'Lakbima Books', language: SI }, 0],
  ['Viragaya', 'විරාගය', 'novels', 'novel', 'pcs', 595, 850, 0, null, null, { author: 'Martin Wickramasinghe', brand: 'Lakbima Books', language: SI }, 0],
  ['Amba Yahaluwo', 'අඹ යහළුවෝ', 'novels', 'novel', 'pcs', 385, 550, 0, null, null, { author: 'T. B. Ilangaratne', brand: 'Lakbima Books', language: SI }, 0],
  ['Golu Hadawatha', 'ගොළු හදවත', 'novels', 'novel', 'pcs', 420, 600, 0, null, null, { author: 'Karunasena Jayalath', brand: 'Lakbima Books', language: SI }, 0],
  ['Hath Pana', 'හත් පණ', 'novels', 'novel', 'pcs', 245, 350, 0, null, null, { author: 'Kumaratunga Munidasa', brand: 'Lakbima Books', language: SI }, 0],
  ['Magul Kema', 'මඟුල් කෑම', 'novels', 'novel', 'pcs', 225, 320, 0, null, null, { author: 'Kumaratunga Munidasa', brand: 'Lakbima Books', language: SI }, 0],
  ['The Village in the Jungle', 'බැද්දේගම (ඉංග්‍රීසි)', 'novels', 'novel', 'pcs', 840, 1200, 0, null, null, { author: 'Leonard Woolf', brand: 'Island Classics', language: EN }, 0],
  ['Oliver Twist (abridged)', 'ඔලිවර් ට්විස්ට් (සංක්ෂිප්ත)', 'novels', 'novel', 'pcs', 335, 480, 0, null, null, { author: 'Charles Dickens', brand: 'Island Classics', language: EN }, 0],
  ['Sherlock Holmes: selected stories', 'ෂර්ලොක් හෝම්ස් තෝරාගත් කතා', 'novels', 'novel', 'pcs', 525, 750, 0, null, null, { author: 'Arthur Conan Doyle', brand: 'Island Classics', language: EN }, 0],
  ['Treasure Island (Sinhala translation)', 'නිධන් දූපත', 'novels', 'novel', 'pcs', 400, 580, 0, null, null, { author: 'R. L. Stevenson', brand: 'Lakbima Books', language: SI }, 0],
  // ---- children ----
  ['Jataka stories for children', 'ළමා ජාතක කතා', 'children', 'childbook', 'pcs', 300, 450, 0, null, null, { brand: 'Vidya Kids', language: SI }, 1],
  ["Aesop's fables (Sinhala)", 'ඊසොප්ගේ උපමා කතා', 'children', 'childbook', 'pcs', 270, 400, 0, null, null, { brand: 'Vidya Kids', language: SI }, 1],
  ['Sinhala alphabet book (Hodiya)', 'සිංහල හෝඩිය', 'children', 'childbook', 'pcs', 110, 180, 0, null, null, { brand: 'Vidya Kids', language: SI, grade: 'Pre-school' }, 1],
  ['My first ABC colouring book', 'ABC පාට කිරීමේ පොත', 'children', 'childbook', 'pcs', 160, 250, 0, null, null, { brand: 'Vidya Kids', language: EN, grade: 'Pre-school' }, 1],
  ['Nursery rhymes with pictures', 'ළදරු ගී පොත', 'children', 'childbook', 'pcs', 190, 300, 0, null, null, { brand: 'Vidya Kids', language: EN, grade: 'Pre-school' }, 1],
  ['Andare stories', 'අන්දරේ කතා', 'children', 'childbook', 'pcs', 215, 320, 0, null, null, { brand: 'Vidya Kids', language: SI }, 1],
  // ---- school books & guides ----
  ['Grade 5 scholarship exam guide', '5 ශ්‍රේණිය ශිෂ්‍යත්ව මාර්ගෝපදේශය', 'school', 'examguide', 'pcs', 665, 950, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'Grade 5', subject: 'Scholarship', edition: '2027' }, 1],
  ['Grade 3 Environment workbook', '3 ශ්‍රේණිය පරිසරය වැඩපොත', 'school', 'workbook', 'pcs', 295, 420, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'Grade 3', subject: 'Environment' }, 1],
  ['Grade 6 Mathematics workbook', '6 ශ්‍රේණිය ගණිතය වැඩපොත', 'school', 'maths', 'pcs', 335, 480, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'Grade 6', subject: 'Mathematics' }, 1],
  ['O/L Mathematics revision', 'සා.පෙළ ගණිතය සංශෝධන', 'school', 'maths', 'pcs', 545, 780, 0, null, null, { author: 'S. Perera', brand: 'Vidya Educational', language: SI, grade: 'O/L', subject: 'Mathematics', edition: '2026' }, 1],
  ['O/L Science short notes', 'සා.පෙළ විද්‍යාව කෙටි සටහන්', 'school', 'science', 'pcs', 505, 720, 0, null, null, { author: 'K. Jayasuriya', brand: 'Vidya Educational', language: SI, grade: 'O/L', subject: 'Science', edition: '2026' }, 1],
  ['O/L English workbook', 'සා.පෙළ ඉංග්‍රීසි වැඩපොත', 'school', 'language', 'pcs', 455, 650, 0, null, null, { brand: 'Vidya Educational', language: EN, grade: 'O/L', subject: 'English' }, 1],
  ['O/L History question & answer', 'සා.පෙළ ඉතිහාසය ප්‍රශ්නෝත්තර', 'school', 'history', 'pcs', 420, 600, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'O/L', subject: 'History' }, 1],
  ['A/L Combined Maths: Pure', 'උ.පෙළ සංයුක්ත ගණිතය: ශුද්ධ', 'school', 'maths', 'pcs', 1015, 1450, 0, null, null, { author: 'D. Fernando', brand: 'Vidya Educational', language: SI, grade: 'A/L', subject: 'Combined Maths' }, 1],
  ['A/L Physics MCQ collection', 'උ.පෙළ භෞතික විද්‍යාව බහුවරණ', 'school', 'science', 'pcs', 875, 1250, 0, null, null, { author: 'R. Silva', brand: 'Vidya Educational', language: SI, grade: 'A/L', subject: 'Physics' }, 1],
  ['A/L ICT theory and practicals', 'උ.පෙළ තොරතුරු තාක්ෂණය', 'school', 'computer', 'pcs', 805, 1150, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'A/L', subject: 'ICT' }, 1],
  ['Sinhala essay book (Rachana)', 'සිංහල රචනා පොත', 'school', 'language', 'pcs', 265, 380, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'Grade 6-11', subject: 'Sinhala' }, 1],
  ['Spoken English practice', 'කථන ඉංග්‍රීසි පුහුණුව', 'school', 'language', 'pcs', 385, 550, 0, null, null, { brand: 'Island Classics', language: EN, subject: 'English' }, 0],
  // ---- past papers ----
  ['O/L past papers 2016-2025', 'සා.පෙළ පසුගිය ප්‍රශ්න පත්‍ර 2016-2025', 'papers', 'pastpaper', 'pcs', 385, 550, 0, ['Mathematics', 'Science', 'English', 'Sinhala', 'History'], null, { brand: 'Vidya Educational', language: SI, grade: 'O/L', edition: '2026' }, 1],
  ['A/L past papers 2016-2025', 'උ.පෙළ පසුගිය ප්‍රශ්න පත්‍ර 2016-2025', 'papers', 'pastpaper', 'pcs', 595, 850, 0, ['Biology', 'Physics', 'Chemistry', 'Combined Maths'], null, { brand: 'Vidya Educational', language: SI, grade: 'A/L', edition: '2026' }, 1],
  ['Grade 5 scholarship past papers', '5 ශ්‍රේණිය ශිෂ්‍යත්ව පසුගිය ප්‍රශ්න පත්‍ර', 'papers', 'pastpaper', 'pcs', 335, 480, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'Grade 5', subject: 'Scholarship', edition: '2026' }, 1],
  ['Grade 5 scholarship model papers (20)', '5 ශ්‍රේණිය ශිෂ්‍යත්ව ආදර්ශ ප්‍රශ්න පත්‍ර', 'papers', 'pastpaper', 'pcs', 280, 400, 0, null, null, { brand: 'Vidya Educational', language: SI, grade: 'Grade 5', subject: 'Scholarship' }, 1],
  // ---- reference ----
  ['English-Sinhala dictionary', 'ඉංග්‍රීසි-සිංහල ශබ්දකෝෂය', 'reference', 'dictionary', 'pcs', 1680, 2400, 0, null, null, { author: 'G. P. Malalasekera', brand: 'Lakbima Books', language: 'English / Sinhala' }, 0],
  ['Sinhala-English dictionary', 'සිංහල-ඉංග්‍රීසි ශබ්දකෝෂය', 'reference', 'dictionary', 'pcs', 1260, 1800, 0, null, null, { brand: 'Lakbima Books', language: 'Sinhala / English' }, 0],
  ['Pocket English dictionary', 'සාක්කු ඉංග්‍රීසි ශබ්දකෝෂය', 'reference', 'dictionary', 'pcs', 665, 950, 0, null, null, { brand: 'Island Classics', language: EN }, 0],
  ['School atlas of Sri Lanka', 'පාසල් සිතියම් පොත', 'reference', 'atlas', 'pcs', 595, 850, 0, null, null, { brand: 'Vidya Educational', language: SI, subject: 'Geography' }, 1],
  // ---- religion ----
  ['Dhammapada (Sinhala translation)', 'ධම්මපදය', 'religion', 'religion', 'pcs', 315, 450, 0, null, null, { brand: 'Lakbima Books', language: SI }, 0],
  ['Maha Pirith Potha', 'මහ පිරිත් පොත', 'religion', 'religion', 'pcs', 265, 380, 0, null, null, { brand: 'Lakbima Books', language: SI }, 0],
  ['Buddhist Jataka stories', 'පන්සිය පනස් ජාතක කතා (තෝරාගත්)', 'religion', 'religion', 'pcs', 840, 1200, 0, null, null, { brand: 'Lakbima Books', language: SI }, 0],
  // ---- exercise books ----
  ['CR book', 'සී.ආර්. පොත', 'exercise', 'exercisebook', 'pcs', 0, 0, 0, [['80 pages', 150, 190], ['120 pages', 215, 270], ['160 pages', 280, 350], ['200 pages', 345, 430]], ['Single ruled', 'Square ruled'], { brand: 'Atlas' }, 2],
  ['Exercise book', 'අභ්‍යාස පොත', 'exercise', 'exercisebook', 'pcs', 0, 0, 0, [['40 pages', 52, 70], ['80 pages', 92, 120], ['120 pages', 132, 170], ['160 pages', 172, 220]], ['Single ruled', 'Square ruled'], { brand: 'Atlas' }, 2],
  ['Drawing book', 'චිත්‍ර පොත', 'exercise', 'drawingbook', 'pcs', 0, 0, 0, [['A4', 140, 190], ['A3', 250, 340]], null, { brand: 'Atlas' }, 2],
  ['Spiral notebook', 'ස්පයිරල් සටහන් පොත', 'exercise', 'notebook', 'pcs', 0, 0, 0, [['A5', 230, 320], ['A4', 360, 480]], null, { brand: 'Atlas' }, 2],
  ['Diary 2027', 'දිනපොත 2027', 'exercise', 'notebook', 'pcs', 520, 780, 0, null, null, { brand: 'Ceylon Paper', edition: '2027' }, 3],
  // ---- paper & boards ----
  ['A4 photocopy paper 80 gsm', 'A4 ෆොටෝ කොපි කඩදාසි 80gsm', 'paper', 'paper', 'pcs', 0, 0, 0, [['Ream (500 sheets)', 1650, 1950], ['Half ream (250 sheets)', 850, 1000]], null, { brand: 'Ceylon Paper' }, 3],
  ['Bristol board', 'බ්‍රිස්ටල් බෝඩ්', 'paper', 'board', 'sheet', 55, 90, 0, null, ['White', 'Yellow', 'Pink', 'Blue', 'Green'], { brand: 'Ceylon Paper' }, 3],
  ['Demy paper', 'ඩිමයි කඩදාසි', 'paper', 'board', 'sheet', 14, 25, 0, null, null, { brand: 'Ceylon Paper' }, 3],
  ['Brown paper', 'බ්‍රවුන් පේපර්', 'paper', 'bookcover', 'sheet', 20, 35, 0, null, null, { brand: 'Ceylon Paper' }, 3],
  ['Polythene book cover roll', 'පොලිතීන් පොත් කවර රෝල්', 'paper', 'bookcover', 'm', 55, 100, 0, null, null, { brand: 'Ceylon Paper' }, 3],
  ['Tissue paper', 'ටිෂූ කඩදාසි', 'paper', 'board', 'sheet', 12, 25, 0, null, ['White', 'Red', 'Yellow', 'Blue'], { brand: 'Ceylon Paper' }, 3],
  // ---- pens & pencils ----
  ['Ballpoint pen', 'බෝල්පොයින්ට් පෑන', 'writing', 'pen', 'pcs', 22, 40, 0, null, ['Blue', 'Black', 'Red'], { brand: 'Atlas' }, 2],
  ['Gel pen 0.5 mm', 'ජෙල් පෑන 0.5mm', 'writing', 'pen', 'pcs', 65, 110, 0, null, ['Blue', 'Black'], { brand: 'Atlas' }, 2],
  ['Pencil', 'පැන්සල', 'writing', 'pencil', 'pcs', 0, 0, 0, [['HB', 20, 35], ['2B', 24, 40], ['4B', 30, 50]], null, { brand: 'Atlas' }, 2],
  ['Mechanical pencil 0.7 mm', 'පේසර් පැන්සල 0.7mm', 'writing', 'pencil', 'pcs', 150, 250, 0, null, null, { brand: 'Atlas' }, 2],
  ['Eraser', 'මකනය', 'writing', 'eraser', 'pcs', 14, 30, 0, null, null, { brand: 'Atlas' }, 2],
  ['Pencil sharpener', 'පැන්සල් කටරය', 'writing', 'eraser', 'pcs', 20, 40, 0, null, null, { brand: 'Atlas' }, 2],
  ['Correction pen', 'ටිපෙක්ස් පෑන', 'writing', 'eraser', 'pcs', 125, 220, 0, null, null, { brand: 'Atlas' }, 2],
  ['Highlighter', 'හයිලයිටර්', 'writing', 'marker', 'pcs', 90, 160, 0, null, ['Yellow', 'Green', 'Pink', 'Orange'], { brand: 'Atlas' }, 2],
  ['Whiteboard marker', 'වයිට්බෝඩ් මාකර්', 'writing', 'marker', 'pcs', 110, 190, 0, null, ['Blue', 'Black', 'Red'], { brand: 'Atlas' }, 2],
  ['Permanent marker', 'පර්මනන්ට් මාකර්', 'writing', 'marker', 'pcs', 100, 180, 0, null, ['Black', 'Blue'], { brand: 'Atlas' }, 2],
  // ---- art & colours ----
  ['Colour pencils', 'පාට පැන්සල්', 'art', 'colours', 'pcs', 0, 0, 0, [['12 colours', 260, 390], ['24 colours', 520, 780]], null, { brand: 'Atlas' }, 4],
  ['Pastels', 'පැස්ටල්', 'art', 'colours', 'pcs', 0, 0, 0, [['12 colours', 150, 240], ['24 colours', 290, 450]], null, { brand: 'Atlas' }, 4],
  ['Water colour box, 12 colours', 'දිය සායම් පෙට්ටිය (පාට 12)', 'art', 'colours', 'pcs', 280, 450, 0, null, null, { brand: 'Island Art' }, 4],
  ['Paint brush set (6)', 'පින්සල් කට්ටලය (6)', 'art', 'paint', 'pcs', 220, 380, 0, null, null, { brand: 'Island Art' }, 4],
  ['Poster colours, 6 bottles', 'පෝස්ටර් කලර් (බෝතල් 6)', 'art', 'paint', 'pcs', 450, 720, 0, null, null, { brand: 'Island Art' }, 4],
  ['Modelling clay pack', 'ක්ලේ පැකට්ටුව', 'art', 'craft', 'pcs', 130, 220, 0, null, null, { brand: 'Island Art' }, 4],
  ['Glitter glue set', 'ග්ලිටර් ගම් කට්ටලය', 'art', 'craft', 'pcs', 190, 320, 0, null, null, { brand: 'Island Art' }, 4],
  // ---- office & files ----
  ['Box file', 'බොක්ස් ෆයිල්', 'office', 'file', 'pcs', 320, 520, 0, null, ['Black', 'Blue'], { brand: 'Ceylon Paper' }, 3],
  ['Clear bag file A4', 'ක්ලියර් බෑග් ෆයිල් A4', 'office', 'file', 'pcs', 60, 110, 0, null, ['Clear', 'Blue', 'Green'], { brand: 'Ceylon Paper' }, 3],
  ['Flat file', 'ෆ්ලැට් ෆයිල්', 'office', 'file', 'pcs', 30, 55, 0, null, null, { brand: 'Ceylon Paper' }, 3],
  ['Stapler No. 10', 'ස්ටේප්ලර් අංක 10', 'office', 'clip', 'pcs', 350, 580, 0, null, null, { brand: 'Atlas' }, 2],
  ['Staple pins No. 10 (box)', 'ස්ටේප්ලර් පින් අංක 10', 'office', 'clip', 'pcs', 45, 80, 0, null, null, { brand: 'Atlas' }, 2],
  ['Paper clips (box of 100)', 'පේපර් ක්ලිප් (100)', 'office', 'clip', 'pcs', 70, 120, 0, null, null, { brand: 'Atlas' }, 2],
  ['Gum bottle 50 ml', 'ගම් බෝතලය 50ml', 'office', 'glue', 'pcs', 60, 110, 0, null, null, { brand: 'Atlas' }, 2],
  ['Cellotape 1 inch', 'සෙලෝටේප් අඟල් 1', 'office', 'glue', 'pcs', 85, 150, 0, null, null, { brand: 'Atlas' }, 2],
  ['Scissors 6 inch', 'කතුර අඟල් 6', 'office', 'scissors', 'pcs', 160, 280, 0, null, null, { brand: 'Atlas' }, 2],
  ['Scientific calculator', 'විද්‍යාත්මක ගණක යන්ත්‍රය', 'office', 'calculator', 'pcs', 2400, 3450, 3650, null, null, { brand: 'Casio' }, 2],
  ['Calculator, 12 digits', 'ගණක යන්ත්‍රය (ඉලක්කම් 12)', 'office', 'calculator', 'pcs', 950, 1450, 0, null, null, { brand: 'Casio' }, 2],
  ['Envelopes, long (pack of 25)', 'දිග ලියුම් කවර (25)', 'office', 'envelope', 'pcs', 110, 190, 0, null, null, { brand: 'Ceylon Paper' }, 3],
  ['Receipt book', 'රිසිට් පොත', 'office', 'notebook', 'pcs', 120, 200, 0, null, null, { brand: 'Ceylon Paper' }, 3],
  ['Stamp pad', 'ස්ටෑම්ප් පෑඩ්', 'office', 'stamp', 'pcs', 190, 320, 0, null, ['Blue', 'Black'], { brand: 'Atlas' }, 2],
  // ---- school supplies ----
  ['Mathematical instrument box', 'කවකටු පෙට්ටිය', 'supplies', 'mathset', 'pcs', 350, 580, 0, null, null, { brand: 'Atlas' }, 2],
  ['Ruler 30 cm', 'අඩි රූල 30cm', 'supplies', 'ruler', 'pcs', 40, 80, 0, null, null, { brand: 'Atlas' }, 2],
  ['School bag', 'පාසල් බෑගය', 'supplies', 'schoolbag', 'pcs', 0, 0, 0, [['Small', 1800, 2950], ['Medium', 2300, 3650], ['Large', 2800, 4450]], ['Blue', 'Black'], { brand: 'Island Bags' }, 4],
  ['Water bottle 750 ml', 'වතුර බෝතලය 750ml', 'supplies', 'schoolbag', 'pcs', 380, 650, 0, null, ['Blue', 'Pink'], { brand: 'Island Bags' }, 4],
  ['Lunch box', 'කෑම පෙට්ටිය', 'supplies', 'schoolbag', 'pcs', 320, 550, 0, null, null, { brand: 'Island Bags' }, 4],
  ['Pencil case', 'පැන්සල් පෙට්ටිය', 'supplies', 'pencilcase', 'pcs', 230, 390, 0, null, null, { brand: 'Island Bags' }, 4],
  ['Exam board (clip board)', 'විභාග බෝඩ්', 'supplies', 'clipboard', 'pcs', 170, 290, 0, null, null, { brand: 'Atlas' }, 2],
  ['Name label stickers', 'නම් ලේබල් ස්ටිකර්', 'supplies', 'sticky', 'pcs', 35, 70, 0, null, null, { brand: 'Atlas' }, 2],
  // ---- gifts, cards & toys ----
  ['Birthday card', 'උපන්දින සුබපැතුම් පත', 'gifts', 'card', 'pcs', 80, 150, 0, null, null, { brand: 'Island Art' }, 4],
  ['Gift wrapping paper', 'තෑගි කඩදාසි', 'gifts', 'gift', 'sheet', 40, 80, 0, null, null, { brand: 'Island Art' }, 4],
  ['Balloons (pack of 20)', 'බැලූන් (20)', 'gifts', 'card', 'pcs', 150, 280, 0, null, null, { brand: 'Island Art' }, 4],
  ['Magic cube puzzle', 'මැජික් කියුබ්', 'gifts', 'puzzle', 'pcs', 350, 650, 0, null, null, { brand: 'Island Art' }, 4],
  ['Chess set', 'චෙස් කට්ටලය', 'gifts', 'puzzle', 'pcs', 780, 1350, 0, null, null, { brand: 'Island Art' }, 4],
  // ---- magazines & newspapers ----
  ['Daily newspaper', 'දිනපතා පුවත්පත', 'magazines', 'magazine', 'pcs', 62, 70, 0, null, ['Sinhala', 'English'], { brand: 'Maradana News' }, 5],
  ["Children's weekly paper", 'ළමා සතිපතා පුවත්පත', 'magazines', 'magazine', 'pcs', 52, 60, 0, null, null, { brand: 'Maradana News', language: SI }, 5],
  ['Monthly science magazine', 'මාසික විද්‍යා සඟරාව', 'magazines', 'magazine', 'pcs', 300, 350, 0, null, null, { brand: 'Maradana News', language: SI }, 5],
  // ---- services (no stock) ----
  ['Photocopy A4, black & white', 'ෆොටෝ කොපි A4 (කළු සුදු)', 'services', 'photocopy', 'copy', 0, 0, 0, [['Single side', 3, 10], ['Both sides', 5, 15]], null, { service: true }, null],
  ['Photocopy A3, black & white', 'ෆොටෝ කොපි A3 (කළු සුදු)', 'services', 'photocopy', 'copy', 8, 25, 0, null, null, { service: true }, null],
  ['Printout A4', 'ප්‍රින්ට් අවුට් A4', 'services', 'print', 'copy', 0, 0, 0, [['Black & white', 5, 20], ['Colour', 20, 60]], null, { service: true }, null],
  ['Laminating', 'ලැමිනේටින්', 'services', 'binding', 'pcs', 0, 0, 0, [['ID card size', 15, 50], ['A4', 40, 120], ['A3', 80, 220]], null, { service: true }, null],
  ['Spiral binding', 'ස්පයිරල් බයින්ඩින්', 'services', 'binding', 'pcs', 0, 0, 0, [['Up to 50 sheets', 90, 250], ['Up to 150 sheets', 140, 400]], null, { service: true }, null],
  ['Typesetting, per page', 'ටයිප් සෙටින් (පිටුවකට)', 'services', 'print', 'copy', 0, 150, 0, null, null, { service: true }, null],
  ['Scan to email, per page', 'ස්කෑන් කර ඊමේල් කිරීම (පිටුවකට)', 'services', 'print', 'copy', 0, 30, 0, null, null, { service: true }, null],
];

// [name, phone, type, discount %, credit owed]
const CUSTOMERS = [
  ['Kamal Perera', '0771234501'], ['Nimali Fernando', '0712345602'], ['Saman Kumara', '0763456703'],
  ['Dilini Jayasinghe', '0754567804'], ['Ruwan Bandara', '0705678905'], ['Chathurika Silva', '0726789006'],
  ['Mohamed Rizwan', '0777890107'], ['Priya Rajendran', '0718901208'], ['Tharindu Wijesekara', '0769012309'],
  ['Mrs. Anoma Rathnayake', '0750123410', 'teacher', 5], ['Sunil Gunawardena', '0781234511'], ['Ishara Madushani', '0702345612'],
  ['Mr. Lahiru Dissanayake', '0773456713', 'teacher', 5], ['Fathima Nusra', '0714567814'], ['Kasun Herath', '0765678915'],
  ['Vidyaloka Maha Vidyalaya', '0812345016', 'school', 10, 18500], ['Kundasale Public Library', '0812345017', 'library', 12.5, 0],
  ['Sunrise Montessori', '0812345018', 'school', 7.5, 6200],
];

const SUPPLIERS = [
  ['Lakbima Book Distributors', 'Colombo 10', '0112434567'],
  ['Vidya Educational Publishers', 'Nugegoda', '0112856789'],
  ['Pettah Stationery Wholesale', 'Colombo 11', '0112323456'],
  ['Ceylon Paper Traders', 'Kelaniya', '0112911222'],
  ['Island Art & Gift Supplies', 'Kandy', '0812223344'],
  ['Maradana News Agents', 'Colombo 10', '0112695432'],
];

let rng = 7;
const rand = () => { rng = (rng * 16807) % 2147483647; return (rng - 1) / 2147483646; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => Math.floor(a + rand() * (b - a + 1));

export async function seedIfEmpty() {
  if (await getMeta('seeded')) return false;
  if ((await db.users.count()) > 0) { await setMeta('seeded', true); return false; }
  await seedDemo();
  return true;
}

// A real new shop: the owner account plus the standard bookshop categories (all editable).
export async function createOwnerOnly() {
  const id = uid();
  await db.users.add({ id, name: 'Owner', username: 'admin', role: 'admin', active: true, pinHash: await hashPin(id, '1234') });
  if (!(await db.categories.count())) {
    await db.categories.bulkAdd(CATS.map(([key, en, si, icon, color], i) => ({ id: uid(), key, nameEn: en, nameSi: si, icon, color, sort: i })));
  }
  await setMeta('seeded', true);
  await setMeta('ledger:v1', true);
}

export async function seedDemo() {
  syncState.applying = false;
  const now = Date.now();
  const users = [
    ['Sunil Perera (Owner)', 'admin', 'admin', '1234'],
    ['Nadeesha (Manager)', 'manager', 'manager', '2222'],
    ['Kasun (Cashier)', 'cashier', 'cashier', '1111'],
    ['Ravi (Stock)', 'stock', 'stock', '3333'],
  ];
  const userRows = [];
  for (const [name, username, role, pin] of users) {
    const id = uid();
    userRows.push({ id, name, username, role, active: true, pinHash: await hashPin(id, pin) });
  }

  const cats = CATS.map(([key, en, si, icon, color], i) => ({ id: uid(), key, nameEn: en, nameSi: si, icon, color, sort: i }));
  const catByKey = Object.fromEntries(cats.map((c) => [c.key, c]));
  const suppliers = SUPPLIERS.map(([name, city, phone]) => ({ id: uid(), name, contact: '', phone, email: '', address: city, balance: between(0, 6) * 25000, note: '' }));

  let seq = 0; let isbn = 0;
  const products = []; const variants = [];
  const BOOK_CATS = ['novels', 'children', 'school', 'papers', 'reference', 'religion'];
  PRODUCTS.forEach(([en, si, cat, icon, unit, cost, price, mrp, sizes, colors, extra, sup]) => {
    const x = extra || {};
    const p = { id: uid(), nameEn: en, nameSi: si, categoryId: catByKey[cat].id, icon, unit, author: x.author || '', brand: x.brand || '', language: x.language || '', grade: x.grade || '', subject: x.subject || '', edition: x.edition || '', service: !!x.service, supplierId: sup == null ? '' : suppliers[sup].id, taxable: true, active: true, description: '', createdAt: now - between(40, 300) * 864e5 };
    products.push(p);
    const isBook = BOOK_CATS.includes(cat);
    (sizes || ['']).forEach((s) => (colors || ['']).forEach((c) => {
      const [size, vCost, vPrice] = Array.isArray(s) ? s : [s, cost, price];
      const colour = Array.isArray(c) ? c[0] : c;
      let body;
      // books carry an ISBN (978-955… is Sri Lanka's range), everything else a shop-made barcode
      if (isBook) { isbn += 1; body = '9789550000' + pad(isbn, 2); } else { seq += 1; body = '20' + pad(seq, 10); }
      const fast = ['exercise', 'writing', 'paper'].includes(cat);
      const stock = p.service ? 0 : unit === 'sheet' ? between(40, 300) : unit === 'm' ? between(30, 90) : fast ? between(24, 240) : between(3, 30);
      variants.push({ id: uid(), productId: p.id, size, color: colour, barcode: body + ean13CheckDigit(body), sku: `${cat.slice(0, 3).toUpperCase()}-${pad(variants.length + 1, 4)}`, cost: vCost, price: vPrice, mrp: mrp || (isBook ? vPrice : 0), wholesale: round2(vPrice * 0.9), stock, reorderLevel: p.service ? 0 : fast ? 12 : unit === 'sheet' ? 20 : 3 });
    }));
  });
  const vOf = (name, size = '', color = '') => { const p = products.find((x) => x.nameEn === name); return variants.find((v) => v.productId === p.id && v.size === size && v.color === color); };
  // demo: everything shop-made has labels already, except the newest two products
  const untagged = new Set(products.filter((p) => !p.service).slice(-2).map((p) => p.id));
  variants.forEach((v) => { if (!untagged.has(v.productId) && v.barcode.startsWith('20')) { v.labelledAt = now - 30 * 864e5; v.labelPrice = v.price; } });
  // a few low-stock items so alerts show in the demo
  vOf('Madol Doova').stock = 1; vOf('O/L past papers 2016-2025', 'Mathematics').stock = 2; vOf('Grade 5 scholarship exam guide').stock = 0;
  vOf('CR book', '120 pages', 'Single ruled').stock = 8; vOf('Ballpoint pen', '', 'Red').stock = 6; vOf('Scientific calculator').stock = 1;

  const customers = CUSTOMERS.map(([name, phone, type, discountPct, credit], i) => ({
    id: uid(), name, phone, email: '', address: pick(['Kandy', 'Peradeniya', 'Katugastota', 'Gampola', 'Kundasale', 'Digana']), nic: '',
    type: type || 'person', discountPct: discountPct || 0,
    birthday: type && type !== 'teacher' ? '' : `1990-${pad((i % 12) + 1, 2)}-${pad((i * 3) % 27 + 1, 2)}`, points: 0, creditBalance: credit || (i === 5 ? 1500 : 0),
    totalSpent: 0, visits: 0, createdAt: now - between(30, 400) * 864e5, note: '',
  }));

  // 45 days of history
  const sales = []; let bill = 0;
  const cashiers = userRows.filter((u) => ['admin', 'cashier', 'manager'].includes(u.role));
  const pOf = Object.fromEntries(products.map((p) => [p.id, p]));
  const cOf = Object.fromEntries(cats.map((c) => [c.id, c.key]));
  // what a real counter sells most: stationery and services every few minutes, books a few times a day
  const pool = [];
  variants.forEach((v) => { const k = cOf[pOf[v.productId].categoryId]; const w = { exercise: 5, writing: 5, services: 4, paper: 3, office: 2, supplies: 2, art: 2, magazines: 2 }[k] || 1; for (let i = 0; i < w; i++) pool.push(v); });
  for (let d = 45; d >= 0; d--) {
    const day = new Date(now - d * 864e5);
    const weekend = [0, 6].includes(day.getDay());
    const nBills = between(weekend ? 16 : 10, weekend ? 30 : 20);
    // bill times for the day, in order, so bill numbers follow the clock
    const times = Array.from({ length: nBills }, () => { const x = new Date(day); x.setHours(between(8, 18), between(0, 59), between(0, 59), 0); return x.getTime(); })
      .filter((tm) => tm < now - 5 * 60000).sort((a, b) => a - b);
    for (const tm of times) {
      day.setTime(tm);
      const items = [];
      const nItems = between(1, 5);
      const used = new Set();
      for (let k = 0; k < nItems; k++) {
        const v = pick(pool); if (used.has(v.id)) continue; used.add(v.id);
        const p = pOf[v.productId]; const ck = cOf[p.categoryId];
        const qty = p.unit === 'copy' ? pick([2, 4, 5, 10, 12, 20, 30, 50]) : p.unit === 'sheet' ? between(1, 6) : p.unit === 'm' ? between(2, 8) / 2 : ['exercise', 'writing'].includes(ck) ? pick([1, 1, 2, 2, 3, 5, 6, 10]) : (rand() < 0.85 ? 1 : 2);
        const gross = round2(v.price * qty);
        const disc = ck === 'novels' && rand() < 0.2 ? round2(gross * 0.1) : 0;
        items.push({ variantId: v.id, productId: p.id, categoryId: p.categoryId, nameEn: p.nameEn, nameSi: p.nameSi, icon: p.icon, author: p.author, service: p.service, size: v.size, color: v.color, barcode: v.barcode, unit: p.unit, qty, price: v.price, mrp: v.mrp, cost: v.cost, gross, discount: disc, promoName: '', net: round2(gross - disc), paidUnit: round2((gross - disc) / qty), returnedQty: 0 });
      }
      const subtotal = round2(items.reduce((s, i) => s + i.gross, 0));
      const itemDiscount = round2(items.reduce((s, i) => s + i.discount, 0));
      const total = round2(subtotal - itemDiscount);
      const method = total < 400 || rand() < 0.7 ? 'cash' : rand() < 0.65 ? 'card' : 'qr';
      const cashGiven = method === 'cash' ? Math.ceil(total / (total > 1000 ? 500 : 100)) * (total > 1000 ? 500 : 100) : total;
      const cust = rand() < 0.22 ? pick(customers) : null;
      const cashier = pick(cashiers);
      bill += 1;
      const pts = cust ? Math.floor(total / 100) : 0;
      if (cust) { cust.points += pts; cust.totalSpent = round2(cust.totalSpent + total); cust.visits += 1; cust.lastVisit = day.getTime(); }
      sales.push({
        id: uid(), billNo: `T1-${pad(bill, 6)}`, date: day.getTime(), terminal: 'T1', items, subtotal, itemDiscount, billDiscount: 0, tax: 0, total,
        savings: itemDiscount, payments: [{ method, amount: cashGiven, ref: '' }], paid: cashGiven, cashReceived: method === 'cash' ? cashGiven : 0,
        change: round2(cashGiven - total), customerId: cust?.id || null, customerName: cust?.name || '', customerPhone: cust?.phone || '',
        cashierId: cashier.id, cashierName: cashier.name, shiftId: null, status: 'completed', pointsEarned: pts, pointsUsed: 0, note: '',
      });
    }
  }

  const expenses = [];
  for (let d = 40; d >= 1; d -= between(3, 6)) {
    expenses.push({ id: uid(), date: now - d * 864e5, category: pick(['electricity', 'transport', 'staffMeals', 'packaging', 'machine']), amount: between(8, 60) * 100, note: '', paidBy: 'cash', fromDrawer: false, terminal: 'T1', userId: userRows[0].id });
  }
  expenses.push({ id: uid(), date: now - 20 * 864e5, category: 'rent', amount: 85000, note: 'Monthly shop rent', paidBy: 'bank', fromDrawer: false, terminal: 'T1', userId: userRows[0].id });
  expenses.push({ id: uid(), date: now - 15 * 864e5, category: 'salary', amount: 145000, note: 'Staff salaries', paidBy: 'bank', fromDrawer: false, terminal: 'T1', userId: userRows[0].id });

  const promotions = [
    { id: uid(), name: 'Back to school: 10% off exercise books', nameSi: 'පාසල් සමය: අභ්‍යාස පොත් 10% වට්ටම්', type: 'percent', value: 10, scope: 'category', targetIds: [catByKey.exercise.id], startDate: now - 5 * 864e5, endDate: now + 40 * 864e5, active: true },
    { id: uid(), name: 'Book fair week: Rs. 100 off novels', nameSi: 'පොත් ප්‍රදර්ශන සතිය: නවකතා රු. 100 අඩු', type: 'amount', value: 100, scope: 'category', targetIds: [catByKey.novels.id], startDate: now + 10 * 864e5, endDate: now + 17 * 864e5, active: true },
  ];
  const vouchers = [
    { id: uid(), code: 'GV0000001', type: 'gift', amount: 2500, balance: 2500, status: 'active', issuedAt: now - 10 * 864e5, expiresAt: now + 170 * 864e5, customerId: null, ref: 'Gift voucher', buyer: 'Walk-in' },
    { id: uid(), code: 'AD0000001', type: 'advance', amount: 500, balance: 500, status: 'active', issuedAt: now - 3 * 864e5, expiresAt: now + 362 * 864e5, customerId: customers[8].id, buyer: customers[8].name, paidMethod: 'cash', terminal: 'T1', shiftId: null, ref: 'ORD-00001' },
  ];

  // school book lists: one tap puts the whole list on a bill
  const li = (name, qty, size, color) => ({ variantId: vOf(name, size, color).id, qty });
  const booklists = [
    { id: uid(), name: 'Grade 1 book list 2027', school: 'Vidyaloka Maha Vidyalaya', grade: 'Grade 1', year: '2027', note: '', createdAt: now - 6 * 864e5, items: [
      li('Exercise book', 6, '40 pages', 'Single ruled'), li('Exercise book', 2, '40 pages', 'Square ruled'), li('Drawing book', 1, 'A4'), li('Pencil', 4, 'HB'), li('Eraser', 2), li('Pencil sharpener', 1),
      li('Colour pencils', 1, '12 colours'), li('Pastels', 1, '12 colours'), li('Ruler 30 cm', 1), li('Modelling clay pack', 1), li('Brown paper', 10), li('Name label stickers', 2), li('Gum bottle 50 ml', 1),
    ] },
    { id: uid(), name: 'Grade 6 book list 2027', school: 'Vidyaloka Maha Vidyalaya', grade: 'Grade 6', year: '2027', note: '', createdAt: now - 6 * 864e5, items: [
      li('CR book', 8, '80 pages', 'Single ruled'), li('CR book', 2, '120 pages', 'Square ruled'), li('Drawing book', 1, 'A3'), li('Mathematical instrument box', 1), li('Ballpoint pen', 4, '', 'Blue'), li('Ballpoint pen', 1, '', 'Red'),
      li('Pencil', 2, 'HB'), li('Ruler 30 cm', 1), li('School atlas of Sri Lanka', 1), li('Grade 6 Mathematics workbook', 1), li('Flat file', 2), li('Polythene book cover roll', 5),
    ] },
    { id: uid(), name: 'O/L exam pack', school: '', grade: 'O/L', year: '2026', note: 'Past papers and exam stationery', createdAt: now - 20 * 864e5, items: [
      li('O/L past papers 2016-2025', 1, 'Mathematics'), li('O/L past papers 2016-2025', 1, 'Science'), li('O/L past papers 2016-2025', 1, 'English'), li('Exam board (clip board)', 1), li('Ballpoint pen', 3, '', 'Blue'), li('Pencil', 2, '2B'), li('Eraser', 1), li('Mathematical instrument box', 1),
    ] },
  ];
  // customer orders: books to bring down from the publisher
  const orders = [
    { id: uid(), orderNo: 'ORD-00001', date: now - 3 * 864e5, customerId: customers[8].id, customerName: customers[8].name, phone: customers[8].phone, items: [{ title: 'A/L Chemistry practical guide', author: 'Vidya Educational', qty: 1, price: 1350 }], advance: 500, advanceMethod: 'cash', voucherCode: 'AD0000001', status: 'ordered', note: 'Needs it before the term test', userId: userRows[2].id, userName: userRows[2].name, terminal: 'T1' },
    { id: uid(), orderNo: 'ORD-00002', date: now - 6 * 864e5, customerId: customers[13].id, customerName: customers[13].name, phone: customers[13].phone, items: [{ title: 'English-Tamil dictionary', author: '', qty: 1, price: 1900 }, { title: 'Grade 8 Tamil workbook', author: '', qty: 2, price: 450 }], advance: 0, advanceMethod: 'cash', voucherCode: '', status: 'arrived', note: '', userId: userRows[2].id, userName: userRows[2].name, terminal: 'T1' },
  ];

  await db.transaction('rw', [db.users, db.categories, db.suppliers, db.products, db.variants, db.customers, db.sales, db.expenses, db.promotions, db.vouchers, db.booklists, db.orders, db.meta], async () => {
    await db.users.bulkAdd(userRows);
    await db.categories.bulkAdd(cats);
    await db.suppliers.bulkAdd(suppliers);
    await db.products.bulkAdd(products);
    await db.variants.bulkAdd(variants);
    await db.customers.bulkAdd(customers);
    await db.sales.bulkAdd(sales);
    await db.expenses.bulkAdd(expenses);
    await db.promotions.bulkAdd(promotions);
    await db.vouchers.bulkAdd(vouchers);
    await db.booklists.bulkAdd(booklists);
    await db.orders.bulkAdd(orders);
    await db.meta.bulkPut([
      { key: 'seq:barcode:20', value: seq }, { key: 'seq:bill:T1', value: bill }, { key: 'seq:giftvoucher', value: 1 }, { key: 'seq:order', value: 2 }, { key: 'seq:advance', value: 1 },
      { key: 'seeded', value: true }, { key: 'demo', value: true },
    ]);
  });
}
