// Line icons for the book and stationery trade.
// Each icon has English and Sinhala keywords so a new item name can suggest its icon.
import {
  Book, BookOpen, BookHeart, BookText, FileStack, BookCheck, BookA, Languages, Flower2, Atom, Sigma, Scroll, Globe, Laptop,
  ChartLine, HeartPulse, Feather, Newspaper, BookUser, GraduationCap, Music, Notebook, NotebookPen, Image, Files, Layers,
  Pen, Pencil, Palette, Paintbrush, Highlighter, Eraser, Ruler, DraftingCompass, Scissors, Droplet, Calculator, Folder,
  Paperclip, StickyNote, Mail, Backpack, PencilRuler, BookMarked, Presentation, Clipboard, Stamp, Calendar, ToyBrick,
  Puzzle, Trophy, Gift, PartyPopper, Shapes, Copy, Printer, BookCopy, Smartphone, Usb, Umbrella, Tag,
} from 'lucide-react';

export const ICONS = [
  // ---- books ----
  { id: 'book', C: Book, en: 'Book', si: 'පොත', kw: ['book', 'පොත', 'පොත්', 'ග්‍රන්ථ'] },
  { id: 'novel', C: BookOpen, en: 'Novel / fiction', si: 'නවකතා', kw: ['novel', 'fiction', 'story', 'stories', 'translation', 'thriller', 'detective', 'නවකතා', 'නවකතාව', 'කෙටිකතා', 'කතා', 'පරිවර්තන'] },
  { id: 'childbook', C: BookHeart, en: "Children's book", si: 'ළමා පොත', kw: ['children', 'kids', 'picture book', 'fairy', 'colouring book', 'coloring book', 'nursery', 'rhyme', 'ළමා', 'සුරංගනා', 'පාට කිරීමේ', 'පෙර පාසල්', 'ළදරු'] },
  { id: 'textbook', C: BookText, en: 'School textbook', si: 'පෙළපොත', kw: ['textbook', 'text book', 'grade', 'syllabus', 'reader', 'පෙළපොත', 'පෙළ පොත', 'ශ්‍රේණිය', 'ශ්‍රේණිය', 'විෂය'] },
  { id: 'pastpaper', C: FileStack, en: 'Past papers', si: 'ප්‍රශ්න පත්‍ර', kw: ['past paper', 'papers', 'model paper', 'question', 'term test', 'ප්‍රශ්න පත්‍ර', 'පසුගිය විභාග', 'ආදර්ශ ප්‍රශ්න', 'වාර විභාග'] },
  { id: 'workbook', C: BookCheck, en: 'Workbook / revision', si: 'වැඩපොත', kw: ['workbook', 'work book', 'revision', 'guide', 'short note', 'activity', 'practice', 'වැඩපොත', 'වැඩ පොත', 'අභ්‍යාස මාලා', 'සංශෝධන', 'කෙටි සටහන්', 'ක්‍රියාකාරකම්'] },
  { id: 'examguide', C: GraduationCap, en: 'Exam guide', si: 'විභාග මාර්ගෝපදේශ', kw: ['scholarship', 'o/l', 'a/l', 'ordinary level', 'advanced level', 'exam', 'tuition', 'seminar', 'ශිෂ්‍යත්ව', 'සා.පෙළ', 'උ.පෙළ', 'සාමාන්‍ය පෙළ', 'උසස් පෙළ', 'විභාග', 'සම්මන්ත්‍රණ'] },
  { id: 'dictionary', C: BookA, en: 'Dictionary', si: 'ශබ්දකෝෂය', kw: ['dictionary', 'thesaurus', 'encyclopedia', 'ශබ්දකෝෂ', 'ශබ්ද කෝෂ', 'විශ්වකෝෂ'] },
  { id: 'language', C: Languages, en: 'Language learning', si: 'භාෂා', kw: ['english', 'tamil', 'sinhala', 'grammar', 'spoken', 'essay', 'letter writing', 'japanese', 'korean', 'ඉංග්‍රීසි', 'දෙමළ', 'සිංහල', 'ව්‍යාකරණ', 'රචනා', 'කථන', 'ජපන්', 'කොරියන්'] },
  { id: 'religion', C: Flower2, en: 'Religious book', si: 'ආගමික පොත්', kw: ['dhamma', 'buddhist', 'buddha', 'pirith', 'jathaka', 'jataka', 'bana', 'bible', 'quran', 'hindu', 'prayer', 'meditation', 'ධර්ම', 'බුදු', 'පිරිත්', 'ජාතක', 'බණ', 'බයිබල්', 'කුර්ආන්', 'භාවනා', 'දහම්'] },
  { id: 'science', C: Atom, en: 'Science', si: 'විද්‍යාව', kw: ['science', 'physics', 'chemistry', 'biology', 'agriculture', 'විද්‍යාව', 'භෞතික', 'රසායන', 'ජීව', 'කෘෂි'] },
  { id: 'maths', C: Sigma, en: 'Mathematics', si: 'ගණිතය', kw: ['maths', 'math', 'mathematics', 'combined maths', 'ගණිත', 'ගණිතය', 'සංයුක්ත ගණිත'] },
  { id: 'history', C: Scroll, en: 'History & culture', si: 'ඉතිහාසය', kw: ['history', 'civics', 'culture', 'mahavamsa', 'heritage', 'ඉතිහාස', 'ඉතිහාසය', 'පුරවැසි', 'සංස්කෘති', 'මහාවංශ'] },
  { id: 'atlas', C: Globe, en: 'Atlas & maps', si: 'සිතියම්', kw: ['atlas', 'map', 'geography', 'globe', 'සිතියම්', 'භූගෝල', 'ලෝක ගෝල'] },
  { id: 'computer', C: Laptop, en: 'ICT & computers', si: 'තොරතුරු තාක්ෂණය', kw: ['ict', 'computer', 'programming', 'technology', 'python', 'excel', 'තොරතුරු තාක්ෂණ', 'පරිගණක', 'තාක්ෂණ'] },
  { id: 'commerce', C: ChartLine, en: 'Commerce & business', si: 'වාණිජ', kw: ['commerce', 'accounting', 'business', 'economics', 'management', 'law', 'වාණිජ', 'ගිණුම්', 'ව්‍යාපාර', 'ආර්ථික', 'කළමනාකරණ', 'නීති'] },
  { id: 'health', C: HeartPulse, en: 'Health & cookery', si: 'සෞඛ්‍ය', kw: ['health', 'medical', 'nursing', 'cookery', 'cook book', 'recipe', 'yoga', 'ayurveda', 'සෞඛ්‍ය', 'වෛද්‍ය', 'ඉවුම් පිහුම්', 'ආයුර්වේද', 'යෝග'] },
  { id: 'poetry', C: Feather, en: 'Poetry & literature', si: 'කවි', kw: ['poetry', 'poem', 'verse', 'literature', 'lyrics', 'කවි', 'කාව්‍ය', 'සාහිත්‍ය', 'ගීත රචනා'] },
  { id: 'biography', C: BookUser, en: 'Biography', si: 'චරිතාපදාන', kw: ['biography', 'autobiography', 'memoir', 'චරිතාපදාන', 'ජීවිත කතාව', 'අපදාන'] },
  { id: 'music', C: Music, en: 'Music & arts', si: 'සංගීතය', kw: ['music', 'dancing', 'drama', 'art book', 'aesthetic', 'සංගීත', 'නර්තන', 'නාට්‍ය', 'සෞන්දර්ය'] },
  { id: 'magazine', C: Newspaper, en: 'Magazines & newspapers', si: 'සඟරා සහ පුවත්පත්', kw: ['magazine', 'newspaper', 'journal', 'weekly', 'gazette', 'සඟරා', 'සඟරාව', 'පුවත්පත්', 'පත්තර', 'ගැසට්'] },
  // ---- paper & books to write in ----
  { id: 'exercisebook', C: Notebook, en: 'Exercise book', si: 'අභ්‍යාස පොත', kw: ['exercise book', 'cr book', 'c.r.', 'single ruled', 'double ruled', 'square ruled', 'ruled book', 'monitor book', 'අභ්‍යාස පොත', 'සී.ආර්', 'සීආර්', 'තනි රූල්', 'කොටු රූල්', 'රූල් පොත'] },
  { id: 'notebook', C: NotebookPen, en: 'Notebook / diary', si: 'සටහන් පොත', kw: ['notebook', 'note book', 'diary', 'journal book', 'spiral', 'record book', 'ledger', 'receipt book', 'සටහන් පොත', 'දිනපොත', 'ලෙජර්', 'රිසිට් පොත', 'වාර්තා පොත'] },
  { id: 'drawingbook', C: Image, en: 'Drawing book', si: 'චිත්‍ර පොත', kw: ['drawing book', 'sketch', 'art pad', 'canvas', 'චිත්‍ර පොත', 'චිත්‍ර', 'ස්කෙච්'] },
  { id: 'paper', C: Files, en: 'Paper', si: 'කඩදාසි', kw: ['a4', 'a3', 'photocopy paper', 'ream', 'foolscap', 'half sheet', 'typing paper', 'කඩදාසි', 'රීම්', 'ෆුල්ස්කැප්', 'හාෆ් ෂීට්'] },
  { id: 'board', C: Layers, en: 'Boards & sheets', si: 'බෝඩ් සහ ෂීට්', kw: ['bristol', 'board', 'demy', 'tissue paper', 'cardboard', 'colour paper', 'gift paper', 'oil paper', 'kite paper', 'බ්‍රිස්ටල්', 'බෝඩ්', 'ඩිමයි', 'ටිෂූ', 'කාඩ්බෝඩ්', 'පාට කඩදාසි', 'සරුංගල් කොළ'] },
  { id: 'bookcover', C: BookMarked, en: 'Book covers & labels', si: 'පොත් කවර', kw: ['book cover', 'brown paper', 'polythene cover', 'cover roll', 'name label', 'bookmark', 'පොත් කවර', 'බ්‍රවුන් පේපර්', 'පොලිතීන් කවර', 'නම් ලේබල්'] },
  // ---- writing ----
  { id: 'pen', C: Pen, en: 'Pen', si: 'පෑන', kw: ['pen', 'ballpoint', 'ball point', 'gel', 'refill', 'ink pen', 'fountain', 'පෑන', 'පෑන්', 'බෝල්පොයින්ට්', 'ජෙල්', 'රීෆිල්'] },
  { id: 'pencil', C: Pencil, en: 'Pencil', si: 'පැන්සල', kw: ['pencil', 'hb', '2b', 'mechanical', 'pacer', 'lead', 'පැන්සල', 'පැන්සල්', 'පේසර්', 'ඊයම්'] },
  { id: 'colours', C: Palette, en: 'Colours', si: 'පාට', kw: ['colour pencil', 'color pencil', 'pastel', 'crayon', 'water colour', 'watercolor', 'colour', 'sketch pen', 'felt pen', 'පාට පැන්සල්', 'පැස්ටල්', 'ක්‍රේයෝන්', 'දිය සායම්', 'පාට'] },
  { id: 'paint', C: Paintbrush, en: 'Paints & brushes', si: 'තීන්ත සහ පින්සල්', kw: ['paint', 'brush', 'poster colour', 'acrylic', 'fabric paint', 'තීන්ත', 'පින්සල', 'පින්සල්', 'පෝස්ටර් කලර්', 'සායම්'] },
  { id: 'marker', C: Highlighter, en: 'Markers & highlighters', si: 'මාකර්', kw: ['marker', 'highlighter', 'whiteboard marker', 'permanent', 'මාකර්', 'හයිලයිටර්'] },
  { id: 'eraser', C: Eraser, en: 'Eraser & sharpener', si: 'මකනය සහ කටර්', kw: ['eraser', 'rubber', 'sharpener', 'correction', 'tipex', 'whitener', 'මකන', 'මකනය', 'රබර්', 'පැන්සල් කටර්', 'ටිපෙක්ස්'] },
  // ---- tools ----
  { id: 'ruler', C: Ruler, en: 'Ruler', si: 'අඩි රූල', kw: ['ruler', 'foot ruler', 'scale', 'අඩි රූල', 'රූල', 'අඩි කෝදුව'] },
  { id: 'mathset', C: DraftingCompass, en: 'Maths instruments', si: 'ජ්‍යාමිතික උපකරණ', kw: ['instrument box', 'mathematical', 'compass', 'protractor', 'set square', 'divider', 'geometry', 'කවකටු', 'ජ්‍යාමිති', 'උපකරණ පෙට්ටිය', 'කෝණමානය', 'විහිත චතුරස්‍රය'] },
  { id: 'scissors', C: Scissors, en: 'Scissors & cutters', si: 'කතුරු', kw: ['scissor', 'cutter', 'blade', 'paper knife', 'කතුර', 'කතුරු', 'කටර්', 'බ්ලේඩ්'] },
  { id: 'glue', C: Droplet, en: 'Glue & tape', si: 'ගම් සහ ටේප්', kw: ['glue', 'gum', 'paste', 'tape', 'cellotape', 'binding tape', 'double tape', 'ගම්', 'ටේප්', 'සෙලෝටේප්', 'මැලියම්'] },
  { id: 'calculator', C: Calculator, en: 'Calculator', si: 'ගණක යන්ත්‍රය', kw: ['calculator', 'scientific', 'casio', 'ගණක යන්ත්‍ර', 'කැල්කියුලේටර්'] },
  { id: 'file', C: Folder, en: 'Files & folders', si: 'ෆයිල්', kw: ['file', 'folder', 'box file', 'clear book', 'clear bag', 'document', 'ring binder', 'ෆයිල්', 'ෆෝල්ඩර්', 'බොක්ස් ෆයිල්', 'ලිපිගොනු'] },
  { id: 'clip', C: Paperclip, en: 'Clips & staplers', si: 'ක්ලිප් සහ ස්ටේප්ලර්', kw: ['clip', 'pin', 'stapler', 'staple', 'punch', 'rubber band', 'binder clip', 'ක්ලිප්', 'අල්පෙනෙති', 'ස්ටේප්ලර්', 'පන්ච්', 'රබර් බෑන්ඩ්'] },
  { id: 'sticky', C: StickyNote, en: 'Sticky notes & stickers', si: 'ස්ටිකර්', kw: ['sticky', 'post-it', 'memo', 'sticker', 'label sheet', 'ස්ටිකර්', 'මෙමෝ', 'ලේබල්'] },
  { id: 'envelope', C: Mail, en: 'Envelopes', si: 'ලියුම් කවර', kw: ['envelope', 'letter pad', 'ලියුම් කවර', 'එන්වලප්', 'ලියුම් කොළ'] },
  { id: 'clipboard', C: Clipboard, en: 'Clipboard / exam board', si: 'ක්ලිප් බෝඩ්', kw: ['clipboard', 'clip board', 'exam board', 'writing board', 'ක්ලිප් බෝඩ්', 'විභාග බෝඩ්', 'ලියන පුවරු'] },
  { id: 'whiteboard', C: Presentation, en: 'Boards & chalk', si: 'පුවරු සහ හුණු', kw: ['whiteboard', 'white board', 'blackboard', 'chalk', 'duster', 'slate', 'notice board', 'වයිට්බෝඩ්', 'කළු ලෑල්ල', 'හුණු', 'ඩස්ටර්', 'ගල් ලෑල්ල'] },
  { id: 'stamp', C: Stamp, en: 'Stamps & ink', si: 'මුද්‍රා සහ තීන්ත', kw: ['stamp pad', 'rubber stamp', 'ink', 'seal', 'date stamp', 'මුද්‍රා', 'සීල්', 'ස්ටෑම්ප්', 'තීන්ත කුප්පි'] },
  { id: 'calendar', C: Calendar, en: 'Calendars', si: 'දින දර්ශන', kw: ['calendar', 'planner', 'litha', 'almanac', 'දින දර්ශන', 'ලිත', 'කැලැන්ඩර්'] },
  // ---- school & gifts ----
  { id: 'schoolbag', C: Backpack, en: 'School bags & bottles', si: 'පාසල් බෑග්', kw: ['school bag', 'bag', 'backpack', 'lunch box', 'water bottle', 'බෑග්', 'බෑගය', 'පාසල් බෑග්', 'කෑම පෙට්ටි', 'වතුර බෝතල්'] },
  { id: 'pencilcase', C: PencilRuler, en: 'Pencil case', si: 'පැන්සල් පෙට්ටිය', kw: ['pencil case', 'pencil box', 'pouch', 'පැන්සල් පෙට්ටි', 'පැන්සල් කේස්', 'පවුච්'] },
  { id: 'toys', C: ToyBrick, en: 'Toys', si: 'සෙල්ලම් බඩු', kw: ['toy', 'doll', 'blocks', 'car toy', 'සෙල්ලම් බඩු', 'බෝනික්කා', 'සෙල්ලම්'] },
  { id: 'puzzle', C: Puzzle, en: 'Games & puzzles', si: 'ක්‍රීඩා සහ ප්‍රහේලිකා', kw: ['puzzle', 'board game', 'chess', 'carrom', 'cards', 'rubik', 'ප්‍රහේලිකා', 'චෙස්', 'කැරම්', 'පසල්'] },
  { id: 'sports', C: Trophy, en: 'Sports & trophies', si: 'ක්‍රීඩා භාණ්ඩ', kw: ['sport', 'ball', 'bat', 'trophy', 'medal', 'shuttle', 'whistle', 'ක්‍රීඩා', 'බෝල', 'පිති', 'කුසලාන', 'පදක්කම්'] },
  { id: 'gift', C: Gift, en: 'Gifts & wrapping', si: 'තෑගි', kw: ['gift', 'wrapping', 'ribbon', 'gift bag', 'souvenir', 'තෑගි', 'තෑගි කඩදාසි', 'රිබන්'] },
  { id: 'card', C: PartyPopper, en: 'Cards & party items', si: 'සුබපැතුම් පත්', kw: ['greeting card', 'birthday', 'wedding card', 'balloon', 'party', 'candle', 'decoration', 'vesak', 'lantern', 'සුබපැතුම්', 'උපන්දින', 'බැලූන්', 'සැරසිලි', 'වෙසක්', 'කූඩු'] },
  { id: 'craft', C: Shapes, en: 'Craft items', si: 'අත්කම් ද්‍රව්‍ය', kw: ['craft', 'clay', 'glitter', 'bead', 'foam', 'origami', 'thermocol', 'rigifoam', 'අත්කම්', 'මැටි', 'ග්ලිටර්', 'පබළු', 'රෙජිෆෝම්'] },
  // ---- services & others ----
  { id: 'photocopy', C: Copy, en: 'Photocopy', si: 'ෆොටෝ කොපි', kw: ['photocopy', 'photo copy', 'copy', 'xerox', 'ෆොටෝ කොපි', 'ෆොටෝකොපි', 'ඡායා පිටපත්'] },
  { id: 'print', C: Printer, en: 'Printing & typing', si: 'මුද්‍රණය', kw: ['printout', 'print', 'printing', 'typesetting', 'typing', 'scan', 'colour print', 'email', 'මුද්‍රණ', 'ප්‍රින්ට්', 'ටයිප්', 'ස්කෑන්'] },
  { id: 'binding', C: BookCopy, en: 'Binding & laminating', si: 'බයින්ඩින් සහ ලැමිනේටින්', kw: ['binding', 'laminat', 'spiral binding', 'comb binding', 'බයින්ඩ්', 'ලැමිනේට්', 'ස්පයිරල්'] },
  { id: 'reload', C: Smartphone, en: 'Reload & phone cards', si: 'රීලෝඩ්', kw: ['reload', 'top-up', 'top up', 'sim', 'phone card', 'recharge', 'රීලෝඩ්', 'සිම්', 'කාඩ්පත්'] },
  { id: 'electronics', C: Usb, en: 'Batteries & accessories', si: 'බැටරි සහ උපාංග', kw: ['pen drive', 'battery', 'earphone', 'cable', 'charger', 'memory card', 'mouse', 'cd', 'dvd', 'බැටරි', 'පෙන් ඩ්‍රයිව්', 'චාජර්', 'කේබල්', 'ඉයර්ෆෝන්'] },
  { id: 'umbrella', C: Umbrella, en: 'Umbrellas & raincoats', si: 'කුඩ', kw: ['umbrella', 'raincoat', 'කුඩ', 'කුඩය', 'වැහි කබා'] },
  { id: 'tag', C: Tag, en: 'Other item', si: 'වෙනත් භාණ්ඩ', kw: ['other', 'misc', 'වෙනත්'] },
];

export const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.id, i]));

export function ItemIcon({ id, size = 24, stroke = 1.6, className = '', title }) {
  const C = (ICON_MAP[id] || ICON_MAP.tag).C;
  return <C size={size} strokeWidth={stroke} className={className} role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} />;
}

// Suggests icons for an item name, best match first. Works with Sinhala too.
// General words (book, paper, colour) count for little, so "Grade 5 scholarship past papers"
// picks Past papers and "Atlas CR book 120 pages" picks Exercise book.
const WEAK = new Set(['book', 'පොත', 'පොත්', 'paper', 'papers', 'කඩදාසි', 'colour', 'පාට', 'board', 'බෝඩ්', 'copy', 'print', 'bag', 'grade', 'ශ්‍රේණිය', 'english', 'sinhala', 'tamil', 'සිංහල', 'ඉංග්‍රීසි', 'දෙමළ', 'pin', 'ink', 'cards', 'file', 'pen', 'exam', 'විභාග', 'කතා', 'චිත්‍ර', 'ball', 'map', 'sim', 'cd', 'hb', 'a4', 'a3', 'set', 'scale', 'label sheet', 'rubber']);
export function recommendIcons(text, limit = 4) {
  const q = String(text || '').toLowerCase().trim();
  if (!q) return [];
  const scored = [];
  for (const icon of ICONS) {
    let best = 0;
    for (const kw of [...icon.kw, icon.en.toLowerCase(), icon.si]) {
      const k = kw.toLowerCase();
      const at = k ? q.lastIndexOf(k) : -1;
      if (at < 0) continue;
      // short Latin keywords must match a whole word: "pen" must not match "pencil" or "open"
      if (/^[a-z0-9]+$/.test(k) && k.length <= 4 && !new RegExp(`(^|[^a-z0-9])${k}s?([^a-z0-9]|$)`).test(q)) continue;
      const score = (WEAK.has(k) ? 1 : k.length) + (2 * at) / q.length;
      best = Math.max(best, score);
    }
    if (best) scored.push({ id: icon.id, score: best });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.id);
}
